import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        types: ['node', 'jest'],
        esModuleInterop: true,
      },
      diagnostics: {
        ignoreCodes: [2307, 7006],
      },
    }],
  },
  moduleNameMapper: {
    '^node-fetch$': '<rootDir>/test/__mocks__/node-fetch.ts',
    '^papaparse$': '<rootDir>/test/__mocks__/papaparse.ts',
    '^mammoth$': '<rootDir>/test/__mocks__/mammoth.ts',
    '^exceljs$': '<rootDir>/test/__mocks__/exceljs.ts',
    '^@wdio/mcp/snapshot$': '<rootDir>/test/__mocks__/@wdio/mcp/snapshot.ts',
    '^@wdio/globals$': '<rootDir>/test/__mocks__/@wdio/globals.ts',
  },
};

export default config;
