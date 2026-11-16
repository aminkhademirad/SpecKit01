module.exports = {
  ...require('./jest.config.cjs'),
  displayName: 'integration',
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/concurrency/', '-contract\\.spec\\.ts$'],
  coverageDirectory: '<rootDir>/coverage/integration',
};
