/**
 * FAQ Service
 * Handles FAQ/knowledge base for common questions (hours, directions, services)
 */

const db = require('../config/database');

class FAQService {
  /**
   * Get FAQ entries for an organization
   */
  async getFAQs(organizationId, category = null) {
    try {
      let query = `
        SELECT id, question, answer, category, priority, is_active
        FROM faq_knowledge_base
        WHERE organization_id = $1 AND is_active = true
      `;
      const params = [organizationId];

      if (category) {
        query += ` AND category = $2`;
        params.push(category);
      }

      query += ` ORDER BY priority DESC, question ASC`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      throw error;
    }
  }

  /**
   * Get FAQ by category (hours, directions, services)
   */
  async getFAQByCategory(organizationId, category) {
    const validCategories = ['hours', 'directions', 'services', 'general'];
    if (!validCategories.includes(category)) {
      throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    return await this.getFAQs(organizationId, category);
  }

  /**
   * Search FAQs by keyword
   */
  async searchFAQs(organizationId, keyword) {
    try {
      const query = `
        SELECT id, question, answer, category, priority
        FROM faq_knowledge_base
        WHERE organization_id = $1 
        AND is_active = true
        AND (
          question ILIKE $2 
          OR answer ILIKE $2
        )
        ORDER BY priority DESC, question ASC
      `;
      const params = [organizationId, `%${keyword}%`];

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error searching FAQs:', error);
      throw error;
    }
  }

  /**
   * Get answer for a specific question
   */
  async getAnswer(organizationId, question) {
    try {
      // First try exact match
      let result = await db.query(
        `SELECT answer, category FROM faq_knowledge_base
         WHERE organization_id = $1 
         AND question ILIKE $2 
         AND is_active = true
         ORDER BY priority DESC
         LIMIT 1`,
        [organizationId, question]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Then try keyword search
      const searchResults = await this.searchFAQs(organizationId, question);
      if (searchResults.length > 0) {
        return searchResults[0];
      }

      return null;
    } catch (error) {
      console.error('Error getting FAQ answer:', error);
      throw error;
    }
  }

  /**
   * Get formatted business hours answer
   */
  async getBusinessHoursAnswer(organizationId) {
    try {
      const hoursFAQs = await this.getFAQByCategory(organizationId, 'hours');
      
      if (hoursFAQs.length > 0) {
        return hoursFAQs[0].answer;
      }

      // Fallback: get from agent configuration
      const agentResult = await db.query(
        `SELECT business_hours FROM ai_agents
         WHERE organization_id = $1 
         AND type = 'front_desk' 
         AND is_active = true
         LIMIT 1`,
        [organizationId]
      );

      if (agentResult.rows.length > 0 && agentResult.rows[0].business_hours) {
        const businessHours = agentResult.rows[0].business_hours;
        const greetingService = require('./greetingService');
        return greetingService.getBusinessHoursMessage(businessHours);
      }

      return 'Please contact us for our current business hours.';
    } catch (error) {
      console.error('Error getting business hours answer:', error);
      return 'Please contact us for our current business hours.';
    }
  }

  /**
   * Get directions answer
   */
  async getDirectionsAnswer(organizationId) {
    try {
      const directionsFAQs = await this.getFAQByCategory(organizationId, 'directions');
      
      if (directionsFAQs.length > 0) {
        return directionsFAQs[0].answer;
      }

      // Fallback: get from organization address
      const orgResult = await db.query(
        `SELECT address, city, state, zip_code FROM organizations WHERE id = $1`,
        [organizationId]
      );

      if (orgResult.rows.length > 0) {
        const org = orgResult.rows[0];
        if (org.address) {
          const addressParts = [org.address, org.city, org.state, org.zip_code].filter(Boolean);
          return `We are located at ${addressParts.join(', ')}. For detailed directions, please use a mapping service like Google Maps or contact us directly.`;
        }
      }

      return 'Please contact us for directions to our location.';
    } catch (error) {
      console.error('Error getting directions answer:', error);
      return 'Please contact us for directions to our location.';
    }
  }

  /**
   * Get services answer
   */
  async getServicesAnswer(organizationId) {
    try {
      const servicesFAQs = await this.getFAQByCategory(organizationId, 'services');
      
      if (servicesFAQs.length > 0) {
        return servicesFAQs[0].answer;
      }

      return 'Please contact us to learn about our services. We offer a wide range of medical services to meet your healthcare needs.';
    } catch (error) {
      console.error('Error getting services answer:', error);
      return 'Please contact us to learn about our services.';
    }
  }

  /**
   * Build FAQ context for AI system prompt
   */
  async buildFAQContext(organizationId) {
    try {
      const [hours, directions, services] = await Promise.all([
        this.getBusinessHoursAnswer(organizationId),
        this.getDirectionsAnswer(organizationId),
        this.getServicesAnswer(organizationId)
      ]);

      return {
        hours,
        directions,
        services,
        faqAvailable: true
      };
    } catch (error) {
      console.error('Error building FAQ context:', error);
      return {
        hours: 'Please contact us for our current business hours.',
        directions: 'Please contact us for directions to our location.',
        services: 'Please contact us to learn about our services.',
        faqAvailable: false
      };
    }
  }
}

module.exports = new FAQService();

