#!/usr/bin/env node
// Gera src/routeTree.gen.ts a partir de src/routes/ (spec 0003). O arquivo é ignorado pelo Git:
// este script, o passo 5 do gate `contract` (spec 0002) e o plugin do roteador no Vite o refazem,
// todos com a mesma configuração, lida de tsr.config.json.

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Generator, getConfig } from '@tanstack/router-generator';

const ROOT = resolve(import.meta.dirname, '..');
export const ROUTE_TREE_PATH = resolve(ROOT, 'src/routeTree.gen.ts');

/** Gera a árvore de rotas da raiz `root` (a do repositório, por padrão). */
export async function generateRoutes(root = ROOT) {
    const config = getConfig({}, root);
    await new Generator({ config, root }).run();
    return config.generatedRouteTree;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const path = await generateRoutes();
    console.log(`${path} gerado de src/routes/`);
}
