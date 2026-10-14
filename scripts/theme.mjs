#!/usr/bin/env node
// Gera src/ui/theme/tokens.css a partir da fonte `tokens` de sources.json (spec 0004).
// A mesma função pura alimenta o passo 3 do gate `contract` (spec 0002).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifySource } from './contract.mjs';

const ROOT = resolve(import.meta.dirname, '..');
export const THEME_PATH = resolve(ROOT, 'src/ui/theme/tokens.css');

const THEMES = ['escuro', 'claro'];
const NAME = /^[a-z0-9-]+$/;
const ALIAS = /^\{([^{}]*)\}$/;

/** Variáveis do shadcn/ui → token semântico (spec 0004, tabela do arquivo gerado). */
const SHADCN = [
    ['background', 'fundo'],
    ['foreground', 'texto'],
    ['card', 'superficie'],
    ['card-foreground', 'texto'],
    ['popover', 'superficie'],
    ['popover-foreground', 'texto'],
    ['primary', 'acento'],
    ['primary-foreground', 'sobre-acento'],
    ['secondary', 'superficie-elevada'],
    ['secondary-foreground', 'texto'],
    ['muted', 'superficie-elevada'],
    ['muted-foreground', 'texto-apoio'],
    ['accent', 'superficie-elevada'],
    ['accent-foreground', 'texto'],
    ['destructive', 'negativo'],
    ['border', 'linha'],
    ['input', 'linha-forte'],
    ['ring', 'foco'],
];

function assertName(name, where) {
    if (typeof name !== 'string' || !NAME.test(name)) {
        throw new Error(
            `nome de token inválido em ${where}: ${JSON.stringify(name)} (use [a-z0-9-]+)`,
        );
    }
}

/** Valor do token no tema, com aliases `{outro-token}` resolvidos (mesma regra do check-contrast do hub). */
function resolveColor(byName, name, theme, seen = []) {
    const token = byName.get(name);
    if (!token) throw new Error(`alias não resolve: ${seen.at(-1) ?? name} → {${name}}`);
    if (seen.includes(name))
        throw new Error(`alias circular em ${name}: ${[...seen, name].join(' → ')}`);
    const value =
        typeof token.value === 'object' && token.value !== null ? token.value[theme] : token.value;
    if (typeof value !== 'string' || value === '') {
        throw new Error(`token ${name} não tem valor para o tema ${theme}`);
    }
    const alias = ALIAS.exec(value);
    if (alias) return resolveColor(byName, alias[1], theme, [...seen, name]);
    return value;
}

function table(tokens, where) {
    if (!Array.isArray(tokens)) throw new Error(`${where} ausente no tokens.json`);
    tokens.forEach((token) => assertName(token?.name, where));
    return tokens;
}

function themeBlock(indent, semantic, byName, theme, shadow) {
    const lines = semantic.map(
        (token) => `${indent}--ft-${token.name}: ${resolveColor(byName, token.name, theme)};`,
    );
    for (const token of shadow) {
        const value = token.value?.[theme];
        if (typeof value !== 'string' || value === '') {
            throw new Error(`token ${token.name} não tem valor para o tema ${theme}`);
        }
        lines.push(`${indent}--ft-${token.name}: ${value};`);
    }
    return lines.join('\n');
}

/**
 * Gera o CSS de tokens.css (formato normativo da spec 0004). Pura e determinística; lança Error
 * em alias que não resolve, cor sem valor para os dois temas ou nome de token inválido (ERR-0004-01).
 * @param {object} tokens conteúdo do tokens.json do hub
 * @param {{ repository: string, ref: string, path: string, sha256: string }} source
 */
export function generateTheme(tokens, source) {
    const colors = table(tokens?.color?.tokens, 'color.tokens');
    const byName = new Map(colors.map((token) => [token.name, token]));
    const semantic = colors.filter((token) => !token.name.startsWith('marca-'));
    const shadow = table(tokens?.shadow?.tokens, 'shadow.tokens');
    const radius = table(tokens?.radius?.tokens, 'radius.tokens');
    const breakpoint = table(tokens?.breakpoint?.tokens, 'breakpoint.tokens');
    const radiusByName = new Map(radius.map((token) => [token.name, token.value]));
    const breakpointByName = new Map(breakpoint.map((token) => [token.name, token.value]));
    const families = tokens?.type?.families ?? {};
    const styles = (tokens?.type?.groups ?? []).flatMap((group) => group.styles ?? []);
    styles.forEach((style) => assertName(style?.name, 'type.groups'));

    for (const theme of THEMES) {
        for (const token of colors) resolveColor(byName, token.name, theme);
    }
    for (const [, target] of SHADCN) {
        if (!semantic.some((token) => token.name === target)) {
            throw new Error(`token ${target} (mapeamento do shadcn/ui) não existe no tokens.json`);
        }
    }
    const need = (map, name, where) => {
        if (!map.has(name)) throw new Error(`token ${name} (${where}) não existe no tokens.json`);
        return map.get(name);
    };
    for (const family of ['sans', 'mono']) {
        if (typeof families[family] !== 'string')
            throw new Error(`type.families.${family} ausente`);
    }

    const header = `/* Gerado por scripts/theme.mjs — não edite. Fonte: ${source.repository}@${source.ref} (${source.path}), sha256 ${source.sha256}. */`;
    const dark = themeBlock('    ', semantic, byName, 'escuro', shadow);
    const light = themeBlock('    ', semantic, byName, 'claro', shadow);
    const lightMedia = themeBlock('        ', semantic, byName, 'claro', shadow);

    const shadcnVars = [
        ...SHADCN.map(([name, target]) => `    --${name}: var(--ft-${target});`),
        `    --radius: ${need(radiusByName, 'raio-md', 'shadcn --radius')};`,
    ].join('\n');

    const themeLines = [
        ...semantic.map((token) => `    --color-${token.name}: var(--ft-${token.name});`),
        ...SHADCN.map(([name]) => `    --color-${name}: var(--${name});`),
        `    --font-sans: ${families.sans};`,
        `    --font-mono: ${families.mono};`,
        '    --spacing: 4px;',
        ...['sm', 'md', 'lg'].map(
            (size) => `    --radius-${size}: ${need(radiusByName, `raio-${size}`, '@theme')};`,
        ),
        `    --radius-full: ${need(radiusByName, 'raio-pill', '@theme')};`,
        `    --breakpoint-md: ${need(breakpointByName, 'bp-tablet', '@theme')};`,
        `    --breakpoint-lg: ${need(breakpointByName, 'bp-desktop', '@theme')};`,
        ...styles.flatMap((style) => [
            `    --text-${style.name}: ${style.fontSize};`,
            `    --text-${style.name}--line-height: ${style.lineHeight};`,
            `    --text-${style.name}--font-weight: ${style.fontWeight};`,
            ...(style.letterSpacing
                ? [`    --text-${style.name}--letter-spacing: ${style.letterSpacing};`]
                : []),
        ]),
    ].join('\n');

    return `${[
        header,
        `:root,\n:root[data-tema='escuro'] {\n${dark}\n}`,
        `:root[data-tema='claro'] {\n${light}\n}`,
        `@media (prefers-color-scheme: light) {\n    :root:not([data-tema]) {\n${lightMedia}\n    }\n}`,
        `:root {\n${shadcnVars}\n}`,
        `@theme inline {\n${themeLines}\n}`,
    ].join('\n\n')}\n`;
}

/** Baixa a fonte `tokens`, confere o sha256 e grava o CSS (nada é gravado se algo falhar). */
export async function writeTheme({ sources, fetch: fetchImpl = fetch, outFile = THEME_PATH }) {
    const source = sources.tokens;
    if (!source) return { ok: false, message: 'sources.json não declara a fonte tokens' };
    const result = await verifySource('tokens', source, fetchImpl);
    if (!result.ok) return result;
    let css;
    try {
        css = generateTheme(JSON.parse(result.content.toString()), source);
    } catch (error) {
        return { ok: false, message: `tokens: ${error.message}` }; // ERR-0004-01
    }
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, css);
    return { ok: true, message: result.message };
}

export async function main() {
    const sources = JSON.parse(await readFile(resolve(ROOT, 'sources.json'), 'utf8'));
    const result = await writeTheme({ sources });
    if (!result.ok) {
        console.error(`theme: ${result.message}`);
        return 1;
    }
    console.log(`theme: ${result.message}; tema em src/ui/theme/tokens.css`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await main();
}
