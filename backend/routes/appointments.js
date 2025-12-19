const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const reminderService = require('../services/reminderService');
const appointmentSyncService = require('../services/appointmentSyncService');
const webhookService = require('../services/webhookService');

// Get all appointments for organization
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const { start_date, end_date, status, patient_phone, patient_email } = req.query;

    let query = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    let paramCount = 0;

    // Filter by date range
    if (start_date) {
      paramCount++;
      params.push(start_date);
      query += ` AND appointment_date >= $${paramCount}`;
    }
    if (end_date) {
      paramCount++;
      params.push(end_date);
      query += ` AND appointment_date <= $${paramCount}`;
    }

    // Filter by status
    if (status) {
      paramCount++;
      params.push(status);
      query += ` AND status = $${paramCount}`;
    }

    // Filter by patient phone
    if (patient_phone) {
      paramCount++;
      params.push(patient_phone);
      query += ` AND patient_phone = $${paramCount}`;
    }

    // Filter by patient email
    if (patient_email) {
      paramCount++;
      params.push(patient_email);
      query += ` AND patient_email = $${paramCount}`;
    }

    // Filter by organization (via conversation_id or direct organization check)
    // For appointments without conversation_id, we need to check by organization differently
    // Since appointments table doesn't have organization_id directly, we filter via conversations
    // Appointments without conversation_id belong to all organizations (this is a limitation)
    if (orgId) {
      paramCount++;
      params.push(orgId);
      query += ` AND (conversation_id IS NULL OR conversation_id IN (SELECT id FROM conversations WHERE user_id IN (SELECT id FROM users WHERE organization_id = $${paramCount})))`;
    }

    query += ' ORDER BY appointment_date DESC';

    // Get appointments with agent information if conversation exists
    const result = await db.query(query, params);
    
    // Enrich appointments with agent information
    const enrichedAppointments = await Promise.all(result.rows.map(async (appointment) => {
      if (appointment.conversation_id) {
        try {
          const conversationResult = await db.query(
            `SELECT c.agent_id, a.name as agent_name, a.type as agent_type 
             FROM conversations c
             LEFT JOIN ai_agents a ON c.agent_id = a.id
             WHERE c.id = $1`,
            [appointment.conversation_id]
          );
          
          if (conversationResult.rows.length > 0) {
            appointment.agent_id = conversationResult.rows[0].agent_id;
            appointment.agent_name = conversationResult.rows[0].agent_name;
            appointment.agent_type = conversationResult.rows[0].agent_type;
          }
        } catch (error) {
          console.error('Error fetching agent info:', error);
        }
      }
      return appointment;
    }));

    res.json({ appointments: enrichedAppointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Error fetching appointments', error: error.message });
  }
});

// Get single appointment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    let query = 'SELECT * FROM appointments WHERE id = $1';
    const params = [id];

    if (orgId) {
      query += ` AND conversation_id IN (SELECT id FROM conversations WHERE user_id IN (SELECT id FROM users WHERE organization_id = $2))`;
      params.push(orgId);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json({ appointment: result.rows[0] });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Error fetching appointment', error: error.message });
  }
});

// Create new appointment (booking)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    const {
      conversation_id,
      patient_name,
      patient_phone,
      patient_email,
      appointment_date,
      appointment_type,
      notes
    } = req.body;

    // Validate required fields
    if (!patient_name || !appointment_date) {
      return res.status(400).json({ message: 'Patient name and appointment date are required' });
    }

    // Validate date
    const appointmentDate = new Date(appointment_date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ message: 'Invalid appointment date format' });
    }

    // Check if appointment date is in the past
    if (appointmentDate < new Date()) {
      return res.status(400).json({ message: 'Appointment date cannot be in the past' });
    }

    // Insert appointment
    const result = await db.query(
      `INSERT INTO appointments (
        conversation_id, patient_name, patient_phone, patient_email,
        appointment_date, appointment_type, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        conversation_id || null,
        patient_name,
        patient_phone || null,
        patient_email || null,
        appointment_date,
        appointment_type || null,
        'scheduled',
        notes || null
      ]
    );

    const appointment = result.rows[0];

    // Trigger webhook event
    try {
      await webhookService.deliverWebhookEvent('appointment.created', {
        appointment_id: appointment.id,
        patient_name: appointment.patient_name,
        patient_phone: appointment.patient_phone,
        appointment_date: appointment.appointment_date,
        appointment_type: appointment.appointment_type,
        organization_id: orgId
      }, orgId);
    } catch (webhookError) {
      console.error('Error delivering appointment.created webhook:', webhookError);
    }

    // Sync to external scheduling systems if configured
    try {
      if (conversation_id && orgId) {
        // Get active scheduling integrations
        const integrationsResult = await db.query(
          `SELECT id FROM integrations 
           WHERE organization_id = $1 
           AND provider IN ('google_calendar', 'zocdoc', 'calendly', 'ehr')
           AND is_active = true`,
          [orgId]
        );

        // Sync to first active integration (can be enhanced to sync to all)
        if (integrationsResult.rows.length > 0) {
          const integrationId = integrationsResult.rows[0].id;
          await appointmentSyncService.syncAppointment(appointment.id, integrationId, orgId);
        }
      }
    } catch (syncError) {
      console.error('Error syncing appointment to external system:', syncError);
      // Don't fail the appointment creation if sync fails
    }

    res.status(201).json({ appointment });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Error creating appointment', error: error.message });
  }
});

// Update appointment (rescheduling)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Check if appointment exists and user has access
    let checkQuery = 'SELECT * FROM appointments WHERE id = $1';
    const checkParams = [id];
    if (orgId) {
      checkQuery += ` AND conversation_id IN (SELECT id FROM conversations WHERE user_id IN (SELECT id FROM users WHERE organization_id = $2))`;
      checkParams.push(orgId);
    }

    const checkResult = await db.query(checkQuery, checkParams);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found or access denied' });
    }

    const existingAppointment = checkResult.rows[0];

    const {
      appointment_date,
      appointment_type,
      status,
      patient_name,
      patient_phone,
      patient_email,
      notes
    } = req.body;

    // Validate date if provided
    if (appointment_date) {
      const appointmentDate = new Date(appointment_date);
      if (isNaN(appointmentDate.getTime())) {
        return res.status(400).json({ message: 'Invalid appointment date format' });
      }
      if (appointmentDate < new Date()) {
        return res.status(400).json({ message: 'Appointment date cannot be in the past' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (appointment_date !== undefined) {
      paramCount++;
      params.push(appointment_date);
      updates.push(`appointment_date = $${paramCount}`);
    }
    if (appointment_type !== undefined) {
      paramCount++;
      params.push(appointment_type);
      updates.push(`appointment_type = $${paramCount}`);
    }
    if (status !== undefined) {
      paramCount++;
      params.push(status);
      updates.push(`status = $${paramCount}`);
    }
    if (patient_name !== undefined) {
      paramCount++;
      params.push(patient_name);
      updates.push(`patient_name = $${paramCount}`);
    }
    if (patient_phone !== undefined) {
      paramCount++;
      params.push(patient_phone);
      updates.push(`patient_phone = $${paramCount}`);
    }
    if (patient_email !== undefined) {
      paramCount++;
      params.push(patient_email);
      updates.push(`patient_email = $${paramCount}`);
    }
    if (notes !== undefined) {
      paramCount++;
      params.push(notes);
      updates.push(`notes = $${paramCount}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    paramCount++;
    params.push(id);
    updates.push(`id = $${paramCount}`);

    const updateQuery = `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(updateQuery, params);

    const updatedAppointment = result.rows[0];

    // Trigger webhook event
    try {
      await webhookService.deliverWebhookEvent('appointment.updated', {
        appointment_id: updatedAppointment.id,
        previous_date: existingAppointment.appointment_date,
        new_date: updatedAppointment.appointment_date,
        previous_status: existingAppointment.status,
        new_status: updatedAppointment.status,
        organization_id: orgId
      }, orgId);
    } catch (webhookError) {
      console.error('Error delivering appointment.updated webhook:', webhookError);
    }

    // Sync to external scheduling systems if date or status changed
    if (appointment_date !== undefined || status !== undefined) {
      try {
        if (orgId) {
          const integrationsResult = await db.query(
            `SELECT id FROM integrations 
             WHERE organization_id = $1 
             AND provider IN ('google_calendar', 'zocdoc', 'calendly', 'ehr')
             AND is_active = true`,
            [orgId]
          );

          if (integrationsResult.rows.length > 0) {
            const integrationId = integrationsResult.rows[0].id;
            await appointmentSyncService.syncAppointment(updatedAppointment.id, integrationId, orgId);
          }
        }
      } catch (syncError) {
        console.error('Error syncing updated appointment to external system:', syncError);
      }
    }

    res.json({ appointment: updatedAppointment, message: 'Appointment updated successfully' });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Error updating appointment', error: error.message });
  }
});

// Cancel appointment
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Check if appointment exists
    let checkQuery = 'SELECT * FROM appointments WHERE id = $1 AND status != $2';
    const checkParams = [id, 'cancelled'];
    if (orgId) {
      checkQuery += ` AND conversation_id IN (SELECT id FROM conversations WHERE user_id IN (SELECT id FROM users WHERE organization_id = $3))`;
      checkParams.push(orgId);
    }

    const checkResult = await db.query(checkQuery, checkParams);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found or already cancelled' });
    }

    const existingAppointment = checkResult.rows[0];

    // Update status to cancelled
    const notes = cancellation_reason 
      ? `${existingAppointment.notes || ''}\n[Cancelled: ${cancellation_reason}]`.trim()
      : existingAppointment.notes;

    const result = await db.query(
      'UPDATE appointments SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['cancelled', notes, id]
    );

    const cancelledAppointment = result.rows[0];

    // Trigger webhook event
    try {
      await webhookService.deliverWebhookEvent('appointment.cancelled', {
        appointment_id: cancelledAppointment.id,
        patient_name: cancelledAppointment.patient_name,
        cancellation_reason,
        organization_id: orgId
      }, orgId);
    } catch (webhookError) {
      console.error('Error delivering appointment.cancelled webhook:', webhookError);
    }

    res.json({ appointment: cancelledAppointment, message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ message: 'Error cancelling appointment', error: error.message });
  }
});

// Send reminder for appointment
router.post('/:id/send-reminder', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { method = 'both' } = req.body; // 'sms', 'email', or 'both'
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const orgId = orgResult.rows[0]?.organization_id || null;

    // Get appointment
    let query = 'SELECT * FROM appointments WHERE id = $1';
    const params = [id];
    if (orgId) {
      query += ` AND conversation_id IN (SELECT id FROM conversations WHERE user_id IN (SELECT id FROM users WHERE organization_id = $2))`;
      params.push(orgId);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const appointment = result.rows[0];

    if (appointment.status !== 'scheduled') {
      return res.status(400).json({ message: 'Can only send reminders for scheduled appointments' });
    }

    // Send reminders
    const reminderResults = await reminderService.sendAppointmentReminder(appointment, method, orgId);

    // Check if any reminder failed
    const allSuccessful = reminderResults.every(result => result.success);
    const allFailed = reminderResults.every(result => !result.success);

    if (allFailed) {
      return res.status(400).json({
        message: 'All reminder attempts failed',
        results: reminderResults
      });
    }

    res.json({
      message: allSuccessful ? 'Reminders sent successfully' : 'Some reminders sent with errors',
      results: reminderResults
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Error sending reminder', error: error.message });
  }
});

module.exports = router;

