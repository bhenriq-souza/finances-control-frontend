import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { buildCsp, CSP_ENFORCE } from './csp.mjs';

const THEME = "try { var t = localStorage.getItem('ftech.tema'); } catch (e) {}";
const page = (extra = '', theme = THEME) => `<!doctype html><html><head>
<script src="/config.js"></script>
<script>${theme}</script>${extra}
</head><body><script type="module" src="/assets/index.js"></script></body></html>`;
const sha = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

describe('buildCsp', () => {
    it('AC-0022-01: script-src has self, the theme script hash and apis.google.com', () => {
        const { header, value } = buildCsp(page());
        expect(value).toContain(`script-src 'self' ${sha(THEME)} https://apis.google.com;`);
        expect(header).toBe(
            CSP_ENFORCE ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
        );
    });

    it('AC-0022-01: changing one character changes the hash', () => {
        const a = buildCsp(page()).value;
        const b = buildCsp(page('', THEME.replace('ftech', 'ftecH'))).value;
        expect(a).not.toEqual(b);
    });

    it('selects the header by mode', () => {
        expect(buildCsp(page(), 'enforce').header).toBe('Content-Security-Policy');
        expect(buildCsp(page(), 'report-only').header).toBe('Content-Security-Policy-Report-Only');
    });

    it('INV-0022-01: script-src never has unsafe-inline, unsafe-eval or scheme wildcards', () => {
        const scriptSrc = buildCsp(page())
            .value.split('; ')
            .find((d) => d.startsWith('script-src'));
        expect(scriptSrc).not.toMatch(/unsafe-inline|unsafe-eval|(^|\s)https?:(\s|$)/);
    });

    it('INV-0022-02: the hash comes from the inline script of the given HTML', () => {
        const theme = 'document.title = "x";';
        expect(buildCsp(page('', theme)).value).toContain(sha(theme));
    });

    it('ignores external scripts and commented-out markup', () => {
        expect(() =>
            buildCsp(page('<!-- <style>a{}</style> <script>x</script> -->')),
        ).not.toThrow();
    });

    it('AC-0022-02 / ERR-0022-01: fails without an inline script', () => {
        const html = '<html><head><script src="/config.js"></script></head></html>';
        expect(() => buildCsp(html)).toThrow(/tema/);
    });

    it('AC-0022-02 / ERR-0022-02: fails on an inline <style>', () => {
        expect(() => buildCsp(page('<style>body{margin:0}</style>'))).toThrow(/<style>/);
    });

    it('AC-0022-02 / ERR-0022-02: fails on an event attribute', () => {
        expect(() => buildCsp(page('<body onclick="x()">'))).toThrow(/onclick/);
    });

    it('AC-0022-02 / ERR-0022-02: fails on an unexpected second inline script', () => {
        expect(() => buildCsp(page('<script>alert(1)</script>'))).toThrow(/inesperado/);
    });

    it('AC-0022-02 / ERR-0022-02: fails on an inline script of another type', () => {
        expect(() => buildCsp(page('<script type="text/template">x</script>'))).toThrow(
            /text\/template/,
        );
    });

    it('AC-0022-02 / ERR-0022-02: fails on javascript: in href', () => {
        expect(() => buildCsp(page('<a href="javascript:void(0)">x</a>'))).toThrow(/javascript:/);
    });
});

describe('CLI', () => {
    const run = (html) => {
        const dir = mkdtempSync(join(tmpdir(), 'ftech-csp-'));
        try {
            writeFileSync(join(dir, 'index.html'), html);
            const out = join(dir, 'csp.conf');
            const result = spawnSync('node', [join(import.meta.dirname, 'csp.mjs'), dir, out], {
                encoding: 'utf8',
            });
            return {
                status: result.status,
                stderr: result.stderr,
                conf: result.status === 0 ? readFileSync(out, 'utf8') : '',
            };
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    it('writes a single add_header line', () => {
        const { status, conf } = run(page());
        expect(status).toBe(0);
        expect(conf.trimEnd().split('\n')).toHaveLength(1);
        expect(conf).toMatch(/^add_header Content-Security-Policy(-Report-Only)? ".*" always;\n$/);
        expect(conf).toContain(sha(THEME));
    });

    it('exits 1 naming the problem', () => {
        const { status, stderr } = run(page('<style>a{}</style>'));
        expect(status).toBe(1);
        expect(stderr).toContain('<style>');
    });
});
