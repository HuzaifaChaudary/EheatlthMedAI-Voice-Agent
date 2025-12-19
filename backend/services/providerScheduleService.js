/**
 * Provider Schedule Integration Service
 * Integrates with provider call schedules to determine availability
 */

const db = require('../config/database');

class ProviderScheduleService {
  /**
   * Get available providers for urgent/emergent cases
   */
  async getAvailableProviders(organizationId, urgencyLevel, preferredTime = null) {
    try {
      // Get active provider schedules
      const result = await db.query(
        'SELECT * FROM provider_call_schedules WHERE organization_id = $1 AND is_active = true',
        [organizationId]
      );

      const providers = result.rows.map(provider => {
        const scheduleData = typeof provider.schedule_data === 'string' 
          ? JSON.parse(provider.schedule_data) 
          : provider.schedule_data;

        return {
          id: provider.id,
          name: provider.provider_name,
          phone: provider.provider_phone,
          email: provider.provider_email,
          type: provider.provider_type,
          schedule: scheduleData,
          is_available_now: this.isProviderAvailableNow(scheduleData, provider.timezone),
          next_available: this.getNextAvailableTime(scheduleData, provider.timezone)
        };
      });

      // Filter by urgency level requirements
      const availableProviders = providers.filter(provider => {
        if (urgencyLevel === 'critical' || urgencyLevel === 'emergent') {
          // For critical/emergent, return on-call providers or those available now
          return provider.type === 'on_call' || provider.is_available_now;
        } else {
          // For urgent/routine, return any available provider
          return provider.is_available_now || provider.next_available;
        }
      });

      return availableProviders;
    } catch (error) {
      console.error('Error getting available providers:', error);
      return [];
    }
  }

  /**
   * Check if provider is available now
   */
  isProviderAvailableNow(scheduleData, timezone) {
    try {
      const now = new Date();
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      // Check if provider has schedule for today
      if (!scheduleData.days || !Array.isArray(scheduleData.days)) {
        return false;
      }

      const todaySchedule = scheduleData.days.find(day => 
        day.day.toLowerCase() === dayOfWeek || day.day.toLowerCase() === 'daily'
      );

      if (!todaySchedule) {
        return false;
      }

      // Check if current time is within available hours
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      if (todaySchedule.hours) {
        const [startHour, startMinute] = todaySchedule.hours.start.split(':').map(Number);
        const [endHour, endMinute] = todaySchedule.hours.end.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
      }

      return true;
    } catch (error) {
      console.error('Error checking provider availability:', error);
      return false;
    }
  }

  /**
   * Get next available time for provider
   */
  getNextAvailableTime(scheduleData, timezone) {
    try {
      const now = new Date();
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      if (!scheduleData.days || !Array.isArray(scheduleData.days)) {
        return null;
      }

      // Find today's schedule
      const todaySchedule = scheduleData.days.find(day => 
        day.day.toLowerCase() === dayOfWeek || day.day.toLowerCase() === 'daily'
      );

      if (todaySchedule && todaySchedule.hours) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const [endHour, endMinute] = todaySchedule.hours.end.split(':').map(Number);
        
        // If still within today's hours, return today
        if (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
          return `Today at ${todaySchedule.hours.start}`;
        }
      }

      // Find next available day
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayIndex = daysOfWeek.indexOf(dayOfWeek);
      
      for (let i = 1; i <= 7; i++) {
        const nextDayIndex = (currentDayIndex + i) % 7;
        const nextDay = daysOfWeek[nextDayIndex];
        
        const nextDaySchedule = scheduleData.days.find(day => 
          day.day.toLowerCase() === nextDay || day.day.toLowerCase() === 'daily'
        );

        if (nextDaySchedule && nextDaySchedule.hours) {
          return `${nextDay.charAt(0).toUpperCase() + nextDay.slice(1)} at ${nextDaySchedule.hours.start}`;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting next available time:', error);
      return null;
    }
  }

  /**
   * Connect triage case to provider schedule
   */
  async connectToProviderSchedule(triageAssessmentId, providerId, organizationId) {
    try {
      // Update triage assessment with provider schedule ID
      await db.query(
        'UPDATE triage_assessments SET provider_schedule_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [providerId, triageAssessmentId]
      );

      // Get provider info
      const providerResult = await db.query(
        'SELECT * FROM provider_call_schedules WHERE id = $1',
        [providerId]
      );

      if (providerResult.rows.length === 0) {
        throw new Error('Provider not found');
      }

      const provider = providerResult.rows[0];

      return {
        provider_id: providerId,
        provider_name: provider.provider_name,
        provider_phone: provider.provider_phone,
        provider_email: provider.provider_email,
        next_available: this.getNextAvailableTime(
          typeof provider.schedule_data === 'string' ? JSON.parse(provider.schedule_data) : provider.schedule_data,
          provider.timezone
        )
      };
    } catch (error) {
      console.error('Error connecting to provider schedule:', error);
      throw error;
    }
  }

  /**
   * Get provider schedule functions for OpenAI function calling
   */
  getProviderScheduleFunctions() {
    return [
      {
        name: 'get_available_providers',
        description: 'Get available healthcare providers for scheduling appointments or urgent consultations. Use this when a patient needs to see a provider based on triage assessment.',
        parameters: {
          type: 'object',
          properties: {
            urgency_level: {
              type: 'string',
              description: 'Urgency level (critical, emergent, urgent, routine)',
              enum: ['critical', 'emergent', 'urgent', 'routine']
            },
            preferred_time: {
              type: 'string',
              description: 'Preferred time for appointment (ISO 8601 format)'
            }
          }
        }
      },
      {
        name: 'connect_to_provider',
        description: 'Connect a triage assessment to a provider schedule for follow-up care.',
        parameters: {
          type: 'object',
          properties: {
            provider_id: {
              type: 'number',
              description: 'ID of the provider to connect to'
            }
          },
          required: ['provider_id']
        }
      }
    ];
  }
}

module.exports = new ProviderScheduleService();

