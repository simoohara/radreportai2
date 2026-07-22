import { defineWorkspace } from 'vitest/config';
import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkspace([
  // Frontend Tests
  {
    extends: './vite.config.ts',
    test: {
      name: 'frontend',
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      globals: true,
    }
  },
  // Backend Tests
  defineWorkersProject({
    test: {
      name: 'backend',
      include: ['worker/**/*.test.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: {
            bindings: {
              SESSION_SECRET: 'test-secret'
            }
          }
        }
      }
    }
  })
]);
