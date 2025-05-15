import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], plugins: { js }, extends: ['js/recommended'] },
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    ignores: ['**/dist', '**/node_modules', '**/env.d.ts', '**/routeTree.gen.ts'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  reactHooks.configs['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react/no-unknown-property': 'off',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off'
    },
  },
])
