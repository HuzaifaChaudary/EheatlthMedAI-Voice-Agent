const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get user's organization
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0]?.organization_id || null;
    const { start_date, end_date } = req.query;

    // Get call statistics
    let callStatsQuery;
    const params = [];
    
    if (orgId) {
      callStatsQuery = `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
          SUM(duration_seconds) as total_duration,
          AVG(duration_seconds) as avg_duration,
          SUM(cost) as total_cost
        FROM call_logs
        WHERE organization_id = $1
      `;
      params.push(orgId);
    } else {
      callStatsQuery = `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
          SUM(duration_seconds) as total_duration,
          AVG(duration_seconds) as avg_duration,
          SUM(cost) as total_cost
        FROM call_logs
        WHERE organization_id IS NULL
      `;
    }

    const paramOffset = params.length;
    if (start_date) {
      params.push(start_date);
      callStatsQuery += ` AND started_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      callStatsQuery += ` AND started_at <= $${params.length}`;
    }

    let callStats;
    try {
      callStats = await db.query(callStatsQuery, params);
    } catch (queryError) {
      console.error('Error querying call_logs table:', queryError.message);
      // If table doesn't exist or query fails, return empty stats
      callStats = { rows: [{
        total_calls: 0,
        completed_calls: 0,
        failed_calls: 0,
        total_duration: null,
        avg_duration: null,
        total_cost: null
      }] };
    }

    // Get agent performance
    let agentPerformance;
    try {
      if (orgId) {
        agentPerformance = await db.query(
          `SELECT 
            aa.id, aa.name, aa.type,
            COUNT(cl.id) as total_calls,
            COUNT(cl.id) FILTER (WHERE cl.status = 'completed') as completed_calls,
            AVG(cl.duration_seconds) as avg_duration,
            AVG(cl.cost) as avg_cost
          FROM ai_agents aa
          LEFT JOIN call_logs cl ON aa.id = cl.agent_id AND cl.organization_id = $1
          WHERE aa.organization_id = $1
          GROUP BY aa.id, aa.name, aa.type
          ORDER BY total_calls DESC`,
          [orgId]
        );
      } else {
        agentPerformance = await db.query(
          `SELECT 
            aa.id, aa.name, aa.type,
            COUNT(cl.id) as total_calls,
            COUNT(cl.id) FILTER (WHERE cl.status = 'completed') as completed_calls,
            AVG(cl.duration_seconds) as avg_duration,
            AVG(cl.cost) as avg_cost
          FROM ai_agents aa
          LEFT JOIN call_logs cl ON aa.id = cl.agent_id AND cl.organization_id IS NULL
          WHERE aa.organization_id IS NULL
          GROUP BY aa.id, aa.name, aa.type
          ORDER BY total_calls DESC`
        );
      }
    } catch (queryError) {
      console.error('Error querying agent performance:', queryError.message);
      agentPerformance = { rows: [] };
    }

    // Get recent calls
    let recentCalls;
    if (orgId) {
      recentCalls = await db.query(
        `SELECT cl.*, aa.name as agent_name, pn.phone_number
         FROM call_logs cl
         LEFT JOIN ai_agents aa ON cl.agent_id = aa.id
         LEFT JOIN phone_numbers pn ON cl.phone_number_id = pn.id
         WHERE cl.organization_id = $1
         ORDER BY cl.started_at DESC
         LIMIT 10`,
        [orgId]
      );
    } else {
      recentCalls = await db.query(
        `SELECT cl.*, aa.name as agent_name, pn.phone_number
         FROM call_logs cl
         LEFT JOIN ai_agents aa ON cl.agent_id = aa.id
         LEFT JOIN phone_numbers pn ON cl.phone_number_id = pn.id
         WHERE cl.organization_id IS NULL
         ORDER BY cl.started_at DESC
         LIMIT 10`
      );
    }

    // Get daily call volume (last 30 days)
    let dailyVolume;
    try {
      if (orgId) {
        dailyVolume = await db.query(
          `SELECT 
            DATE(started_at) as date,
            COUNT(*) as call_count,
            SUM(duration_seconds) as total_duration
          FROM call_logs
          WHERE organization_id = $1
            AND started_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY DATE(started_at)
          ORDER BY date DESC`,
          [orgId]
        );
      } else {
        dailyVolume = await db.query(
          `SELECT 
            DATE(started_at) as date,
            COUNT(*) as call_count,
            SUM(duration_seconds) as total_duration
          FROM call_logs
          WHERE organization_id IS NULL
            AND started_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY DATE(started_at)
          ORDER BY date DESC`
        );
      }
    } catch (queryError) {
      console.error('Error querying daily volume:', queryError.message);
      dailyVolume = { rows: [] };
    }

    res.json({
      call_stats: callStats.rows[0] || {
        total_calls: 0,
        completed_calls: 0,
        failed_calls: 0,
        total_duration: 0,
        avg_duration: 0,
        total_cost: 0
      },
      agent_performance: agentPerformance.rows || [],
      recent_calls: [],
      daily_volume: dailyVolume.rows || []
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.json({
      call_stats: {
        total_calls: 0,
        completed_calls: 0,
        failed_calls: 0,
        total_duration: 0,
        avg_duration: 0,
        total_cost: 0
      },
      agent_performance: [],
      recent_calls: [],
      daily_volume: []
    });
  }
});

// Get call metrics by date range
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const orgResult = await db.query(
      'SELECT organization_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const orgId = orgResult.rows[0].organization_id;
    const { start_date, end_date, agent_id } = req.query;

    let query = `
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        AVG(duration_seconds) as avg_duration,
        SUM(cost) as total_cost
      FROM call_logs
      WHERE organization_id = $1
    `;
    const params = [orgId];

    if (start_date) {
      params.push(start_date);
      query += ` AND started_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND started_at <= $${params.length}`;
    }
    if (agent_id) {
      params.push(agent_id);
      query += ` AND agent_id = $${params.length}`;
    }

    query += ' GROUP BY DATE(started_at) ORDER BY date DESC';

    const result = await db.query(query, params);

    res.json({ metrics: result.rows });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error fetching metrics' });
  }
});

module.exports = router;

