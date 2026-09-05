import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * Lint rules that encode architectural constraints.
 *
 * Four of the rules below are not style preferences — they are the automated half
 * of guarantees the plan makes in prose. Each replaces a plugin we chose not to
 * install, keeping the dependency ledger closed (`no-console` in place of a
 * logging plugin, `no-restricted-globals` in place of a storage plugin,
 * `no-restricted-syntax` in place of `eslint-plugin-react`'s `no-danger`).
 */
export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Console output can carry a patient value into a shared browser log.
      // `src/lib/log.ts` is the one file allowed to touch it (§8.5).
      'no-console': 'error',

      // ADR-10: localStorage is used for nothing at all. A theme preference or a
      // dismissed-banner flag is how the "no patient data in localStorage" rule
      // starts eroding, so the API is out of reach everywhere.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'ADR-10: use sessionStorage via src/lib/storage/draft.ts. localStorage is never used.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'ADR-10: use sessionStorage via src/lib/storage/draft.ts. localStorage is never used.',
        },
      ],

      // Backend-authored strings (`explanation`, `disclaimer`, `limitations`) are
      // rendered as text, never as markup (§8.4).
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: 'Render backend text as text. See §8.4.',
        },
      ],
    },
  },
  {
    // The logger is the single sanctioned console call site.
    files: ['src/lib/log.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // §7.1 layering: UI reaches the API through `lib/api` and `lib/query`, so a
    // component cannot hold a raw response that still contains artifact paths.
    files: ['src/components/**/*.{ts,tsx}', 'src/routes/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/api/client', '**/lib/api/error-handler'],
              message: 'Import from lib/api (or a lib/query hook) so responses stay projected.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests assert on storage and console behaviour, so they must be able to
    // reference both. They still cannot use localStorage to *store* anything —
    // the repository-wide guard test covers that.
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
]);
