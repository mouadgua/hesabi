import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Collect coverage from lib/ and utils/
  collectCoverageFrom: [
    'lib/**/*.js',
    'utils/**/*.js',
    '!lib/prisma.js',    // DB singleton — not unit-testable without DB
  ],
  coverageThreshold: {
    global: { lines: 70, functions: 70 },
  },
}

export default createJestConfig(config)
