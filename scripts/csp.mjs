#!/usr/bin/env node
// Gerador da Content-Security-Policy (spec 0022). O hash do script inline do tema (spec 0004)
// é calculado do `index.html` construído; o mesmo código decide no Dockerfile e no gate `build`.
//
// CLI: node scripts/csp.mjs <dist> <saída.conf>

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** `false`: cabeçalho `Report-Only`; `true`: política imposta. Constante em código (INV-0022-03). */
export const CSP_ENFORCE = false;

export const HEADER_ENFORCE = 'Content-Security-Policy';
export const HEADER_REPORT_ONLY = 'Content-Security-Policy-Report-Only';

/** Erro de política: o HTML tem algo que a CSP não cobre (ERR-0022-01, ERR-0022-02). */
export class CspError extends Error {}

const excerpt = (text) => text.replace(/\s+/g, ' ').trim().slice(0, 80);

/**
 * Tira os comentários sem regex de substituição. O gate é conservador: o que um navegador leria de
 * outro jeito (comentário sem fim, aninhado ou declaração `<!` que não é o doctype) vira problema, em
 * vez de ser removido e esconder um script (alertas do CodeQL no PR #185).
 */
function stripComments(html, problems) {
    let out = '';
    let i = 0;
    for (;;) {
        const start = html.indexOf('<!--', i);
        if (start < 0) {
            out += html.slice(i);
            break;
        }
        out += html.slice(i, start);
        const after = start + 4;
        if (html.startsWith('>', after) || html.startsWith('->', after)) {
            i = html.indexOf('>', after) + 1; // `<!-->` e `<!--->` fecham na hora
            continue;
        }
        const end = html.indexOf('-->', after);
        if (end < 0) {
            problems.push(`comentário sem fim: ${excerpt(html.slice(start))}`);
            break;
        }
        if (html.slice(after, end).includes('<!--')) {
            problems.push(`comentário aninhado: ${excerpt(html.slice(start, end + 3))}`);
        }
        i = end + 3;
    }
    for (const match of out.matchAll(/<!(?!doctype\b)[^>]*>?/gi)) {
        problems.push(`declaração <! inesperada: ${excerpt(match[0])}`);
    }
    return out;
}

/** Scripts inline do HTML (sem `src`) e os problemas não cobertos pela política. */
export function analyzeHtml(html) {
    const hashes = [];
    const problems = [];
    const source = stripComments(html, problems);

    // o navegador fecha o script em `</script` seguido de espaço, `/` ou `>`, com o que vier até o `>`
    const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script(?:[\s/][^>]*)?>/gi)];
    const opened = source.match(/<script\b/gi)?.length ?? 0;
    if (opened !== scripts.length) {
        problems.push(`script sem fechamento: ${opened} aberto(s), ${scripts.length} fechado(s)`);
    }
    for (const match of scripts) {
        const [whole, attrs, content] = match;
        if (/(^|\s)src\s*=/i.test(attrs)) continue;
        const type = /(?:^|\s)type\s*=\s*["']?([^\s"'>]+)/i.exec(attrs)?.[1];
        if (type !== undefined && type.toLowerCase() !== 'module') {
            problems.push(`<script type="${type}"> inline não coberto: ${excerpt(whole)}`);
            continue;
        }
        if (type !== undefined || hashes.length > 0) {
            problems.push(`script inline inesperado sem hash previsto: ${excerpt(whole)}`);
            continue;
        }
        hashes.push(`'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`);
    }

    for (const match of source.matchAll(/<style\b[^>]*>/gi)) {
        problems.push(`<style> inline não coberto: ${excerpt(match[0])}`);
    }
    for (const match of source.matchAll(/<[a-z][^>]*\s(on[a-z]+)\s*=[^>]*>/gi)) {
        problems.push(`atributo de evento ${match[1]} não coberto: ${excerpt(match[0])}`);
    }
    for (const match of source.matchAll(/<[a-z][^>]*\shref\s*=\s*["']?\s*javascript:[^>]*>/gi)) {
        problems.push(`javascript: em href não coberto: ${excerpt(match[0])}`);
    }
    if (hashes.length === 0 && problems.length === 0) {
        problems.push('nenhum script inline no index.html: o script de tema (spec 0004) sumiu');
    }
    return { hashes, problems };
}

/** Variável do nginx que carrega o nonce da requisição (`$request_id`, 32 hex; spec 0022). */
export const NGINX_NONCE = '$request_id';

/**
 * Monta a política a partir dos hashes dos scripts inline. `nonce` é o valor posto em
 * `style-src-elem`: no nginx é a variável `$request_id` (expandida por requisição); no preview do
 * e2e, um valor gerado por requisição.
 */
export function policy(hashes, nonce = NGINX_NONCE) {
    return [
        "default-src 'self'",
        `script-src ${["'self'", ...hashes, 'https://apis.google.com'].join(' ')}`,
        "style-src 'self'",
        `style-src-elem 'self' 'nonce-${nonce}'`,
        "img-src 'self' data: blob: https://*.googleusercontent.com",
        "font-src 'self' data:",
        "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
        'frame-src https://*.firebaseapp.com https://accounts.google.com',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; ');
}

/**
 * Cabeçalho e valor da CSP para um `index.html`. Lança `CspError` se houver inline não coberto.
 * `mode`: 'enforce' | 'report-only'; por omissão segue `CSP_ENFORCE`. `nonce`: ver `policy`.
 */
export function buildCsp(
    html,
    mode = CSP_ENFORCE ? 'enforce' : 'report-only',
    nonce = NGINX_NONCE,
) {
    const { hashes, problems } = analyzeHtml(html);
    if (problems.length > 0) throw new CspError(problems.join('\n'));
    return {
        header: mode === 'enforce' ? HEADER_ENFORCE : HEADER_REPORT_ONLY,
        value: policy(hashes, nonce),
    };
}

/** Conteúdo do `csp.conf`: uma só linha. */
export function confLine({ header, value }) {
    return `add_header ${header} "${value}" always;\n`;
}

function main(argv) {
    const [dist, out] = argv;
    if (!dist || !out) {
        console.error('uso: node scripts/csp.mjs <dist> <saída.conf>');
        return 1;
    }
    const indexPath = join(dist, 'index.html');
    if (!existsSync(indexPath)) {
        console.error(`csp: ${indexPath} não existe`);
        return 1;
    }
    try {
        writeFileSync(out, confLine(buildCsp(readFileSync(indexPath, 'utf8'))));
    } catch (error) {
        if (!(error instanceof CspError)) throw error;
        console.error(`csp: FAIL\n${error.message}`);
        return 1;
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = main(process.argv.slice(2));
}
