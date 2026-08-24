// Minimal lint setup: catch typos and dead code, leave style alone.
//   npx eslint .
const browser = {
  window: 'readonly', document: 'readonly', location: 'readonly', navigator: 'readonly',
  localStorage: 'readonly', console: 'readonly', fetch: 'readonly', URL: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
};

export default [
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser },
    rules: { 'no-unused-vars': ['warn', { args: 'none' }], 'no-undef': 'error' },
  },
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', location: 'readonly', Promise: 'readonly', URL: 'readonly' },
    },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['test/**/*.mjs', 'build/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly' },
    },
    rules: { 'no-unused-vars': ['warn', { args: 'none' }], 'no-undef': 'error' },
  },
];
