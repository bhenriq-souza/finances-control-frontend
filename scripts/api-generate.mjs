#!/usr/bin/env node
// Gera src/api/generated/schema.d.ts a partir da fonte `openapi` de sources.json (spec 0005).
// A mesma função alimenta o passo 2 do gate `contract` (spec 0002).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

import { verifySource } from './contract.mjs';

const ROOT = resolve(import.meta.dirname, '..');
export const SCHEMA_PATH = resolve(ROOT, 'src/api/generated/schema.d.ts');

/** Converte o conteúdo de um contrato OpenAPI (YAML/JSON) em declarações TypeScript. */
export async function generateTypes(content) {
    const ast = await openapiTS(content.toString());
    return astToString(ast);
}

/** Gera e grava os tipos. Devolve o caminho escrito. */
export async function writeTypes(content, outFile = SCHEMA_PATH) {
    const types = await generateTypes(content);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, types);
    return outFile;
}

/** Baixa a fonte `openapi`, confere o sha256 e gera os tipos. */
export async function apiGenerate({ sources, fetch: fetchImpl = fetch, outFile = SCHEMA_PATH }) {
    const source = sources.openapi;
    if (!source) return { ok: false, message: 'sources.json não declara a fonte openapi' };
    const result = await verifySource('openapi', source, fetchImpl);
    if (!result.ok) return result;
    await writeTypes(result.content, outFile);
    return { ok: true, content: result.content, message: result.message };
}

export async function main() {
    const sources = JSON.parse(await readFile(resolve(ROOT, 'sources.json'), 'utf8'));
    const result = await apiGenerate({ sources });
    if (!result.ok) {
        console.error(`api:generate: ${result.message}`);
        return 1;
    }
    console.log(`api:generate: ${result.message}; tipos em src/api/generated/schema.d.ts`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await main();
}
