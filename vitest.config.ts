import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// worker/ has its own vitest.config.ts (Workers runtime via
		// @cloudflare/vitest-pool-workers) and scripts/ uses node:test —
		// both run via their own commands, not this root `npm test`.
		exclude: ['**/node_modules/**', 'dist/**', 'worker/**', 'scripts/**', 'admin/**'],
	},
});
