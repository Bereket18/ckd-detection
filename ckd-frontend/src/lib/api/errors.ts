/**
 * Error normalization — every failure becomes one shape before a component sees
 * it (architecture §7.5).
 *
 * Keyed on the Pydantic **v2** discriminators (`type` plus `ctx`), never on
 * message substrings. The backend's phrasing is not a contract; the error type
 * is. Matching on prose was contradiction C8.
 *
 * `detail[i].input` echoes the value the user submitted and is never copied into
 * a message or a log (§8.3).
 */

import { APIError, NetworkError, TimeoutError } from './client';
import { safeText } from './redact';

export type ErrorKind =
  | 'validation'
  | 'row-validation'
  | 'unsupported-media'
  | 'unavailable'
  | 'server'
  | 'timeout'
  | 'offline'
  | 'not-found'
  | 'contract'
  | 'unknown';

export interface NormalizedFieldError {
  /** Raw field name, e.g. `sc`. Resolving it to a label is the content layer's job. */
  field: string;
  message: string;
}

export interface NormalizedRowError {
  /** Zero-based row index as the API reports it. */
  row: number;
  /**
   * The line number in the uploaded file: `row + 2`, because row 0 is the first
   * data row and the file's line 1 is the header (C9).
   */
  line: number;
  field: string;
  message: string;
}

export interface NormalizedError {
  kind: ErrorKind;
  title: string;
  message: string;
  retryable: boolean;
  status?: number;
  fieldErrors?: NormalizedFieldError[];
  rowErrors?: NormalizedRowError[];
}

interface PydanticDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
  ctx?: Record<string, unknown>;
}

/** Copy is fixed here so client-side and server-side wording cannot diverge. */
export const FIELD_MESSAGES = {
  atLeast: (bound: unknown) => `Value must be at least ${String(bound)}`,
  atMost: (bound: unknown) => `Value must be at most ${String(bound)}`,
  number: 'Must be a valid number',
  choose: (options: unknown) =>
    `Choose one of: ${Array.isArray(options) ? options.join(', ') : String(options)}`,
  unexpected: 'This value could not be accepted.',
} as const;

function fieldMessage(detail: PydanticDetail): string {
  const ctx = detail.ctx ?? {};
  switch (detail.type) {
    case 'greater_than_equal':
      return FIELD_MESSAGES.atLeast(ctx.ge);
    case 'less_than_equal':
      return FIELD_MESSAGES.atMost(ctx.le);
    case 'greater_than':
      return FIELD_MESSAGES.atLeast(ctx.gt);
    case 'less_than':
      return FIELD_MESSAGES.atMost(ctx.lt);
    case 'float_parsing':
    case 'int_parsing':
    case 'decimal_parsing':
      return FIELD_MESSAGES.number;
    case 'literal_error':
    case 'enum':
      return FIELD_MESSAGES.choose(ctx.expected);
    default:
      return FIELD_MESSAGES.unexpected;
  }
}

/** `["body", "sc"]` → `sc`; `[0, "age"]` → `age`. */
function fieldName(loc: (string | number)[] | undefined): string {
  if (!loc || loc.length === 0) return '';
  for (let i = loc.length - 1; i >= 0; i -= 1) {
    const part = loc[i];
    if (typeof part === 'string' && part !== 'body') return part;
  }
  return String(loc[loc.length - 1]);
}

function asDetailArray(body: unknown): PydanticDetail[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const detail = (body as { detail?: unknown }).detail;
  return Array.isArray(detail) ? (detail as PydanticDetail[]) : null;
}

/**
 * Turn anything thrown by the client into a `NormalizedError`.
 *
 * A 422 is split by the shape of `loc[0]`: `'body'` for a single prediction,
 * a **number** for a batch row. That is the only way to tell them apart — the
 * status code is identical.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof TimeoutError) {
    return {
      kind: 'timeout',
      title: 'This took too long',
      message:
        'The request did not finish within 30 seconds. Your answers have been kept — you can try again.',
      retryable: true,
    };
  }

  if (error instanceof NetworkError) {
    return {
      kind: 'offline',
      title: 'You appear to be offline',
      message: 'We could not reach the service. Check your connection and try again.',
      retryable: true,
    };
  }

  if (!(error instanceof APIError)) {
    return {
      kind: 'unknown',
      title: 'Something went wrong',
      message: 'An unexpected problem stopped this from finishing. Please try again.',
      retryable: true,
    };
  }

  const details = asDetailArray(error.body);

  if (error.status === 422 && details) {
    const rowShaped = details.some((detail) => typeof detail.loc?.[0] === 'number');

    if (rowShaped) {
      return {
        kind: 'row-validation',
        status: 422,
        title: 'Some rows could not be scored',
        message: 'The file was read, but the rows listed below contain values the service rejected.',
        retryable: false,
        rowErrors: details.map((detail) => {
          const row = typeof detail.loc?.[0] === 'number' ? detail.loc[0] : 0;
          return { row, line: row + 2, field: fieldName(detail.loc), message: fieldMessage(detail) };
        }),
      };
    }

    return {
      kind: 'validation',
      status: 422,
      title: 'Please check the highlighted answers',
      message: 'Some values are outside the range the service accepts.',
      retryable: false,
      fieldErrors: details.map((detail) => ({
        field: fieldName(detail.loc),
        message: fieldMessage(detail),
      })),
    };
  }

  switch (error.status) {
    case 415:
      return {
        kind: 'unsupported-media',
        status: 415,
        title: 'That file type is not accepted',
        message: 'Upload a .csv file.',
        retryable: false,
      };
    case 404:
      return {
        kind: 'not-found',
        status: 404,
        title: 'Not found',
        message: 'The service could not find that address. This is a configuration problem, not yours.',
        retryable: false,
      };
    case 503:
      return {
        kind: 'unavailable',
        status: 503,
        title: 'The service is temporarily unavailable',
        message: 'The model is not currently loaded. Please try again shortly.',
        retryable: true,
      };
    default:
      break;
  }

  if (error.status >= 500) {
    return {
      kind: 'server',
      status: error.status,
      title: 'Something went wrong on our side',
      message: 'The service could not complete the request. Please try again.',
      retryable: true,
    };
  }

  return {
    kind: 'unknown',
    status: error.status,
    title: 'The request was not accepted',
    message: 'The service rejected the request. Please review your input and try again.',
    retryable: false,
  };
}

/**
 * A response that parsed as HTTP 200 but does not satisfy the contract — a
 * missing `disclaimer`, an unknown `risk_band`, an unreachable verdict/band pair.
 * Rendering half a health verdict is worse than rendering none (§7.7).
 *
 * `reason` is developer-facing and passes through `safeText` because a Zod issue
 * path can quote server content.
 */
export function contractError(reason: string): NormalizedError {
  return {
    kind: 'contract',
    title: 'This result could not be displayed',
    message:
      'The service returned something we could not read safely, so nothing is being shown rather than a partial result.',
    retryable: true,
    fieldErrors: [{ field: '__contract__', message: safeText(reason) }],
  };
}
