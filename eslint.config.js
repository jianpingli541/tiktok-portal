import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist',
      'node_modules',
      'public/mockServiceWorker.js',
      // Plain Node ESM scripts live alongside TS but use Node globals
      // and Buffer; lint is handled via node --check + shellcheck, not
      // the TS parser.
      'scripts/**/*.mjs',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
];