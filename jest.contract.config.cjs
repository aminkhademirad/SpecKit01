module.exports = {
  ...require('./jest.config.cjs'),
  displayName: 'contract',
  testMatch: ['<rootDir>/test/integration/**/*-contract.spec.ts'],
  coverageDirectory: '<rootDir>/coverage/contract',
};
