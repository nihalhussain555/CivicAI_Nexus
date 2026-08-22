import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Standard "fetch on mount / on dependency change" data-fetching
      // pattern (setLoading(true) then fetch then setData) is used
      // throughout this codebase and is safe/idiomatic here — downgraded
      // to a warning rather than restructuring every list page.
      'react-hooks/set-state-in-effect': 'warn',
      // Context files intentionally co-export a Provider component and a
      // useXyz() hook — this is the standard React context pattern.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
