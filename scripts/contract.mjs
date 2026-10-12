#!/usr/bin/env node
// Gate `contract` (spec 0002): os artefatos gerados batem com as fontes fixadas em sources.json.
// Executa os passos em ordem e reporta todas as falhas antes de sair. Cada passo é uma função
// `(context) => Promise<StepResult>`; as tarefas seguintes trocam os passos pendentes pelos reais.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

// Import circular com api-generate.mjs (que usa `verifySource` daqui): seguro, só há declarações
// no topo dos dois módulos e os usos acontecem em tempo de chamada.
import { SCHEMA_PATH, writeTypes } from './api-generate.mjs';
import { generateTheme, THEME_PATH } from './theme.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOG_PATH = resolve(ROOT, 'src/api/errors/catalog.ts');

/**
 * @typedef {{ repository: string, ref: string, path: string, sha256: string }} Source
 * @typedef {{ status: 'PASS' | 'FAIL' | 'SKIP', lines: string[] }} StepResult
 * @typedef {{ sources: Record<string, Source>, fetch: typeof fetch, downloads: Map<string, Buffer> }} Context
 */

export function sourceUrl({ repository, ref, path }) {
    return `https://raw.githubusercontent.com/${repository}/${ref}/${path}`;
}

export function sha256(content) {
    return createHash('sha256').update(content).digest('hex');
}

/** Baixa uma fonte e confere o hash. Sem rede ou com HTTP de erro, falha (ERR-0002-06). */
export async function verifySource(name, source, fetchImpl) {
    const url = sourceUrl(source);
    let response;
    try {
        response = await fetchImpl(url);
    } catch (error) {
        return {
            ok: false,
            message: `${name}: falha ao baixar ${url} (${error.cause?.message ?? error.message}) — sem rede o gate falha`,
        };
    }
    if (!response.ok) {
        return { ok: false, message: `${name}: ${url} respondeu HTTP ${response.status}` };
    }
    const content = Buffer.from(await response.arrayBuffer());
    const actual = sha256(content);
    if (actual !== source.sha256) {
        // ERR-0002-07
        return {
            ok: false,
            message: `${name}: sha256 divergente em ${source.repository}@${source.ref} (${source.path}) — esperado ${source.sha256}, baixado ${actual}`,
        };
    }
    return { ok: true, content, message: `${name}: ${source.repository}@${source.ref} confere` };
}

/** Passo 1: baixa cada fonte de sources.json e confere o sha256. */
export async function downloadSources(context) {
    const lines = [];
    let failed = false;
    for (const [name, source] of Object.entries(context.sources)) {
        const result = await verifySource(name, source, context.fetch);
        lines.push(result.message);
        if (result.ok) context.downloads.set(name, result.content);
        else failed = true;
    }
    if (lines.length === 0) {
        return { status: 'FAIL', lines: ['sources.json não declara nenhuma fonte'] };
    }
    return { status: failed ? 'FAIL' : 'PASS', lines };
}

/** Passo ainda não implementado: SKIP (contexto) com o motivo e a tarefa responsável. */
export function pendingStep(reason, task) {
    return async () => ({ status: 'SKIP', lines: [`${reason} — implementado pela ${task}`] });
}

/** Passo 2: gera os tipos da API a partir do contrato baixado no passo 1 (mesma função do `api:generate`). */
export async function generateApiTypes(context) {
    const content = context.downloads.get('openapi');
    if (!content) {
        return { status: 'FAIL', lines: ['o contrato openapi não foi baixado (passo 1)'] };
    }
    try {
        await writeTypes(content, context.schemaPath ?? SCHEMA_PATH);
    } catch (error) {
        return { status: 'FAIL', lines: [`falha ao gerar os tipos: ${error.message}`] };
    }
    return { status: 'PASS', lines: ['src/api/generated/schema.d.ts gerado do contrato fixado'] };
}

/** Códigos do enum `components.schemas.ErrorCode` de um contrato OpenAPI (YAML ou JSON). */
export function extractErrorCodes(openapiText) {
    const codes = parseYaml(openapiText.toString())?.components?.schemas?.ErrorCode?.enum;
    if (!Array.isArray(codes) || codes.length === 0) {
        throw new Error('o contrato não declara components.schemas.ErrorCode com enum');
    }
    return codes;
}

/**
 * Chaves de `ERROR_MESSAGES` no catálogo TS: o formato é `CODIGO: 'texto'`, uma chave por linha,
 * sem aspas, dentro do bloco `export const ERROR_MESSAGES … = { … };` (convenção do catalog.ts).
 */
export function extractCatalogKeys(catalogSource) {
    const block = /export const ERROR_MESSAGES\b[^=]*=\s*\{\n([\s\S]*?)\n\};/.exec(catalogSource);
    if (!block) throw new Error('bloco ERROR_MESSAGES não encontrado no catálogo');
    return [...block[1].matchAll(/^ {4}([A-Z][A-Z0-9_]*):/gm)].map((match) => match[1]);
}

/** Compara o enum com as chaves: códigos sem mensagem e mensagens sem código (ERR-0002-09). */
export function compareCatalog(codes, keys) {
    const keySet = new Set(keys);
    const codeSet = new Set(codes);
    return {
        withoutMessage: codes.filter((code) => !keySet.has(code)),
        withoutCode: keys.filter((key) => !codeSet.has(key)),
    };
}

/** Passo 4: as chaves de ERROR_MESSAGES são exatamente os valores do enum ErrorCode. */
export async function checkCatalog(context) {
    const content = context.downloads.get('openapi');
    if (!content) {
        return { status: 'FAIL', lines: ['o contrato openapi não foi baixado (passo 1)'] };
    }
    let codes;
    let keys;
    try {
        codes = extractErrorCodes(content);
        keys = extractCatalogKeys(await readFile(context.catalogPath ?? CATALOG_PATH, 'utf8'));
    } catch (error) {
        return { status: 'FAIL', lines: [error.message] };
    }
    const { withoutMessage, withoutCode } = compareCatalog(codes, keys);
    if (withoutMessage.length === 0 && withoutCode.length === 0) {
        return { status: 'PASS', lines: [`${codes.length} códigos, todos com mensagem`] };
    }
    const lines = [];
    if (withoutMessage.length > 0) {
        lines.push(`códigos do contrato sem mensagem no catálogo: ${withoutMessage.join(', ')}`);
    }
    if (withoutCode.length > 0) {
        lines.push(`mensagens no catálogo sem código no contrato: ${withoutCode.join(', ')}`);
    }
    return { status: 'FAIL', lines };
}

/** Passo 3: tokens.css commitado é igual ao tema regenerado em memória da fonte `tokens` (INV-0004-01). */
export async function checkTheme(context) {
    const source = context.sources.tokens;
    if (!source) {
        return {
            status: 'SKIP',
            lines: ['sources.json não declara a fonte tokens — nada a conferir'],
        };
    }
    const content = context.downloads.get('tokens');
    if (!content) {
        return { status: 'FAIL', lines: ['o tokens.json não foi baixado (passo 1)'] };
    }
    let expected;
    try {
        expected = generateTheme(JSON.parse(content.toString()), source);
    } catch (error) {
        return { status: 'FAIL', lines: [`falha ao gerar o tema: ${error.message}`] }; // ERR-0004-01
    }
    let actual;
    try {
        actual = await readFile(context.themePath ?? THEME_PATH, 'utf8');
    } catch (error) {
        return {
            status: 'FAIL',
            lines: [`src/ui/theme/tokens.css ilegível (${error.message}) — rode \`npm run theme\``],
        };
    }
    if (actual === expected) {
        return { status: 'PASS', lines: ['src/ui/theme/tokens.css confere com o tema regenerado'] };
    }
    // ERR-0002-08
    const a = actual.split('\n');
    const e = expected.split('\n');
    const at = e.findIndex((line, index) => line !== a[index]);
    const first = at === -1 ? Math.min(a.length, e.length) : at;
    return {
        status: 'FAIL',
        lines: [
            'src/ui/theme/tokens.css difere do tema regenerado da fonte fixada — rode `npm run theme` e commite o resultado',
            `primeira diferença na linha ${first + 1}: esperado ${JSON.stringify(e[first] ?? '(fim do arquivo)')}, encontrado ${JSON.stringify(a[first] ?? '(fim do arquivo)')}`,
        ],
    };
}

export const STEPS = [
    { title: '1. Baixar as fontes e conferir o sha256', run: downloadSources },
    { title: '2. Gerar os tipos da API', run: generateApiTypes },
    { title: '3. Conferir o tema', run: checkTheme },
    { title: '4. Conferir o catálogo de erros', run: checkCatalog },
];

/** Executa todos os passos, mesmo depois de uma falha. Devolve o código de saída. */
export async function runContract(context, steps = STEPS, log = console.log) {
    let failed = false;
    for (const step of steps) {
        const { status, lines } = await step.run(context);
        log(`${status === 'SKIP' ? 'SKIP (contexto)' : status}  ${step.title}`);
        for (const line of lines) log(`      ${line}`);
        if (status === 'FAIL') failed = true;
    }
    return failed ? 1 : 0;
}

export async function main() {
    const sources = JSON.parse(await readFile(resolve(ROOT, 'sources.json'), 'utf8'));
    const code = await runContract({ sources, fetch, downloads: new Map() });
    if (code !== 0) console.error('\ncontract: FAIL');
    return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await main();
}
