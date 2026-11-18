module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: ['eslint:recommended'],
  rules: {
    // The existing codebase has legacy unused imports/variables. Keep this
    // baseline focused on correctness errors without turning cleanup-only
    // warnings into a blocker for the first CI adoption.
    'no-unused-vars': 'off',
  },
};
