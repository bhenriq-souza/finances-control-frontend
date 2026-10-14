#!/usr/bin/env node
// Gate `build` (spec 0002, spec 0003): build de produção, orçamento de bundle e ausência do
// código usado só pelo e2e (INV-0002-08).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');

const KB = 1000;

/** Orçamento do ADR-0001 (spec 0002). Mudar exige mudar a spec 0002. */
export const BUDGET = {
    initialJs: 250 * KB,
    otherJs: 100 * KB,
    cssTotal: 50 * KB,
};

/** Marcador da implementação falsa de autenticação (spec 0003). */
export const E2E_MARKER = '__E2E_FAKE_AUTH__';

/** Arquivos do JavaScript inicial: cada entrada do manifesto e os seus `imports` estáticos. */
export function initialFiles(manifest) {
    const files = new Set();
    const visit = (key) => {
        const chunk = manifest[key];
        if (!chunk || files.has(chunk.file)) return;
        files.add(chunk.file);
        for (const imported of chunk.imports ?? []) visit(imported);
    };
    for (const [key, chunk] of Object.entries(manifest)) {
        if (chunk.isEntry) visit(key);
    }
    return files;
}

function listFiles(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
    });
}

/** Tamanho gzip de cada `.js` e `.css` de `dist/assets/`, marcando o JavaScript inicial. */
export function measureAssets(distDir, manifest) {
    const initial = initialFiles(manifest);
    return listFiles(join(distDir, 'assets'))
        .filter((path) => /\.(js|css)$/.test(path))
        .map((path) => {
            const file = relative(distDir, path).replaceAll('\\', '/');
            const kind = file.endsWith('.css') ? 'css' : 'js';
            return {
                file,
                kind,
                initial: kind === 'js' && initial.has(file),
                gzip: gzipSync(readFileSync(path)).length,
            };
        })
        .sort((a, b) => a.file.localeCompare(b.file));
}

/** Violações do orçamento, uma mensagem por limite excedido. */
export function budgetViolations(assets, budget = BUDGET) {
    const violations = [];
    const sum = (items) => items.reduce((total, asset) => total + asset.gzip, 0);

    const initial = assets.filter((asset) => asset.initial);
    const initialTotal = sum(initial);
    if (initialTotal > budget.initialJs) {
        violations.push(
            `JavaScript inicial ${formatKb(initialTotal)} > ${formatKb(budget.initialJs)} (${initial.map((a) => a.file).join(', ')})`,
        );
    }
    for (const asset of assets) {
        if (asset.kind === 'js' && !asset.initial && asset.gzip > budget.otherJs) {
            violations.push(
                `chunk ${asset.file} ${formatKb(asset.gzip)} > ${formatKb(budget.otherJs)}`,
            );
        }
    }
    const css = assets.filter((asset) => asset.kind === 'css');
    const cssTotal = sum(css);
    if (cssTotal > budget.cssTotal) {
        violations.push(
            `CSS total ${formatKb(cssTotal)} > ${formatKb(budget.cssTotal)} (${css.map((a) => a.file).join(', ')})`,
        );
    }
    return violations;
}

/** Arquivos de `dist/` que contêm o marcador do e2e. */
export function filesWithMarker(distDir, marker = E2E_MARKER) {
    const needle = Buffer.from(marker);
    return listFiles(distDir)
        .filter((path) => readFileSync(path).includes(needle))
        .map((path) => relative(distDir, path).replaceAll('\\', '/'));
}

export function formatKb(bytes) {
    return `${(bytes / KB).toFixed(2)} KB`;
}

export function sizeTable(assets) {
    const width = Math.max(...assets.map((asset) => asset.file.length), 'arquivo'.length);
    const rows = assets.map(
        (asset) =>
            `  ${asset.file.padEnd(width)}  ${formatKb(asset.gzip).padStart(10)}  ${asset.initial ? 'inicial' : ''}`,
    );
    return [`  ${'arquivo'.padEnd(width)}  ${'gzip'.padStart(10)}`, ...rows].join('\n');
}

/** Avalia um `dist/` já construído. Devolve as mensagens de falha (vazio = PASS). */
export function evaluateDist(distDir, budget = BUDGET, log = console.log) {
    const manifestPath = join(distDir, '.vite', 'manifest.json');
    if (!existsSync(manifestPath)) {
        return [`manifesto ausente: ${relative(ROOT, manifestPath)} (build.manifest desligado?)`];
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const assets = measureAssets(distDir, manifest);
    log(sizeTable(assets));

    const failures = budgetViolations(assets, budget);
    for (const file of filesWithMarker(distDir)) {
        failures.push(`marcador ${E2E_MARKER} encontrado em dist/${file}`);
    }
    return failures;
}

function main() {
    const build = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (build.error || build.status !== 0) {
        console.error(`vite build falhou${build.error ? `: ${build.error.message}` : ''}`);
        return 1;
    }

    console.log('\nOrçamento de bundle (gzip):\n');
    const failures = evaluateDist(DIST);
    if (failures.length > 0) {
        console.error('\nbuild: FAIL');
        for (const failure of failures) console.error(`  - ${failure}`);
        return 1;
    }
    console.log(
        `\nbuild: PASS (inicial ≤ ${formatKb(BUDGET.initialJs)}, demais chunks ≤ ${formatKb(BUDGET.otherJs)}, CSS ≤ ${formatKb(BUDGET.cssTotal)}, sem ${E2E_MARKER})`,
    );
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = main();
}
