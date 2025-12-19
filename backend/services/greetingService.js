/**
 * Greeting Service
 * Generates dynamic greetings based on time of day and business hours
 */

class GreetingService {
  /**
   * Get time-based greeting (Good morning, Good afternoon, Good evening)
   */
  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good evening';
    } else {
      return 'Hello';
    }
  }

  /**
   * Check if current time is within business hours
   */
  isWithinBusinessHours(businessHours, timezone = 'America/New_York') {
    if (!businessHours || typeof businessHours !== 'object') {
      return true; // If no business hours configured, assume always open
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // Convert to minutes

    // Check if today has business hours
    const todayHours = businessHours[currentDay];
    if (!todayHours || !todayHours.open || todayHours.closed) {
      // Check if it's a weekend and weekend hours are configured
      const isWeekend = currentDay === 'saturday' || currentDay === 'sunday';
      if (isWeekend && businessHours.weekend) {
        return this.checkTimeRange(currentTime, businessHours.weekend);
      }
      return false; // Closed today
    }

    return this.checkTimeRange(currentTime, todayHours);
  }

  /**
   * Check if current time is within a time range
   */
  checkTimeRange(currentTime, hours) {
    if (!hours.open_time || !hours.close_time) {
      return true; // If no specific times, assume open
    }

    const openTime = this.timeToMinutes(hours.open_time);
    const closeTime = this.timeToMinutes(hours.close_time);

    // Handle overnight hours (e.g., 22:00 - 02:00)
    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Convert time string (HH:MM) to minutes
   */
  timeToMinutes(timeString) {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }

  /**
   * Generate greeting message based on business hours and time
   */
  generateGreeting(businessHours, patientName = null, isOutsideHours = false) {
    const timeGreeting = this.getTimeBasedGreeting();
    let greeting = timeGreeting;

    if (patientName) {
      greeting += `, ${patientName}`;
    }

    if (isOutsideHours) {
      greeting += '. We are currently outside our business hours, but I\'m here to help you';
    } else {
      greeting += '! How can I help you today?';
    }

    return greeting;
  }

  /**
   * Get business hours message
   */
  getBusinessHoursMessage(businessHours) {
    if (!businessHours || typeof businessHours !== 'object') {
      return 'Our business hours vary. Please contact us for more information.';
    }

    const dayNames = {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday'
    };

    let message = 'Our business hours are:\n';
    let hasHours = false;

    for (const [day, hours] of Object.entries(businessHours)) {
      if (day === 'weekend' || day === 'timezone') continue;
      
      if (hours && hours.open_time && hours.close_time) {
        message += `${dayNames[day] || day}: ${hours.open_time} - ${hours.close_time}\n`;
        hasHours = true;
      }
    }

    if (!hasHours && businessHours.weekend) {
      message += `Weekend: ${businessHours.weekend.open_time || 'Closed'} - ${businessHours.weekend.close_time || 'Closed'}\n`;
    }

    return hasHours ? message.trim() : 'Our business hours vary. Please contact us for more information.';
  }

  /**
   * Build greeting context for AI system prompt
   */
  buildGreetingContext(agentConfig) {
    const businessHours = agentConfig.business_hours || null;
    const isWithinHours = this.isWithinBusinessHours(businessHours);
    const timeGreeting = this.getTimeBasedGreeting();
    const businessHoursMessage = this.getBusinessHoursMessage(businessHours);

    return {
      timeGreeting,
      isWithinBusinessHours: isWithinHours,
      businessHoursMessage,
      currentTime: new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: businessHours?.timezone || 'America/New_York'
      })
    };
  }
}

module.exports = new GreetingService();

