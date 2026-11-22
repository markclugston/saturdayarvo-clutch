import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import clutchStyle from './eslint-rules/clutch-style.js'
import numericAlign from './eslint-rules/clutch-numeric-align.js'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '**/*.min.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { clutch: { rules: { ...clutchStyle.rules, 'numeric-align': numericAlign } } },
    rules: { 'clutch/style-tokens': 'error', 'clutch/numeric-align': 'error' },
  },
)
