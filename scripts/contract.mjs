#!/usr/bin/env node
// Gate `contract` (spec 0002): os artefatos gerados batem com as fontes fixadas em sources.json.
// Executa os passos em ordem e reporta todas as falhas antes de sair. Cada passo é uma função
// `(context) => Promise<StepResult>`; as tarefas seguintes trocam os passos pendentes pelos reais.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');

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

export const STEPS = [
    { title: '1. Baixar as fontes e conferir o sha256', run: downloadSources },
    {
        title: '2. Gerar os tipos da API',
        run: pendingStep('src/api/generated/schema.d.ts ainda não é gerado', 'T-0005-01'),
    },
    {
        title: '3. Conferir o tema',
        run: pendingStep(
            'o tema (src/ui/theme/tokens.css) e a entrada tokens de sources.json ainda não existem',
            'T-0004-01',
        ),
    },
    {
        title: '4. Conferir o catálogo de erros',
        run: pendingStep('o catálogo de erros pt-BR ainda não existe', 'T-0005-01'),
    },
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
