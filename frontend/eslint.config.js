// ESLint « flat config » (ESLint 9) pour le frontend React (ESM + JSX).
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser }
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Transform JSX moderne (React 17+) : plus besoin d'importer React partout
      'react/react-in-jsx-scope': 'off',
      // Projet volontairement sans PropTypes (formation)
      'react/prop-types': 'off'
    }
  },
  {
    // vite.config.js s'exécute côté Node (build), pas navigateur
    files: ['vite.config.js'],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    // Les tests Vitest importent describe/it/expect explicitement
    files: ['**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } }
  },
  prettier
];
