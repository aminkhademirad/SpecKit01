module.exports = {
  ...require('./jest.config.cjs'),
  displayName: 'concurrency',
  testMatch: ['<rootDir>/test/integration/concurrency/**/*.spec.ts'],
  coverageDirectory: '<rootDir>/coverage/concurrency',
};
