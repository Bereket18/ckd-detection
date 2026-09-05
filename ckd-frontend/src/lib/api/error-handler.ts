/**
 * Error Handler Service
 * 
 * Centralizes error handling and provides user-friendly error messages.
 * Maps technical errors from the API to actionable messages for clinicians.
 */

import { APIError, NetworkError, TimeoutError } from './client';
import type { UserMessage, FieldError } from '../../types/api.types';
import { devLogFailure } from '../log';

/**
 * Validation error detail from FastAPI 422 response
 */
interface ValidationErrorDetail {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/**
 * FastAPI 422 validation error response body
 */
interface FastAPIValidationError {
  detail: ValidationErrorDetail[];
}

/**
 * ErrorHandler class
 * 
 * Provides methods for converting technical errors into user-friendly messages
 * and mapping validation errors to specific form fields.
 */
export class ErrorHandler {
  /**
   * Handle API errors and convert to user-friendly messages
   * @param error Error object (APIError, NetworkError, TimeoutError, or generic Error)
   * @returns UserMessage object with appropriate type, title, and message
   */
  handleAPIError(error: unknown): UserMessage {
    // Handle API errors (HTTP 4xx, 5xx)
    if (error instanceof APIError) {
      switch (error.status) {
        case 422:
          return {
            type: 'error',
            title: 'Validation Error',
            message: 'Please check your input data. Some fields contain invalid values.',
            action: 'Review',
          };

        case 500:
          return {
            type: 'error',
            title: 'Server Error',
            message: 'The API encountered an error. Please try again.',
            action: 'Retry',
          };

        case 503:
          return {
            type: 'warning',
            title: 'API Unavailable',
            message: 'The API is temporarily unavailable. Please try again later.',
            action: 'Retry',
          };

        // 415 was missing from the original taxonomy. `POST /predict/batch`
        // answers 415 with `detail` as a bare **string**, not the array a 422
        // sends, so it needs its own branch rather than the default (§0.5, C7).
        case 415:
          return {
            type: 'error',
            title: 'Unsupported File Type',
            message: 'Upload a .csv file. The API rejected the file type that was sent.',
            action: 'Review',
          };

        case 404:
          return {
            type: 'error',
            title: 'Not Found',
            message: 'The requested endpoint was not found. Please contact support if this persists.',
          };

        case 400:
          return {
            type: 'error',
            title: 'Bad Request',
            message: 'The request was invalid. Please check your input and try again.',
            action: 'Review',
          };

        case 401:
          return {
            type: 'error',
            title: 'Unauthorized',
            message: 'You are not authorized to access this resource.',
          };

        case 403:
          return {
            type: 'error',
            title: 'Forbidden',
            message: 'You do not have permission to perform this action.',
          };

        default:
          return {
            type: 'error',
            title: 'Request Failed',
            message: `Request failed with status ${error.status}: ${error.statusText}`,
            action: 'Retry',
          };
      }
    }

    // Handle timeout errors
    if (error instanceof TimeoutError) {
      return {
        type: 'error',
        title: 'Request Timeout',
        message: 'The request timed out. Please check your connection and try again.',
        action: 'Retry',
      };
    }

    // Handle network errors
    if (error instanceof NetworkError) {
      return {
        type: 'error',
        title: 'Connection Error',
        message: 'Unable to reach the API. Please check your network connection.',
        action: 'Retry',
      };
    }

    // Handle generic errors
    if (error instanceof Error) {
      return {
        type: 'error',
        title: 'Unexpected Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
        action: 'Retry',
      };
    }

    // Handle unknown error types
    return {
      type: 'error',
      title: 'Unknown Error',
      message: 'An unknown error occurred. Please try again.',
      action: 'Retry',
    };
  }

  /**
   * Handle validation errors and map to specific form fields
   * @param error APIError with status 422 containing FastAPI validation details
   * @returns Array of FieldError objects mapping field names to error messages
   */
  handleValidationError(error: APIError): FieldError[] {
    const fieldErrors: FieldError[] = [];

    // Check if error body matches FastAPI validation error format
    if (!error.body || typeof error.body !== 'object') {
      return fieldErrors;
    }

    const body = error.body as Record<string, unknown>;

    // FastAPI returns validation errors in a 'detail' array
    if (!Array.isArray(body.detail)) {
      return fieldErrors;
    }

    // The guard above has established body.detail is an array; TypeScript cannot
    // narrow an index signature to a named shape, so widen through unknown.
    const validationErrors = body as unknown as FastAPIValidationError;

    // Map each validation error to a field error
    for (const detail of validationErrors.detail) {
      // The 'loc' array contains the path to the invalid field
      // For body fields, it's typically ['body', 'field_name']
      // We want to extract the field name
      const fieldPath = detail.loc;
      
      // Skip if no location specified
      if (!fieldPath || fieldPath.length === 0) {
        continue;
      }

      // Extract field name (usually the last element or second-to-last if last is an index)
      let fieldName: string;
      if (fieldPath.length === 1) {
        fieldName = String(fieldPath[0]);
      } else {
        // For body validation, skip 'body' prefix
        const relevantPath = fieldPath.filter(
          (part) => part !== 'body' && typeof part === 'string'
        );
        fieldName = relevantPath.length > 0 ? String(relevantPath[0]) : String(fieldPath[fieldPath.length - 1]);
      }

      // Map technical validation messages to user-friendly ones
      const userMessage = this.formatValidationMessage(detail.msg, detail.type);

      fieldErrors.push({
        field: fieldName,
        message: userMessage,
      });
    }

    return fieldErrors;
  }

  /**
   * Format validation error message for user display
   * @param message Raw validation message from API
   * @param type Validation error type
   * @returns User-friendly error message
   */
  private formatValidationMessage(message: string, type: string): string {
    // Try to extract useful information from the message first
    // Handle range validation messages (more specific)
    if (message.includes('greater than or equal to')) {
      const match = message.match(/greater than or equal to (\d+\.?\d*)/);
      if (match) {
        return `Value must be at least ${match[1]}`;
      }
    }

    if (message.includes('less than or equal to')) {
      const match = message.match(/less than or equal to (\d+\.?\d*)/);
      if (match) {
        return `Value must be at most ${match[1]}`;
      }
    }

    // Handle type validation errors (more specific patterns first)
    if (message.includes('value is not a valid integer') || message.includes('value is not a valid float')) {
      return 'Must be a valid number';
    }

    // Handle enum validation
    if (message.includes('not a valid enumeration member')) {
      return 'Please select a valid option';
    }

    // Handle generic type errors (catch-all for other types)
    if (message.includes('value is not a valid')) {
      return 'Invalid value format';
    }

    // Common validation error type mappings (fallback)
    const typePatterns: Record<string, string> = {
      'type_error.integer': 'Must be a valid number',
      'type_error.float': 'Must be a valid number',
      'type_error.none.not_allowed': 'This field is required',
      'value_error.number.not_ge': 'Value is too low',
      'value_error.number.not_le': 'Value is too high',
      'value_error.missing': 'This field is required',
    };

    // Check if we have a mapping for this error type
    if (typePatterns[type]) {
      return typePatterns[type];
    }

    // Default to the original message if we can't improve it
    return message;
  }

  /**
   * Record that something failed, for a developer.
   *
   * Takes a context string and prints the error *name* and nothing else. It
   * deliberately does not print the error object, its message, its stack, or a
   * response body: an `APIError.body` can be a 422 detail array echoing every
   * submitted field value, and a 503 `detail` can carry an absolute server path
   * (architecture §8.3, §8.5). Development only.
   */
  logError(error: unknown, context: string): void {
    const name =
      error instanceof Error ? error.name : error === null ? 'null' : typeof error;
    devLogFailure(`[ErrorHandler] ${context}`, name);
  }

  /**
   * Create a success message
   * @param title Success message title
   * @param message Success message details
   * @returns UserMessage object with success type
   */
  createSuccessMessage(title: string, message: string): UserMessage {
    return {
      type: 'success',
      title,
      message,
    };
  }

  /**
   * Create a warning message
   * @param title Warning message title
   * @param message Warning message details
   * @returns UserMessage object with warning type
   */
  createWarningMessage(title: string, message: string): UserMessage {
    return {
      type: 'warning',
      title,
      message,
    };
  }

  /**
   * Create an info message
   * @param title Info message title
   * @param message Info message details
   * @returns UserMessage object with info type
   */
  createInfoMessage(title: string, message: string): UserMessage {
    return {
      type: 'info',
      title,
      message,
    };
  }
}

/**
 * Singleton instance of ErrorHandler
 * Export this for use throughout the application
 */
export const errorHandler = new ErrorHandler();
