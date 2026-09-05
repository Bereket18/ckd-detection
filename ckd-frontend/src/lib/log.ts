/**
 * The one place in `src/` allowed to touch `console`.
 *
 * Architecture §8.5 fixes the rule: no request or response **body** is ever
 * logged, in any environment. What may be logged, and only in development, is
 * method, path, status, and duration. Centralising it here turns that rule into
 * something a lint rule can enforce — `no-console` is an error everywhere else,
 * with a single override for this file — rather than a comment someone has to
 * remember.
 *
 * There is no analytics or telemetry in the product (§8.5).
 */

const enabled = (): boolean => import.meta.env.DEV;

/** Development-only diagnostic. Callers must pass no patient data. */
export function devLog(message: string): void {
  if (enabled()) console.debug(message);
}

/**
 * Development-only failure diagnostic. Deliberately takes a message and an
 * error *name*, not the error object — an error object can carry a stack, a
 * response body, or a server path, none of which may be printed (§8.3).
 */
export function devLogFailure(message: string, errorName: string): void {
  if (enabled()) console.debug(`${message} [${errorName}]`);
}
