/**
 * Global error handling for Firebase operations
 * Provides consistent error logging and user feedback
 */

/**
 * Error types for categorization
 */
export const ErrorTypes = {
  AUTH: 'auth',
  NETWORK: 'network',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
};

/**
 * Firebase error code mappings to user-friendly messages
 */
const ERROR_MESSAGES = {
  // Auth errors
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password should be at least 6 characters',
  'auth/invalid-email': 'Invalid email address',
  'auth/user-disabled': 'This account has been disabled',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/popup-closed-by-user': 'Sign-in was cancelled',
  
  // Firestore errors
  'permission-denied': 'You do not have permission to perform this action',
  'not-found': 'The requested resource was not found',
  'already-exists': 'This resource already exists',
  'unavailable': 'Service is currently unavailable',
  'deadline-exceeded': 'Request took too long to complete',
  
  // Network errors
  'network-request-failed': 'Network error. Please check your connection',
  'failed-precondition': 'Operation failed due to current state'
};

/**
 * Categorize Firebase error
 * @param {Error} error - The error object
 * @returns {string} Error type
 */
function categorizeError(error) {
  if (!error) return ErrorTypes.UNKNOWN;
  
  const code = error.code || '';
  const message = error.message || '';
  
  if (code.startsWith('auth/') || message.includes('auth')) {
    return ErrorTypes.AUTH;
  }
  if (code.includes('network') || message.includes('network') || message.includes('fetch')) {
    return ErrorTypes.NETWORK;
  }
  if (code.includes('permission') || message.includes('permission')) {
    return ErrorTypes.PERMISSION;
  }
  if (code.includes('invalid') || message.includes('invalid')) {
    return ErrorTypes.VALIDATION;
  }
  
  return ErrorTypes.UNKNOWN;
}

/**
 * Get user-friendly error message
 * @param {Error} error - The error object
 * @returns {string} User-friendly message
 */
export function getUserMessage(error) {
  if (!error) return 'An unknown error occurred';
  
  const code = error.code || '';
  const message = error.message || '';
  
  // Check for known error codes
  if (ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  
  // Check for known error messages
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase()) || 
        message.toLowerCase().includes(value.toLowerCase())) {
      return value;
    }
  }
  
  // Return generic message based on error type
  const type = categorizeError(error);
  switch (type) {
    case ErrorTypes.AUTH:
      return 'Authentication error. Please try again';
    case ErrorTypes.NETWORK:
      return 'Network error. Please check your connection';
    case ErrorTypes.PERMISSION:
      return 'You do not have permission for this action';
    case ErrorTypes.VALIDATION:
      return 'Invalid input. Please check your data';
    default:
      return 'An error occurred. Please try again';
  }
}

/**
 * Log error to console with context
 * @param {Error} error - The error object
 * @param {string} context - Additional context about where error occurred
 * @param {Object} data - Additional data to log
 */
export function logError(error, context = '', data = {}) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    context,
    type: categorizeError(error),
    code: error?.code,
    message: error?.message,
    stack: error?.stack,
    data
  };
  
  console.error('[SnapVerse Error]', errorInfo);
  
  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or Firebase Crashlytics
  if (typeof window !== 'undefined' && window.__firebaseApp) {
    // Example: Could integrate with Firebase Crashlytics here
  }
}

/**
 * Handle Firebase error with logging and user feedback
 * @param {Error} error - The error object
 * @param {string} context - Context about the operation
 * @param {Function} showToast - Function to show toast notification
 * @param {Object} data - Additional data for logging
 */
export function handleFirebaseError(error, context = '', showToast = null, data = {}) {
  logError(error, context, data);
  
  const userMessage = getUserMessage(error);
  
  if (showToast && typeof showToast === 'function') {
    showToast(userMessage, 'error');
  }
  
  return userMessage;
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @param {Function} showToast - Toast notification function
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context = '', showToast = null) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleFirebaseError(error, context, showToast, { args });
      throw error;
    }
  };
}

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandler(showToast = null) {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('error', (event) => {
    logError(event.error, 'Global error handler');
    if (showToast) {
      showToast('An unexpected error occurred', 'error');
    }
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, 'Unhandled promise rejection');
    if (showToast) {
      showToast('An operation failed', 'error');
    }
  });
}
