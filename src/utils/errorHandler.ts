/**
 * Error handling utilities for standardized error processing
 * 
 * Provides consistent error message extraction and formatting across the application
 */

import { logger } from './logger';

/**
 * Error types that can occur in the application
 */
export type AppError = Error | Response | unknown;

/**
 * Extract user-friendly error message from various error types
 * 
 * @param error - Error object (Error, Response, or unknown)
 * @param defaultMessage - Default message if error cannot be parsed
 * @returns User-friendly error message
 */
export function getErrorMessage(error: AppError, defaultMessage: string = 'Възникна неочаквана грешка'): string {
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message;
    
    // Check for network errors
    if (isNetworkError(message)) {
      return 'Не може да се свърже със сървъра. Моля, проверете интернет връзката си.';
    }
    
    // Check for backend connection errors
    if (isBackendConnectionError(message)) {
      return 'Backend сървърът не е стартиран. Моля, стартирайте backend сървъра на порт 8000.';
    }
    
    // Return the error message if it's user-friendly
    if (message && message.trim().length > 0) {
      return message;
    }
  }
  
  // Handle Response objects
  if (error instanceof Response) {
    return getResponseErrorMessage(error, defaultMessage);
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle objects with message property
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message && message.trim().length > 0) {
      return message;
    }
  }
  
  // Handle objects with detail property (FastAPI format)
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = String((error as { detail: unknown }).detail);
    if (detail && detail.trim().length > 0) {
      return detail;
    }
  }
  
  // Fallback to default message
  return defaultMessage;
}

/**
 * Extract error message from Response object
 * 
 * @param response - Fetch Response object
 * @param defaultMessage - Default message if error cannot be parsed
 * @returns User-friendly error message
 */
export async function getResponseErrorMessage(
  response: Response,
  defaultMessage: string = 'Възникна грешка при заявката'
): Promise<string> {
  try {
    const contentType = response.headers.get('content-type');
    
    // Try to parse JSON response
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      
      // FastAPI error format: { detail: "message" }
      if (error.detail) {
        return String(error.detail);
      }
      
      // Generic error format: { error: "message" }
      if (error.error) {
        return String(error.error);
      }
      
      // Message property
      if (error.message) {
        return String(error.message);
      }
    }
    
    // Try to parse text response
    const text = await response.text();
    if (text && text.trim().length > 0) {
      return text;
    }
    
    // Use status text as fallback
    if (response.statusText) {
      return `${response.statusText} (${response.status})`;
    }
    
    // Use status code
    return `${defaultMessage} (HTTP ${response.status})`;
  } catch (parseError) {
    logger.error('Error parsing response error:', parseError);
    return `${defaultMessage} (HTTP ${response.status})`;
  }
}

/**
 * Check if error is a network error
 * 
 * @param message - Error message to check
 * @returns True if error is a network error
 */
export function isNetworkError(message: string): boolean {
  const networkErrorPatterns = [
    'Failed to fetch',
    'NetworkError',
    'Network request failed',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_TIMED_OUT',
    'ERR_CONNECTION_RESET',
  ];
  
  return networkErrorPatterns.some(pattern => 
    message.includes(pattern) || message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if error is a backend connection error
 * 
 * @param message - Error message to check
 * @returns True if error is a backend connection error
 */
export function isBackendConnectionError(message: string): boolean {
  const backendErrorPatterns = [
    'Failed to fetch',
    'ERR_CONNECTION_REFUSED',
    'ERR_EMPTY_RESPONSE',
    'Connection refused',
    'ECONNREFUSED',
  ];
  
  return backendErrorPatterns.some(pattern => 
    message.includes(pattern) || message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Handle async operation with standardized error handling
 * 
 * @param operation - Async operation to execute
 * @param onError - Error callback (optional)
 * @param defaultMessage - Default error message
 * @returns Result of operation or undefined if error occurred
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  onError?: (error: string) => void,
  defaultMessage: string = 'Възникна грешка'
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = getErrorMessage(error, defaultMessage);
    logger.error('Async operation error:', error);
    
    if (onError) {
      onError(errorMessage);
    }
    
    return undefined;
  }
}

/**
 * Create a standardized error handler function
 * 
 * @param setError - State setter for error message
 * @param defaultMessage - Default error message
 * @returns Error handler function
 */
export function createErrorHandler(
  setError: (message: string | null) => void,
  defaultMessage: string = 'Възникна грешка'
) {
  return (error: AppError) => {
    const errorMessage = getErrorMessage(error, defaultMessage);
    logger.error('Error handled:', error);
    setError(errorMessage);
  };
}

/**
 * Check if error should be silently ignored (e.g., backend not available)
 * 
 * @param error - Error to check
 * @returns True if error should be ignored
 */
export function shouldIgnoreError(error: AppError): boolean {
  if (error instanceof Error) {
    return isBackendConnectionError(error.message);
  }
  
  if (typeof error === 'string') {
    return isBackendConnectionError(error);
  }
  
  return false;
}

