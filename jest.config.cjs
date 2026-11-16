module.exports = {
  rootDir: __dirname,
  displayName: 'unit',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  clearMocks: true,
  restoreMocks: true,
  coverageDirectory: '<rootDir>/coverage/unit',
};
