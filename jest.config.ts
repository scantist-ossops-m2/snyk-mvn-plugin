import type { Config } from '@jest/types';

export default async (): Promise<Config.InitialOptions> => {
  return {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {}, // ignore .babelrc file
    collectCoverage: false, // Enabled by running `npm run test:coverage`
    collectCoverageFrom: ['src/**/*.ts'],
    coverageReporters: ['text-summary', 'html'],
    testMatch: ['<rootDir>/tests/**/*.spec.ts', '<rootDir>/test/**/*.test.ts'],
  };
};
