const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'reports/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
    rules: { 'no-unused-vars': 'error', 'no-undef': 'error', eqeqeq: 'error' },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: globals.jest },
  },
];
