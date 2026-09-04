/**
 * Error Handler Service Tests
 * 
 * Tests error mapping, validation error handling, and user message generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler, errorHandler } from './error-handler';
import { APIError, NetworkError, TimeoutError } from './api';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handler = new ErrorHandler();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('handleAPIError', () => {
    it('should map HTTP 422 validation errors', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [{ loc: ['body', 'age'], msg: 'value error', type: 'value_error' }],
      });

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Validation Error');
      expect(result.message).toContain('invalid values');
      expect(result.action).toBe('Review');
    });

    it('should map HTTP 500 server errors', () => {
      const error = new APIError(500, 'Internal Server Error', null);

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Server Error');
      expect(result.message).toBe('The API encountered an error. Please try again.');
      expect(result.action).toBe('Retry');
    });

    it('should map HTTP 503 service unavailable errors', () => {
      const error = new APIError(503, 'Service Unavailable', null);

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('warning');
      expect(result.title).toBe('API Unavailable');
      expect(result.message).toContain('temporarily unavailable');
      expect(result.action).toBe('Retry');
    });

    it('should map HTTP 404 not found errors', () => {
      const error = new APIError(404, 'Not Found', null);

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Not Found');
      expect(result.message).toContain('endpoint was not found');
    });

    it('should map HTTP 400 bad request errors', () => {
      const error = new APIError(400, 'Bad Request', null);

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Bad Request');
      expect(result.message).toContain('invalid');
      expect(result.action).toBe('Review');
    });

    it('should map HTTP 401 unauthorized errors', () => {
      const error = new APIError(401, 'Unauthorized', null);

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Unauthorized');
      expect(result.message).toContain('not authorized');
    });

    it('should map HTTP 403 forbidden errors', () => {
      const error = new APIError(403, 'Forbidden', null);

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Forbidden');
      expect(result.message).toContain('permission');
    });

    it('should handle unknown HTTP status codes', () => {
      const error = new APIError(418, "I'm a teapot", null);

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Request Failed');
      expect(result.message).toContain('418');
      expect(result.action).toBe('Retry');
    });

    it('should handle timeout errors', () => {
      const error = new TimeoutError('Request timed out');

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Request Timeout');
      expect(result.message).toContain('timed out');
      expect(result.action).toBe('Retry');
    });

    it('should handle network errors', () => {
      const error = new NetworkError('Network failed');

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Connection Error');
      expect(result.message).toContain('Unable to reach the API');
      expect(result.action).toBe('Retry');
    });

    it('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Unexpected Error');
      expect(result.message).toBe('Something went wrong');
      expect(result.action).toBe('Retry');
    });

    it('should handle unknown error types', () => {
      const error = { weird: 'object' };

      const result = handler.handleAPIError(error);

      expect(result.type).toBe('error');
      expect(result.title).toBe('Unknown Error');
      expect(result.message).toContain('unknown error');
      expect(result.action).toBe('Retry');
    });
  });

  describe('handleValidationError', () => {
    it('should map validation errors to field errors', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [
          {
            loc: ['body', 'age'],
            msg: 'ensure this value is greater than or equal to 0',
            type: 'value_error.number.not_ge',
          },
          {
            loc: ['body', 'bp'],
            msg: 'ensure this value is less than or equal to 200',
            type: 'value_error.number.not_le',
          },
        ],
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(2);
      expect(result[0]!.field).toBe('age');
      expect(result[0]!.message).toBe('Value must be at least 0');
      expect(result[1]!.field).toBe('bp');
      expect(result[1]!.message).toBe('Value must be at most 200');
    });

    it('should handle single field in loc array', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [
          {
            loc: ['age'],
            msg: 'field required',
            type: 'value_error.missing',
          },
        ],
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(1);
      expect(result[0]!.field).toBe('age');
      expect(result[0]!.message).toBe('This field is required');
    });

    it('should map type errors correctly', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [
          {
            loc: ['body', 'age'],
            msg: 'value is not a valid integer',
            type: 'type_error.integer',
          },
        ],
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(1);
      expect(result[0]!.field).toBe('age');
      expect(result[0]!.message).toBe('Must be a valid number');
    });

    it('should handle enum validation errors', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [
          {
            loc: ['body', 'rbc'],
            msg: 'value is not a valid enumeration member; permitted: normal, abnormal',
            type: 'type_error.enum',
          },
        ],
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(1);
      expect(result[0]!.field).toBe('rbc');
      expect(result[0]!.message).toBe('Please select a valid option');
    });

    it('should return empty array for non-validation error body', () => {
      const error = new APIError(422, 'Unprocessable Entity', 'invalid body');

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for missing detail array', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        message: 'Validation failed',
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(0);
    });

    it('should skip validation errors with no location', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [
          {
            loc: [],
            msg: 'general validation error',
            type: 'value_error',
          },
        ],
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(0);
    });

    it('should handle float type errors', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [
          {
            loc: ['body', 'sg'],
            msg: 'value is not a valid float',
            type: 'type_error.float',
          },
        ],
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(1);
      expect(result[0]!.field).toBe('sg');
      expect(result[0]!.message).toBe('Must be a valid number');
    });

    it('should use original message if no mapping found', () => {
      const error = new APIError(422, 'Unprocessable Entity', {
        detail: [
          {
            loc: ['body', 'custom_field'],
            msg: 'custom validation message',
            type: 'custom_error',
          },
        ],
      });

      const result = handler.handleValidationError(error);

      expect(result).toHaveLength(1);
      expect(result[0]!.field).toBe('custom_field');
      expect(result[0]!.message).toBe('custom validation message');
    });
  });

  describe('logError', () => {
    it('should log error with context to console', () => {
      const error = new Error('Test error');
      
      handler.logError(error, 'Test context');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorHandler] Test context'),
        expect.objectContaining({
          error,
          errorType: 'Error',
          message: 'Test error',
          stack: expect.any(String),
        })
      );
    });

    it('should log non-Error objects', () => {
      const error = { custom: 'error' };
      
      handler.logError(error, 'Custom error context');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorHandler] Custom error context'),
        expect.objectContaining({
          error,
          errorType: 'object',
          message: '[object Object]',
        })
      );
    });
  });

  describe('message creators', () => {
    it('should create success message', () => {
      const message = handler.createSuccessMessage('Success', 'Operation completed');

      expect(message.type).toBe('success');
      expect(message.title).toBe('Success');
      expect(message.message).toBe('Operation completed');
    });

    it('should create warning message', () => {
      const message = handler.createWarningMessage('Warning', 'Be careful');

      expect(message.type).toBe('warning');
      expect(message.title).toBe('Warning');
      expect(message.message).toBe('Be careful');
    });

    it('should create info message', () => {
      const message = handler.createInfoMessage('Info', 'For your information');

      expect(message.type).toBe('info');
      expect(message.title).toBe('Info');
      expect(message.message).toBe('For your information');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });
  });
});
