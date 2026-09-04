/**
 * `safeText()` — the single chokepoint for server-supplied free text.
 *
 * The backend embeds absolute filesystem paths in several strings the frontend
 * would otherwise render verbatim (architecture §8.3, C1):
 *
 *   - `/model.artifacts[*].path`, which `POST /predict` embeds in every response
 *   - `detail` on a degraded `GET /health` (which arrives with HTTP **200**)
 *   - `detail` on a 503, where `str(exc)` carries `ArtifactLoadError` text
 *
 * Dropping `path` at the parse boundary handles the structured case. This
 * function handles the unstructured one: any string the server authored —
 * `explanation`, `disclaimer`, `limitations[]` — passes through here before it
 * reaches the DOM, so a path cannot arrive inside prose.
 *
 * Backend redaction is the real fix and is recorded as backend dependency D9.
 * The backend is frozen, so this is the frontend's independent mitigation.
 */

/** What replaces a redacted path. Deliberately visible, not silent. */
export const REDACTED = '[path removed]';

/**
 * Path shapes that must not reach a page. Ordered longest-match-first so a UNC
 * path is not partly consumed by the POSIX rule.
 *
 * - `\\host\share\...`      UNC
 * - `C:\Users\...`          Windows, either slash direction
 * - `/usr/...`, `/home/...` POSIX absolute, restricted to real root directories
 *   so ordinary prose ("values /  units") and URL paths are left alone
 */
const PATH_PATTERNS: readonly RegExp[] = [
  /\\\\[^\s\\/]+(?:[\\/][^\s\\/]+)+/g,
  /[A-Za-z]:[\\/](?:[^\s\\/]+[\\/])*[^\s\\/]*/g,
  /(?:^|(?<=[\s(['"]))\/(?:usr|home|root|etc|var|opt|tmp|srv|mnt|media|Users|Applications|app|workspace|saved_models|data)(?:\/[^\s'")\]]+)+/g,
];

/**
 * Strip path-like substrings from a server-supplied string.
 *
 * Returns `''` for `null`/`undefined` so a caller can render the result
 * directly without a conditional, and so an absent string can never become the
 * text `"null"` on screen.
 */
export function safeText(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  let out = value;
  for (const pattern of PATH_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** `true` when the string contains something that looks like a filesystem path. */
export function containsPath(value: string): boolean {
  return PATH_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}
