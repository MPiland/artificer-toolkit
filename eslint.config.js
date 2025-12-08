// artificer-toolkit/eslint.config.ts
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  stylistic.configs.recommended,
  {
    plugins: {
      '@stylistic': stylistic,
    },
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': 'off',
      '@stylistic/newline-per-chained-call': [
        'error',
        { ignoreChainWithDepth: 2 },
      ],
      '@stylistic/implicit-arrow-linebreak': ['error', 'beside'],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/array-bracket-newline': ['error', { minItems: 1 }],
      '@stylistic/array-element-newline': [
        'error',
        {
          ArrayExpression: 'consistent',
          ArrayPattern: { minItems: 2, multiline: true },
        },
      ],
      '@stylistic/function-call-argument-newline': ['error', 'consistent'],
      '@stylistic/function-paren-newline': ['error', 'multiline-arguments'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/multiline-ternary': ['error', 'always-multiline'],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
]
