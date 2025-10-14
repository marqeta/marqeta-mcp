/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testMatch: ['**/dist/src/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'dist/src/**/*.js',
    '!dist/src/**/__tests__/**',
    '!dist/src/**/*.test.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};