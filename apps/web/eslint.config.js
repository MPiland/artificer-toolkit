// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'

// apps/web/eslint.config.ts
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { globalIgnores } from 'eslint/config'
import base from '../../eslint.config.js'

// merge arrays: [...base, ...localConfigs]
export default [...base, globalIgnores([
  'dist',
  'storybook-static',
]), {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  rules: {
    ...reactHooks.configs['recommended-latest'].rules,
    ...reactRefresh.configs.vite.rules,
  },
}, {
  files: ['src/routes/**/*.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, ...storybook.configs['flat/recommended']]
