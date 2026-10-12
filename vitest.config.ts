import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            projects: [
                {
                    extends: true,
                    test: {
                        name: 'app',
                        environment: 'jsdom',
                        include: ['src/**/*.test.{ts,tsx}'],
                        setupFiles: ['./src/test-setup.ts'],
                    },
                },
                {
                    test: {
                        name: 'scripts',
                        environment: 'node',
                        include: ['scripts/**/*.test.mjs'],
                    },
                },
            ],
            coverage: {
                provider: 'v8',
                include: ['src/**/*.{ts,tsx}'],
                // Fora da medição (spec 0002): código gerado, componentes copiados do shadcn/ui
                // sem alteração e o ponto de entrada, que só chama `bootstrap` (testado).
                exclude: [
                    'src/routeTree.gen.ts',
                    'src/api/generated/**',
                    'src/ui/components/ui/**',
                    'src/main.tsx',
                    'src/test-setup.ts',
                    'src/**/*.d.ts',
                    'src/**/*.test.{ts,tsx}',
                ],
                thresholds: {
                    branches: 75,
                    functions: 90,
                    lines: 90,
                    statements: 90,
                },
            },
        },
    }),
);
