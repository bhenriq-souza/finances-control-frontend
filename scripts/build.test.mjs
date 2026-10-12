import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BUDGET,
    budgetViolations,
    E2E_MARKER,
    evaluateDist,
    filesWithMarker,
    formatKb,
    initialFiles,
    measureAssets,
    sizeTable,
} from './build.mjs';

const MANIFEST = {
    'index.html': {
        file: 'assets/index-a.js',
        isEntry: true,
        imports: ['_vendor-b.js'],
        dynamicImports: ['src/routes/index.tsx'],
        css: ['assets/index-c.css'],
    },
    '_vendor-b.js': { file: 'assets/vendor-b.js', imports: ['_shared-d.js'] },
    '_shared-d.js': { file: 'assets/shared-d.js', imports: ['_vendor-b.js'] },
    'src/routes/index.tsx': { file: 'assets/route-e.js', isDynamicEntry: true },
};

let dist;

function writeDist(files, manifest = MANIFEST) {
    for (const [name, content] of Object.entries(files)) {
        const path = join(dist, name);
        mkdirSync(join(path, '..'), { recursive: true });
        writeFileSync(path, content);
    }
    if (manifest) {
        mkdirSync(join(dist, '.vite'), { recursive: true });
        writeFileSync(join(dist, '.vite', 'manifest.json'), JSON.stringify(manifest));
    }
}

/** Conteúdo que não comprime: o gzip fica perto do tamanho original. */
const incompressible = (bytes) => randomBytes(bytes).toString('base64').slice(0, bytes);

beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'ftech-build-'));
});

afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
});

describe('initialFiles', () => {
    it('takes the entry and its static imports, transitively, but not dynamic imports', () => {
        expect([...initialFiles(MANIFEST)].sort()).toEqual([
            'assets/index-a.js',
            'assets/shared-d.js',
            'assets/vendor-b.js',
        ]);
    });
});

describe('measureAssets', () => {
    it('measures the gzip size of every .js and .css in dist/assets and flags the initial JS', () => {
        writeDist({
            'assets/index-a.js': 'console.log(1);',
            'assets/vendor-b.js': 'export const b = 1;',
            'assets/shared-d.js': 'export const d = 1;',
            'assets/route-e.js': 'export const e = 1;',
            'assets/index-c.css': 'body{margin:0}',
            'assets/logo.svg': '<svg/>',
        });
        const assets = measureAssets(dist, MANIFEST);
        expect(assets.map(({ file, kind, initial }) => [file, kind, initial])).toEqual([
            ['assets/index-a.js', 'js', true],
            ['assets/index-c.css', 'css', false],
            ['assets/route-e.js', 'js', false],
            ['assets/shared-d.js', 'js', true],
            ['assets/vendor-b.js', 'js', true],
        ]);
        expect(assets.every((asset) => asset.gzip > 0)).toBe(true);
    });
});

describe('budgetViolations', () => {
    const asset = (file, kind, initial, gzip) => ({ file, kind, initial, gzip });

    it('passes within the spec 0002 budget', () => {
        expect(BUDGET).toEqual({ initialJs: 250_000, otherJs: 100_000, cssTotal: 50_000 });
        const assets = [
            asset('assets/index.js', 'js', true, 150_000),
            asset('assets/vendor.js', 'js', true, 100_000),
            asset('assets/route.js', 'js', false, 100_000),
            asset('assets/a.css', 'css', false, 25_000),
            asset('assets/b.css', 'css', false, 25_000),
        ];
        expect(budgetViolations(assets)).toEqual([]);
    });

    it('fails when the initial JS, summed, exceeds 250 KB', () => {
        const violations = budgetViolations([
            asset('assets/index.js', 'js', true, 200_000),
            asset('assets/vendor.js', 'js', true, 50_001),
        ]);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toContain('JavaScript inicial 250.00 KB > 250.00 KB');
        expect(violations[0]).toContain('assets/vendor.js');
    });

    it('fails naming each non-initial chunk above 100 KB', () => {
        const violations = budgetViolations([
            asset('assets/index.js', 'js', true, 10),
            asset('assets/big.js', 'js', false, 100_001),
            asset('assets/ok.js', 'js', false, 100_000),
        ]);
        expect(violations).toEqual(['chunk assets/big.js 100.00 KB > 100.00 KB']);
    });

    it('fails when the CSS total exceeds 50 KB', () => {
        const violations = budgetViolations([
            asset('assets/a.css', 'css', false, 30_000),
            asset('assets/b.css', 'css', false, 20_001),
        ]);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatch(/^CSS total .* \(assets\/a\.css, assets\/b\.css\)$/);
    });

    it('applies a lowered budget (AC-0002-08)', () => {
        const assets = [asset('assets/index.js', 'js', true, 1_000)];
        expect(budgetViolations(assets, { ...BUDGET, initialJs: 999 })).toHaveLength(1);
    });
});

describe('filesWithMarker', () => {
    it('finds the e2e marker in any file of dist/', () => {
        writeDist(
            {
                'assets/index-a.js': 'console.log(1);',
                'assets/route-e.js': `const fake = "${E2E_MARKER}";`,
                'index.html': '<html></html>',
            },
            null,
        );
        expect(filesWithMarker(dist)).toEqual(['assets/route-e.js']);
    });
});

describe('evaluateDist', () => {
    const silent = () => {};

    it('passes a dist within budget and without the marker, printing the size table', () => {
        writeDist({ 'assets/index-a.js': 'console.log(1);', 'assets/index-c.css': 'body{}' });
        const printed = [];
        expect(evaluateDist(dist, BUDGET, (line) => printed.push(line))).toEqual([]);
        expect(printed.join('\n')).toContain('assets/index-a.js');
    });

    it('fails with the offending file when the marker reaches the production build (AC-0002-08)', () => {
        writeDist({ 'assets/index-a.js': `"${E2E_MARKER}"` });
        expect(evaluateDist(dist, BUDGET, silent)).toEqual([
            `marcador ${E2E_MARKER} encontrado em dist/assets/index-a.js`,
        ]);
    });

    it('fails when a budget limit is lowered below the current size (AC-0002-08)', () => {
        writeDist({ 'assets/index-a.js': incompressible(4_000) });
        const failures = evaluateDist(dist, { ...BUDGET, initialJs: 1_000 }, silent);
        expect(failures).toHaveLength(1);
        expect(failures[0]).toContain('JavaScript inicial');
    });

    it('fails when the manifest is missing', () => {
        writeDist({ 'assets/index-a.js': 'x' }, null);
        expect(evaluateDist(dist, BUDGET, silent)[0]).toContain('manifesto ausente');
    });
});

describe('formatting', () => {
    it('prints sizes in KB and a table with the initial chunks flagged', () => {
        expect(formatKb(1_234)).toBe('1.23 KB');
        const table = sizeTable([
            { file: 'assets/index.js', kind: 'js', initial: true, gzip: 2_000 },
            { file: 'assets/a.css', kind: 'css', initial: false, gzip: 500 },
        ]);
        expect(table).toMatch(/assets\/index\.js\s+2\.00 KB\s+inicial/);
        expect(table).toMatch(/assets\/a\.css\s+0\.50 KB/);
    });
});
