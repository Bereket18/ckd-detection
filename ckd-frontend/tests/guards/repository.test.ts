import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T-GUARD-02 · the rules no single component can be trusted to keep.
 *
 * Everything asserted here is a *repository-wide absence* — something that must
 * appear in no file. Absences are invisible in review and get re-introduced by
 * well-meaning changes ("just a dismissed-banner flag in localStorage", "COMING
 * SOON reads better than PLANNED"), so they are checked mechanically against the
 * source text rather than through a rendered tree.
 *
 * ESLint already blocks several of these at author time, and this file is
 * deliberately redundant with it: a lint rule is one config edit from gone, lint
 * and tests are separate CI jobs, and four of the rules are switched off for test
 * files — which is where a stray `console.log(response)` actually lands. Where a
 * lint rule exists, the comment says so.
 *
 * Two projections of each file are scanned, and choosing between them is the whole
 * craft of this file:
 *
 *   `CODE`      comments removed, string contents kept — for what the user can
 *               *read*. The banned vocabulary lives here, because a label is a
 *               string or JSX text.
 *   `CODE_ONLY` comments *and* string contents removed — for what the program can
 *               *do*. `localStorage` in a sentence explaining that localStorage is
 *               unused is not a use of localStorage.
 *
 * Without that split the guard would need an exemption list, and an exemption list
 * is where guards go to die.
 */

const ROOT = resolve(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES: readonly string[] = walk(ROOT).sort();
const rel = (file: string): string => relative(ROOT, file);
const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file);
const under = (file: string, ...dirs: string[]): boolean =>
  dirs.some((dir) => rel(file).startsWith(dir + sep));

/**
 * Strip comments, and optionally the contents of strings and templates.
 *
 * A character walker rather than a regex, because two constructs in this codebase
 * defeat the regex approach: `redact.ts` holds regex literals containing `'` and
 * `"`, and every `.tsx` file holds JSX closing tags. Get either wrong and the
 * walker loses its place, drops the rest of the file, and every guard below passes
 * because it read nothing — the worst possible failure for a test like this. Hence
 * the vacuity checks in the first describe.
 *
 * Regex literals are tracked with the usual "what came before" heuristic, minus
 * `<`, `>` and `}`: in TSX those precede a `/` far more often as `</Foo>` than as a
 * pattern, and misreading a closing tag as a regex is the destructive direction.
 * Reading a genuine regex as division is harmless here — its text is kept either
 * way, and none of these patterns contain a `//` or `/*` sequence to be mistaken
 * for a comment.
 */
function strip(source: string, blankStrings: boolean): string {
  let out = '';
  let previous = '';
  let index = 0;

  const regexMayStart = (): boolean => previous === '' || /[(,=:[!&|?;+\-*%~^\n]/.test(previous);

  while (index < source.length) {
    const two = source.slice(index, index + 2);

    if (two === '//') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }

    if (two === '/*') {
      index += 2;
      while (index < source.length && source.slice(index, index + 2) !== '*/') {
        // Newlines are kept so reported line numbers match the file.
        if (source[index] === '\n') out += '\n';
        index += 1;
      }
      index += 2;
      continue;
    }

    const char = source[index] as string;

    if (char === '"' || char === "'" || char === '`') {
      out += char;
      index += 1;
      while (index < source.length) {
        const inner = source[index] as string;
        index += 1;
        if (inner === '\\') {
          if (!blankStrings) out += inner + (source[index] ?? '');
          index += 1;
          continue;
        }
        if (inner === char) {
          out += char;
          break;
        }
        if (!blankStrings || inner === '\n') out += inner;
      }
      previous = char;
      continue;
    }

    if (char === '/' && regexMayStart()) {
      out += char;
      index += 1;
      let inClass = false;
      while (index < source.length) {
        const inner = source[index] as string;
        out += inner;
        index += 1;
        if (inner === '\\') {
          out += source[index] ?? '';
          index += 1;
          continue;
        }
        if (inner === '[') inClass = true;
        else if (inner === ']') inClass = false;
        else if (inner === '/' && !inClass) break;
        else if (inner === '\n') break;
      }
      previous = '/';
      continue;
    }

    out += char;
    if (!/[ \t\r]/.test(char)) previous = char;
    index += 1;
  }

  return out;
}

/** Comments gone, strings intact — what the user can read. */
const CODE: ReadonlyMap<string, string> = new Map(
  FILES.map((file) => [file, strip(readFileSync(file, 'utf8'), false)])
);

/** Comments and string contents gone — what the program can do. */
const CODE_ONLY: ReadonlyMap<string, string> = new Map(
  FILES.map((file) => [file, strip(readFileSync(file, 'utf8'), true)])
);

function scan(
  source: ReadonlyMap<string, string>,
  pattern: RegExp,
  filter: (file: string) => boolean = () => true
): string[] {
  const hits: string[] = [];
  for (const [file, code] of source) {
    if (!filter(file)) continue;
    for (const [lineNumber, line] of code.split('\n').entries()) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) hits.push(`${rel(file)}:${lineNumber + 1} ${line.trim()}`);
    }
  }
  return hits;
}

describe('the scan itself', () => {
  // A guard that reads nothing passes everything. These four assertions are the
  // reason a green result below means anything at all.
  it('found the source tree', () => {
    expect(FILES.length).toBeGreaterThan(60);
    expect(FILES.map(rel)).toContain('main.tsx');
  });

  it('keeps code and drops comments', () => {
    const provenance = CODE.get(join(ROOT, 'components', 'provenance', 'provenance.ts')) ?? '';
    expect(provenance).toContain("label: 'VERIFIED'");
    expect(provenance).not.toContain('Banned vocabulary');
  });

  it('keeps its place through a JSX closing tag', () => {
    // `</Foo>` after a `}` is the construct that breaks the naive heuristic. If it
    // were read as a regex, everything after the first one would be swallowed.
    const shell = CODE.get(join(ROOT, 'components', 'layout', 'AppShell.tsx')) ?? '';
    expect(shell).toContain('export function AppShell');
    expect(shell).toContain('</div>');
  });

  it('keeps its place through a regex literal holding quotes', () => {
    // `redact.ts` is the file that breaks a naive stripper: its patterns contain
    // both quote characters.
    const redact = CODE.get(join(ROOT, 'lib', 'api', 'redact.ts')) ?? '';
    expect(redact).toContain('export function safeText');
    expect(redact).toContain('export function containsPath');
  });

  it('blanks string contents in the second projection only', () => {
    const file = join(ROOT, 'components', 'provenance', 'provenance.ts');
    expect(CODE.get(file)).toContain('VERIFIED');
    expect(CODE_ONLY.get(file)).not.toContain('VERIFIED');
    // …while leaving the code around the string alone.
    expect(CODE_ONLY.get(file)).toContain('label:');
  });
});

describe('ADR-10 · localStorage is used nowhere', () => {
  // ESLint: `no-restricted-globals` and `no-restricted-properties`, both switched
  // off for test files — which is the gap this closes.
  it('is not touched in any file, tests included', () => {
    expect(scan(CODE_ONLY, /\blocalStorage\b/)).toEqual([]);
  });

  it('is not reached by string index either', () => {
    // The two ways round an identifier ban: `window['localStorage']` and
    // `globalThis['localStorage']`. Both read as ordinary property access.
    expect(scan(CODE, /\[\s*['"`]localStorage['"`]\s*\]/)).toEqual([]);
  });

  it('leaves sessionStorage reachable only through the draft module', () => {
    // Not a ban — a chokepoint. `draft.ts` filters what may be written and
    // degrades when the store throws; a second call site would have neither.
    const allowed = new Set([
      join('lib', 'storage', 'draft.ts'),
      join('lib', 'storage', 'draft.test.ts'),
      // Asserts the prediction context writes *nothing*, so it must name the API.
      join('lib', 'state', 'prediction.test.tsx'),
    ]);
    expect(scan(CODE_ONLY, /\bsessionStorage\b/, (file) => !allowed.has(rel(file)))).toEqual([]);
  });
});

describe('the provenance vocabulary is the only vocabulary', () => {
  /**
   * Each word is banned for a stated reason, not as a style preference: LIVE and
   * REAL claim more than a 400-record single-source model can support, DEMO and
   * MOCK invite a fabricated number to be read as a genuine one, and BETA and
   * COMING SOON describe a release process rather than whether a value can be
   * trusted.
   */
  const BANNED = ['LIVE', 'REAL', 'DEMO', 'MOCK', 'BETA', 'COMING SOON'] as const;

  /** The test that asserts the ban has to spell the words out to assert them. */
  const EXEMPT = new Set([join('components', 'provenance', 'StatusLabel.test.tsx')]);

  it.each(BANNED)('%s appears in nothing the user can read', (word) => {
    // Caps only: that is the form a label takes, and it keeps the guard off
    // `really` and off a `Live` in a URL while still catching the actual failure
    // mode, which is a chip or a heading shouting the word.
    const pattern = new RegExp(`\\b${word.replace(' ', '\\s+')}\\b`, 'g');
    expect(scan(CODE, pattern, (file) => !EXEMPT.has(rel(file)))).toEqual([]);
  });

  it('states the five labels in one place', () => {
    // A second literal `'SIMULATION'` in a route is how the vocabulary drifts: the
    // word survives, the glyph shape and the legend entry do not.
    const allowed = new Set([
      join('components', 'provenance', 'provenance.ts'),
      join('components', 'provenance', 'StatusLabel.test.tsx'),
    ]);
    expect(
      scan(
        CODE,
        /['"`](?:VERIFIED|PROVISIONAL|NOT VERIFIED|SIMULATION|PLANNED)['"`]/,
        (file) => !allowed.has(rel(file))
      )
    ).toEqual([]);
  });
});

describe('§8.3 · server internals cannot reach a page', () => {
  it('accesses no `.path` in a component or route', () => {
    // `toModelView` drops the key, so a `.path` in the view layer could only be a
    // raw response smuggled past `lib/api` — or a re-derivation.
    expect(
      scan(CODE_ONLY, /\.path\b/, (file) => under(file, 'components', 'routes', 'features'))
    ).toEqual([]);
  });

  it('names no directory the backend runs in', () => {
    // `redact.ts` is exempt for the obvious reason: its patterns have to name the
    // directories they defend against.
    const allowed = new Set([join('lib', 'api', 'redact.ts')]);
    expect(
      scan(
        CODE,
        /saved_models|\.joblib|\.pt\b/,
        (file) => !isTest(file) && !allowed.has(rel(file))
      )
    ).toEqual([]);
  });

  it('hands no component the raw health document that carries `detail`', () => {
    // Structural, not textual. A degraded `/health` arrives with HTTP **200** and
    // its `detail` holds an absolute server path, so `detail` must be unreachable
    // rather than merely unrendered: `HealthStatus` has no such field,
    // `NormalizedError` has no such field, and no hook returns `HealthResponse`.
    expect(
      scan(CODE, /\bHealthResponse\b/, (file) => !under(file, 'lib' + sep + 'api', 'types'))
    ).toEqual([]);
  });

  it('reads no `detail` off a response in the view layer', () => {
    // Receiver-scoped on purpose. `RouteShell` has its own unrelated `detail` prop
    // for placeholder copy, so a bare `\.detail\b` would fire on ~50 lines of
    // ordinary UI and get switched off within a week. These are the receivers a
    // server `detail` could plausibly be read from.
    expect(
      scan(
        CODE_ONLY,
        /\b(?:health|error|err|data|response|res|payload|probe|body|json)\s*(?:\?\.|\.)detail\b/i,
        (file) => under(file, 'components', 'routes', 'features')
      )
    ).toEqual([]);
  });
});

describe('§8.4 · backend text is rendered as text', () => {
  it('uses no dangerouslySetInnerHTML', () => {
    // ESLint: `no-restricted-syntax`. Kept here too because this is not a style
    // rule — `explanation`, `disclaimer` and `limitations[]` are server-authored.
    expect(scan(CODE, /dangerouslySetInnerHTML/)).toEqual([]);
  });

  it('assigns no markup into the DOM', () => {
    // Assignment, not reading: `StatusLabel.test.tsx` reads `svg.innerHTML` to
    // assert the glyph shapes differ, which is a legitimate inspection.
    expect(scan(CODE_ONLY, /\b(?:inner|outer)HTML\s*=|insertAdjacentHTML|document\.write/)).toEqual(
      []
    );
  });
});

describe('§8.5 · console output is confined to the logger', () => {
  it('happens in no other file', () => {
    // ESLint: `no-console`, off for tests. A stray `console.log(response)` in a
    // test is how a patient value reaches a CI log that is kept for months.
    expect(scan(CODE_ONLY, /\bconsole\s*\.\s*\w+/, (file) => rel(file) !== join('lib', 'log.ts')))
      .toEqual([]);
  });
});

describe('ADR-9 · the API is reached by relative path, through one client', () => {
  it('hardcodes no backend origin', () => {
    // A literal `localhost:8000` bypasses the proxy, needs CORS, and works only on
    // the machine it was written on. Strings are scanned, since that is where a URL
    // would be written.
    expect(scan(CODE, /localhost:\d+|127\.0\.0\.1|0\.0\.0\.0/)).toEqual([]);
  });

  it('calls fetch in exactly one module', () => {
    // Two callers means two timeout policies and two error taxonomies. Tests stub
    // `fetch`, so they are excluded.
    const callers = scan(CODE_ONLY, /\bfetch\s*\(/, (file) => !isTest(file)).map(
      (hit) => hit.split(':')[0]
    );
    expect([...new Set(callers)]).toEqual([join('lib', 'api', 'client.ts')]);
  });

  it('pulls in no second HTTP library', () => {
    expect(scan(CODE_ONLY, /\bnew XMLHttpRequest\b|from ['"]axios['"]/)).toEqual([]);
  });
});

describe('§8.1 · no secret can ship in the bundle', () => {
  const ENV_FILES = ['.env.development', '.env.production'] as const;
  const read = (name: string): string => readFileSync(resolve(process.cwd(), name), 'utf8');

  it.each(ENV_FILES)('%s declares only VITE_ variables', (name) => {
    const lines = read(name)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, `${name}: not a VITE_ assignment`).toMatch(/^VITE_[A-Z0-9_]+=/);
    }
  });

  it.each(ENV_FILES)('%s names nothing that sounds like a credential', (name) => {
    // There is no server tier, so every value in these files is inlined into the
    // JavaScript bundle and readable by anyone who opens the browser. The guard is
    // on the *name*, because the name is written before the value is pasted in.
    const keys = [...read(name).matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key, `${name}: ${key} reads like a secret`).not.toMatch(
        /SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE|_KEY$|APIKEY/
      );
    }
  });

  it.each(ENV_FILES)('%s keeps the API base relative', (name) => {
    expect(read(name)).toMatch(/^VITE_API_BASE_URL=\/api$/m);
  });
});
