import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * `public/config.js` é a configuração de runtime local (spec 0003): em `dev` e `prd` ela vem do
 * ConfigMap, então o build nunca a contém, mesmo que exista uma cópia local em `public/`. O
 * exemplo commitado também fica de fora: não é servido por ninguém.
 */
const RUNTIME_CONFIG_FILES = ['config.js', 'config.example.js'];

function excludeRuntimeConfig(): Plugin {
    let outDir = 'dist';
    return {
        name: 'ftech:exclude-runtime-config',
        apply: 'build',
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
        },
        async closeBundle() {
            await Promise.all(
                RUNTIME_CONFIG_FILES.map((file) => rm(resolve(outDir, file), { force: true })),
            );
        },
    };
}

export default defineConfig({
    plugins: [
        // Antes do plugin do React (exigência do plugin do roteador).
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
            routesDirectory: './src/routes',
            generatedRouteTree: './src/routeTree.gen.ts',
        }),
        react(),
        tailwindcss(),
        excludeRuntimeConfig(),
    ],
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, 'src'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        // Espelha o `stripPrefix` do ingress: `/api/x` chega ao backend como `/x`.
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    build: {
        // O gate `build` identifica o JavaScript inicial pelo manifesto (spec 0003).
        manifest: true,
    },
});
