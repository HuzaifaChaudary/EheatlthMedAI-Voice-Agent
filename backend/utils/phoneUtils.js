/**
 * Phone Number Utilities
 * Handles phone number normalization and formatting
 */

/**
 * Normalize phone number to E.164 format
 * @param {string} phoneNumber - Phone number in any format
 * @returns {string} - Normalized phone number in E.164 format (e.g., +14047387870)
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove all non-digit characters except +
  let normalized = phoneNumber.toString().replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume US number and add +1
  if (!normalized.startsWith('+')) {
    // Remove leading 1 if present
    if (normalized.startsWith('1') && normalized.length === 11) {
      normalized = '+' + normalized;
    } else if (normalized.length === 10) {
      // US number without country code
      normalized = '+1' + normalized;
    } else {
      // Try to add +1 if it looks like a US number
      normalized = '+1' + normalized;
    }
  }
  
  return normalized;
}

/**
 * Normalize phone number for database comparison
 * Handles multiple formats and returns E.164 format
 * @param {string} phoneNumber - Phone number in any format
 * @returns {string} - Normalized phone number
 */
function normalizeForComparison(phoneNumber) {
  return normalizePhoneNumber(phoneNumber);
}

/**
 * Format phone number for display
 * @param {string} phoneNumber - Phone number in E.164 format
 * @returns {string} - Formatted phone number (e.g., (404) 738-7870)
 */
function formatForDisplay(phoneNumber) {
  if (!phoneNumber) return '';
  
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Remove +1 if present
  let digits = normalized.replace(/^\+1/, '');
  
  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
  }
  
  return normalized;
}

/**
 * Check if two phone numbers match (normalized comparison)
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} - True if numbers match
 */
function phoneNumbersMatch(phone1, phone2) {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  return normalized1 === normalized2;
}

module.exports = {
  normalizePhoneNumber,
  normalizeForComparison,
  formatForDisplay,
  phoneNumbersMatch
};
