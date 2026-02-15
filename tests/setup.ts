/**
 * Global test setup file
 * Runs before all tests to configure the test environment
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(__dirname, '../.env.test') });

// Global test hooks
beforeAll(() => {
  // Setup that runs once before all tests
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  // Cleanup that runs once after all tests
  console.log('✅ Test suite completed');
});

afterEach(() => {
  // Cleanup after each test
  // This is handled by vitest's clearMocks, mockReset, restoreMocks config
});

// Extend test timeout for integration tests
const EXTENDED_TIMEOUT = 30000;

// Make extended timeout available globally
declare global {
  const EXTENDED_TEST_TIMEOUT: number;
}

(global as any).EXTENDED_TEST_TIMEOUT = EXTENDED_TIMEOUT;
