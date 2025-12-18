/**
 * HL7 Service - Handles HL7 message parsing and generation
 * Supports HL7 v2.x message formats
 */

class HL7Service {
  constructor() {
    this.segmentDelimiter = '\r';
    this.fieldDelimiter = '|';
    this.componentDelimiter = '^';
    this.repetitionDelimiter = '~';
    this.escapeDelimiter = '\\';
  }

  /**
   * Parse HL7 message string into structured object
   */
  parseMessage(messageString) {
    try {
      const segments = messageString
        .split(this.segmentDelimiter)
        .filter(seg => seg.trim().length > 0)
        .map(seg => this.parseSegment(seg));

      const mshSegment = segments.find(seg => seg.name === 'MSH');
      if (!mshSegment) {
        throw new Error('MSH segment is required in HL7 message');
      }

      return {
        messageType: mshSegment.fields[8]?.components?.[0] || null,
        messageControlId: mshSegment.fields[9] || null,
        timestamp: mshSegment.fields[6] || null,
        sendingApplication: mshSegment.fields[2] || null,
        sendingFacility: mshSegment.fields[3] || null,
        receivingApplication: mshSegment.fields[4] || null,
        receivingFacility: mshSegment.fields[5] || null,
        version: mshSegment.fields[11] || null,
        segments: segments
      };
    } catch (error) {
      console.error('Error parsing HL7 message:', error);
      throw new Error(`Failed to parse HL7 message: ${error.message}`);
    }
  }

  /**
   * Parse a single HL7 segment
   */
  parseSegment(segmentString) {
    const fields = segmentString.split(this.fieldDelimiter);
    const segmentName = fields[0];

    const parsedFields = fields.slice(1).map((field, index) => {
      if (!field || field.trim() === '') return null;

      // Check if field contains components
      if (field.includes(this.componentDelimiter)) {
        const components = field.split(this.componentDelimiter);
        return {
          value: field,
          components: components.map(comp => comp.split(this.repetitionDelimiter))
        };
      }

      // Check if field contains repetitions
      if (field.includes(this.repetitionDelimiter)) {
        return {
          value: field,
          repetitions: field.split(this.repetitionDelimiter)
        };
      }

      return { value: field };
    });

    return {
      name: segmentName,
      fields: parsedFields
    };
  }

  /**
   * Generate HL7 message from structured data
   */
  generateMessage(messageData) {
    try {
      const { messageType, messageControlId, sendingApplication, sendingFacility, 
              receivingApplication, receivingFacility, version, segments } = messageData;

      // Generate MSH segment
      const mshFields = [
        'MSH',
        this.fieldDelimiter,
        this.componentDelimiter,
        sendingApplication || '',
        sendingFacility || '',
        receivingApplication || '',
        receivingFacility || '',
        new Date().toISOString().replace(/[-:]/g, '').split('.')[0],
        messageType || 'ADT^A01',
        messageControlId || this.generateControlId(),
        '',
        '',
        version || '2.8'
      ];

      const mshSegment = mshFields.join(this.fieldDelimiter);

      // Generate other segments
      const otherSegments = segments
        .filter(seg => seg.name !== 'MSH')
        .map(seg => this.generateSegment(seg));

      return [mshSegment, ...otherSegments].join(this.segmentDelimiter);
    } catch (error) {
      console.error('Error generating HL7 message:', error);
      throw new Error(`Failed to generate HL7 message: ${error.message}`);
    }
  }

  /**
   * Generate a single HL7 segment
   */
  generateSegment(segmentData) {
    const { name, fields } = segmentData;
    const segmentFields = [name];

    fields.forEach(field => {
      if (!field) {
        segmentFields.push('');
      } else if (field.components) {
        segmentFields.push(
          field.components.map(comp => 
            Array.isArray(comp) ? comp.join(this.repetitionDelimiter) : comp
          ).join(this.componentDelimiter)
        );
      } else if (field.repetitions) {
        segmentFields.push(field.repetitions.join(this.repetitionDelimiter));
      } else {
        segmentFields.push(field.value || '');
      }
    });

    return segmentFields.join(this.fieldDelimiter);
  }

  /**
   * Generate HL7 ADT (Admit/Discharge/Transfer) message for appointment
   */
  generateADTMessage(appointmentData) {
    const { patientName, patientId, dob, gender, appointmentDate, appointmentType, 
            sendingFacility, receivingFacility } = appointmentData;

    const messageControlId = this.generateControlId();
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];

    const segments = [
      // PID - Patient Identification
      {
        name: 'PID',
        fields: [
          { value: '1' }, // Set ID
          { value: '' }, // Patient ID (External)
          { components: [[patientId || ''], [''], [''], [''], [''], ['PI']] }, // Patient ID (Internal)
          { value: '' }, // Alternate Patient ID
          { components: [[patientName?.last || ''], [patientName?.first || ''], [patientName?.middle || '']] }, // Patient Name
          { value: '' }, // Mother's Maiden Name
          { value: dob || '' }, // Date of Birth
          { value: gender || 'U' }, // Sex
          { value: '' }, // Patient Alias
          { value: '' }, // Race
          { value: '' }, // Patient Address
          { value: '' }, // County Code
          { value: '' }, // Phone Number Home
          { value: '' }, // Phone Number Business
          { value: '' }, // Primary Language
          { value: '' }, // Marital Status
          { value: '' }, // Religion
          { value: '' }, // Patient Account Number
          { value: '' }, // SSN
          { value: '' }, // Driver's License Number
          { value: '' }, // Mother's Identifier
          { value: '' }, // Ethnic Group
          { value: '' }, // Birth Place
          { value: '' }, // Multiple Birth Indicator
          { value: '' }, // Birth Order
          { value: '' }, // Citizenship
          { value: '' }, // Veterans Military Status
          { value: '' }, // Nationality
          { value: '' }, // Patient Death Date and Time
          { value: '' }, // Patient Death Indicator
          { value: '' }  // Identity Unknown Indicator
        ]
      },
      // PV1 - Patient Visit
      {
        name: 'PV1',
        fields: [
          { value: '1' }, // Set ID
          { value: 'O' }, // Patient Class (O=Outpatient)
          { components: [['']] }, // Assigned Patient Location
          { value: 'N' }, // Admission Type
          { value: '' }, // Preadmit Number
          { components: [['']] }, // Prior Patient Location
          { value: '' }, // Attending Doctor
          { value: '' }, // Referring Doctor
          { value: '' }, // Consulting Doctor
          { value: '' }, // Hospital Service
          { value: '' }, // Temporary Location
          { value: '' }, // Preadmit Test Indicator
          { value: '' }, // Re-admission Indicator
          { value: '' }, // Admit Source
          { value: '' }, // Ambulatory Status
          { value: 'N' }, // VIP Indicator
          { value: '' }, // Admitting Doctor
          { value: '' }, // Patient Type
          { value: '' }, // Visit Number
          { value: '' }, // Financial Class
          { value: '' }, // Charge Price Indicator
          { value: '' }, // Courtesy Code
          { value: '' }, // Credit Rating
          { value: '' }, // Contract Code
          { value: '' }, // Contract Effective Date
          { value: '' }, // Contract Amount
          { value: '' }, // Contract Period
          { value: '' }, // Interest Code
          { value: '' }, // Transfer to Bad Debt Code
          { value: '' }, // Transfer to Bad Debt Date
          { value: '' }, // Bad Debt Agency Code
          { value: '' }, // Bad Debt Transfer Amount
          { value: '' }, // Bad Debt Recovery Amount
          { value: '' }, // Delete Account Indicator
          { value: '' }, // Delete Account Date
          { value: '' }, // Discharge Disposition
          { value: '' }, // Discharged to Location
          { value: '' }, // Diet Type
          { value: '' }, // Servicing Facility
          { value: '' }, // Bed Status
          { value: '' }, // Account Status
          { value: '' }, // Pending Location
          { value: '' }, // Prior Temporary Location
          { value: '' }, // Admit Date/Time
          { value: '' }, // Discharge Date/Time
          { value: '' }, // Current Patient Balance
          { value: '' }, // Total Charges
          { value: '' }, // Total Adjustments
          { value: '' }, // Total Payments
          { value: '' }, // Alternate Visit ID
          { value: '' }, // Visit Indicator
          { value: '' }, // Other Healthcare Provider
          { value: appointmentDate || timestamp } // Service Episode Date/Time
        ]
      },
      // SCH - Scheduling Information
      {
        name: 'SCH',
        fields: [
          { value: '1' }, // Placer Appointment ID
          { value: '' }, // Filler Appointment ID
          { value: appointmentType || 'ROUTINE' }, // Occurrence Number
          { components: [[appointmentDate || timestamp], ['']] }, // Placer Group Number
          { value: '' }, // Schedule ID
          { value: '' }, // Event Reason
          { value: '' }, // Appointment Reason
          { value: '' }, // Appointment Type
          { value: '' }, // Appointment Duration
          { value: '' }, // Appointment Duration Units
          { value: '' }, // Appointment Timing Quantity
          { value: '' }, // Placer Contact Person
          { value: '' }, // Placer Contact Phone
          { value: '' }, // Placer Contact Address
          { value: '' }, // Placer Contact Location
          { value: '' }, // Filler Contact Person
          { value: '' }, // Filler Contact Phone
          { value: '' }, // Filler Contact Address
          { value: '' }, // Filler Contact Location
          { value: '' }, // Entered By Person
          { value: '' }, // Entered By Phone Number
          { value: '' }, // Entered By Location
          { value: '' }, // Parent Placer Appointment ID
          { value: '' }, // Parent Filler Appointment ID
          { value: '' }, // Filler Status Code
          { value: '' }, // Placer Order Number
          { value: '' }, // Filler Order Number
          { value: '' }  // Placer Group Number
        ]
      }
    ];

    return this.generateMessage({
      messageType: 'ADT^A04',
      messageControlId,
      sendingApplication: 'EHEALTH_MED_AI',
      sendingFacility: sendingFacility || 'EHEALTH',
      receivingApplication: receivingFacility || 'EHR_SYSTEM',
      receivingFacility: receivingFacility || 'EHR_SYSTEM',
      version: '2.8',
      segments
    });
  }

  /**
   * Generate unique control ID for HL7 message
   */
  generateControlId() {
    return `MSG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Send HL7 message to endpoint
   */
  async sendMessage(messageString, connector) {
    try {
      const { endpoint_url, authentication_type, credentials } = connector;
      const headers = {
        'Content-Type': 'application/hl7-v2',
        'Content-Length': Buffer.byteLength(messageString, 'utf8').toString()
      };

      // Add authentication headers
      if (authentication_type === 'basic' && credentials) {
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      } else if (authentication_type === 'bearer' && credentials?.token) {
        headers['Authorization'] = `Bearer ${credentials.token}`;
      }

      const response = await fetch(endpoint_url, {
        method: 'POST',
        headers,
        body: messageString
      });

      if (!response.ok) {
        throw new Error(`HL7 endpoint returned status ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      return {
        success: true,
        statusCode: response.status,
        response: responseText,
        message: 'HL7 message sent successfully'
      };
    } catch (error) {
      console.error('Error sending HL7 message:', error);
      throw new Error(`Failed to send HL7 message: ${error.message}`);
    }
  }
}

module.exports = new HL7Service();

