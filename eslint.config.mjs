import { defineConfig } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  // Why: Next.js 16 + ESLint 9 expects flat config, and this keeps the same lint baseline as the old next/core-web-vitals setup.
  ...nextCoreWebVitals,
]);
