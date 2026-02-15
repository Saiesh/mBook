import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'happy-dom', // Lightweight DOM for testing
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Global test utilities
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        '.next/',
        'coverage/',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    
    // Test file patterns
    include: [
      '**/__tests__/**/*.test.ts',
      '**/__tests__/**/*.spec.ts',
      '**/tests/**/*.test.ts',
      '**/tests/**/*.spec.ts',
    ],
    
    // Timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Parallel execution
    maxConcurrency: 5,
    
    // Reporter configuration
    reporters: ['verbose'],
    
    // Mock reset behavior
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
