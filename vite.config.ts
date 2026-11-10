import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { buildCsp } from './scripts/csp.mjs';

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

/**
 * Em `vite preview` (modo `e2e`) não há nginx: este plugin faz o papel dele (spec 0022). Cada
 * resposta leva a CSP **imposta**, gerada por `buildCsp` sobre o `dist/index.html` do próprio build,
 * com um nonce novo por requisição em `style-src-elem`; o `index.html` ganha a meta `csp-nonce`
 * com o mesmo valor, como o `sub_filter` do nginx.
 */
function enforceCspInPreview(): Plugin {
    return {
        name: 'ftech:e2e-csp',
        apply: 'serve', // só o preview (configurePreviewServer); no build não faz nada
        configurePreviewServer(server) {
            if (server.config.mode !== 'e2e') return;
            const { outDir } = server.config.build;
            const dist = resolve(server.config.root, outDir);
            server.middlewares.use((req, res, next) => {
                void (async () => {
                    const indexHtml = await readFile(resolve(dist, 'index.html'), 'utf8');
                    const nonce = randomUUID().replaceAll('-', '');
                    const { header, value } = buildCsp(indexHtml, 'enforce', nonce);
                    res.setHeader(header, value);
                    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
                    // Fallback da SPA: o que não é arquivo nem a API devolve o index.html.
                    if (pathname === '/' || pathname === '/index.html' || !pathname.includes('.')) {
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        res.setHeader('Cache-Control', 'no-cache');
                        res.end(
                            indexHtml.replace(
                                '</head>',
                                `<meta name="csp-nonce" content="${nonce}"></head>`,
                            ),
                        );
                        return;
                    }
                    next();
                })().catch(next);
            });
        },
    };
}

export default defineConfig({
    plugins: [
        // Antes do plugin do React (exigência do plugin do roteador). A configuração fica em
        // tsr.config.json, a mesma que scripts/routes-generate.mjs usa (spec 0003).
        tanstackRouter(),
        react(),
        tailwindcss(),
        excludeRuntimeConfig(),
        enforceCspInPreview(),
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
