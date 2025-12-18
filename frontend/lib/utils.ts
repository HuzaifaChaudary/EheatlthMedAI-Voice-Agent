/**
 * Utility functions for secure operations
 */

/**
 * Debounce function for rate limiting
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Get client IP (if available)
 */
export function getClientInfo(): { userAgent: string; language: string } {
  if (!isBrowser()) {
    return { userAgent: '', language: 'en' }
  }

  return {
    userAgent: navigator.userAgent,
    language: navigator.language || 'en'
  }
}

