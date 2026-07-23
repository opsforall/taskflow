// ESLint « flat config » (ESLint 9) pour le backend Node.js (CommonJS).
// eslint-config-prettier est placé en dernier : il désactive les règles de
// style qui entreraient en conflit avec Prettier (chacun son rôle — ESLint
// détecte les bugs, Prettier gère le formatage).
const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['coverage/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      // Autorise les arguments non utilisés préfixés par _ et le `next` d'Express
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }]
    }
  },
  {
    // Les fichiers de test disposent en plus des globales Jest
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest }
    }
  },
  prettier
];
