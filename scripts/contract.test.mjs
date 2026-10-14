import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    checkCatalog,
    checkTheme,
    compareCatalog,
    downloadSources,
    extractCatalogKeys,
    extractErrorCodes,
    generateApiTypes,
    generateRouteTree,
    pendingStep,
    runContract,
    sha256,
    sourceUrl,
    STEPS,
    verifySource,
} from './contract.mjs';
import { generateRoutes } from './routes-generate.mjs';
import { generateTheme } from './theme.mjs';

const CONTENT = 'openapi: 3.1.0\n';
const SOURCE = {
    repository: 'bhenriq-souza/finances-control-backend',
    ref: 'v1.1.0',
    path: 'docs/openapi.yaml',
    sha256: sha256(CONTENT),
};

function fetchReturning(body, status = 200) {
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        return new Response(body, { status });
    };
    return { fetchImpl, calls };
}

function context(sources, fetchImpl) {
    return { sources, fetch: fetchImpl, downloads: new Map() };
}

describe('sourceUrl', () => {
    it('points at raw.githubusercontent.com for the pinned ref', () => {
        expect(sourceUrl(SOURCE)).toBe(
            'https://raw.githubusercontent.com/bhenriq-souza/finances-control-backend/v1.1.0/docs/openapi.yaml',
        );
    });
});

describe('verifySource', () => {
    it('passes when the downloaded content matches the pinned sha256', async () => {
        const { fetchImpl, calls } = fetchReturning(CONTENT);
        const result = await verifySource('openapi', SOURCE, fetchImpl);
        expect(result.ok).toBe(true);
        expect(result.content.toString()).toBe(CONTENT);
        expect(calls).toEqual([sourceUrl(SOURCE)]);
    });

    it('fails citing the source, the ref and both hashes when the sha256 diverges (ERR-0002-07)', async () => {
        const { fetchImpl } = fetchReturning('tampered');
        const result = await verifySource('openapi', SOURCE, fetchImpl);
        expect(result.ok).toBe(false);
        expect(result.message).toContain('openapi');
        expect(result.message).toContain('v1.1.0');
        expect(result.message).toContain(SOURCE.sha256);
        expect(result.message).toContain(sha256('tampered'));
    });

    it('fails without network instead of skipping (ERR-0002-06)', async () => {
        const offline = async () => {
            throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') });
        };
        const result = await verifySource('openapi', SOURCE, offline);
        expect(result.ok).toBe(false);
        expect(result.message).toContain('ENOTFOUND');
        expect(result.message).toContain('sem rede o gate falha');
    });

    it('fails on an HTTP error', async () => {
        const { fetchImpl } = fetchReturning('not found', 404);
        const result = await verifySource('openapi', SOURCE, fetchImpl);
        expect(result.ok).toBe(false);
        expect(result.message).toContain('HTTP 404');
    });
});

describe('downloadSources (step 1)', () => {
    it('checks every entry and keeps the downloaded content', async () => {
        const { fetchImpl, calls } = fetchReturning(CONTENT);
        const ctx = context({ openapi: SOURCE, other: { ...SOURCE, ref: 'abc123' } }, fetchImpl);
        const result = await downloadSources(ctx);
        expect(result.status).toBe('PASS');
        expect(calls).toHaveLength(2);
        expect(ctx.downloads.get('openapi').toString()).toBe(CONTENT);
    });

    it('reports every failing entry', async () => {
        const { fetchImpl } = fetchReturning('tampered');
        const result = await downloadSources(
            context({ openapi: SOURCE, tokens: { ...SOURCE, ref: 'abc123' } }, fetchImpl),
        );
        expect(result.status).toBe('FAIL');
        expect(result.lines).toHaveLength(2);
    });

    it('fails when sources.json declares nothing', async () => {
        const { fetchImpl } = fetchReturning(CONTENT);
        expect((await downloadSources(context({}, fetchImpl))).status).toBe('FAIL');
    });
});

const OPENAPI = `openapi: 3.1.0
info: { title: t, version: '1' }
paths: {}
components:
  schemas:
    ErrorCode:
      type: string
      enum:
        - FORBIDDEN
        - NOT_READY
        - USER_NOT_FOUND
`;

function catalogSource(keys) {
    const entries = keys.map((key) => `    ${key}: 'texto',`).join('\n');
    return `type ErrorCode = string;\nexport const ERROR_MESSAGES: Record<ErrorCode, string> = {\n${entries}\n};\n\nexport const CLIENT_ERROR_MESSAGES = {\n    NETWORK_ERROR: 'x',\n};\n`;
}

async function catalogStep(keys) {
    const dir = await mkdtemp(join(tmpdir(), 'catalog-'));
    const catalogPath = join(dir, 'catalog.ts');
    await writeFile(catalogPath, catalogSource(keys));
    const ctx = { ...context({}, fetch), catalogPath };
    ctx.downloads.set('openapi', Buffer.from(OPENAPI));
    return checkCatalog(ctx);
}

describe('extractErrorCodes / extractCatalogKeys', () => {
    it('reads the ErrorCode enum from the contract', () => {
        expect(extractErrorCodes(OPENAPI)).toEqual(['FORBIDDEN', 'NOT_READY', 'USER_NOT_FOUND']);
    });

    it('fails when the contract has no ErrorCode enum', () => {
        expect(() => extractErrorCodes('openapi: 3.1.0\n')).toThrow('ErrorCode');
    });

    it('reads only the ERROR_MESSAGES keys, not the client messages', () => {
        expect(extractCatalogKeys(catalogSource(['A_B', 'C']))).toEqual(['A_B', 'C']);
    });

    it('reads keys whose long text wraps to the next line', () => {
        const source =
            "export const ERROR_MESSAGES: Record<E, string> = {\n    A_B:\n        'texto longo',\n    C: 'x',\n};\n";
        expect(extractCatalogKeys(source)).toEqual(['A_B', 'C']);
    });

    it('fails when the catalog has no ERROR_MESSAGES block', () => {
        expect(() => extractCatalogKeys('export const X = {};')).toThrow('ERROR_MESSAGES');
    });
});

describe('compareCatalog', () => {
    it('lists codes without message and messages without code', () => {
        expect(compareCatalog(['A', 'B'], ['B', 'C'])).toEqual({
            withoutMessage: ['A'],
            withoutCode: ['C'],
        });
    });
});

describe('checkCatalog (step 4, AC-0005-05)', () => {
    it('passes when the keys are exactly the ErrorCode values', async () => {
        const result = await catalogStep(['FORBIDDEN', 'NOT_READY', 'USER_NOT_FOUND']);
        expect(result.status).toBe('PASS');
    });

    it('fails listing the code whose key was removed (ERR-0002-09)', async () => {
        const result = await catalogStep(['FORBIDDEN', 'USER_NOT_FOUND']);
        expect(result.status).toBe('FAIL');
        expect(result.lines.join('\n')).toContain('sem mensagem no catálogo: NOT_READY');
    });

    it('fails listing the invented key (ERR-0002-09)', async () => {
        const result = await catalogStep(['FORBIDDEN', 'NOT_READY', 'USER_NOT_FOUND', 'INVENTED']);
        expect(result.status).toBe('FAIL');
        expect(result.lines.join('\n')).toContain('sem código no contrato: INVENTED');
    });

    it('fails when the contract was not downloaded', async () => {
        expect((await checkCatalog(context({}, fetch))).status).toBe('FAIL');
    });

    it('fails when the catalog file is missing', async () => {
        const ctx = { ...context({}, fetch), catalogPath: '/nonexistent/catalog.ts' };
        ctx.downloads.set('openapi', Buffer.from(OPENAPI));
        expect((await checkCatalog(ctx)).status).toBe('FAIL');
    });

    it('reads the 58 keys of the real catalog', async () => {
        const source = await readFile(
            new URL('../src/api/errors/catalog.ts', import.meta.url),
            'utf8',
        );
        expect(extractCatalogKeys(source)).toHaveLength(58);
    });
});

describe('generateApiTypes (step 2)', () => {
    it('fails when step 1 did not download the contract', async () => {
        expect((await generateApiTypes(context({}, fetch))).status).toBe('FAIL');
    });

    it('writes the generated types to the schema path', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'schema-'));
        const schemaPath = join(dir, 'schema.d.ts');
        const ctx = { ...context({}, fetch), schemaPath };
        ctx.downloads.set('openapi', Buffer.from(OPENAPI));
        expect((await generateApiTypes(ctx)).status).toBe('PASS');
        expect(await readFile(schemaPath, 'utf8')).toContain('ErrorCode');
    });

    it('fails with the reason when the contract is not valid OpenAPI', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'schema-'));
        const ctx = { ...context({}, fetch), schemaPath: join(dir, 'schema.d.ts') };
        ctx.downloads.set('openapi', Buffer.from('not: openapi\n'));
        expect((await generateApiTypes(ctx)).status).toBe('FAIL');
    });
});

describe('checkTheme (step 3, AC-0004-02)', () => {
    const TOKENS = {
        color: {
            tokens: [
                { name: 'marca-noite', value: '#0b0f0c' },
                { name: 'fundo', value: { escuro: '{marca-noite}', claro: '#eef3e9' } },
                ...[
                    'superficie',
                    'superficie-elevada',
                    'linha',
                    'linha-forte',
                    'texto',
                    'texto-apoio',
                    'acento',
                    'sobre-acento',
                    'foco',
                    'negativo',
                ].map((name) => ({ name, value: { escuro: '#111111', claro: '#222222' } })),
            ],
        },
        type: { families: { sans: 'a', mono: 'b' }, groups: [] },
        radius: {
            tokens: ['sm', 'md', 'lg', 'pill'].map((name) => ({
                name: `raio-${name}`,
                value: '4px',
            })),
        },
        shadow: { tokens: [] },
        breakpoint: {
            tokens: ['tablet', 'desktop'].map((name) => ({ name: `bp-${name}`, value: '1px' })),
        },
    };
    const body = JSON.stringify(TOKENS);
    const tokensSource = {
        ...SOURCE,
        repository: 'owner/hub',
        path: 'tokens.json',
        sha256: sha256(body),
    };

    async function themeContext(css) {
        const dir = await mkdtemp(join(tmpdir(), 'theme-'));
        const themePath = join(dir, 'tokens.css');
        if (css !== undefined) await writeFile(themePath, css);
        const ctx = { ...context({ tokens: tokensSource }, fetch), themePath };
        ctx.downloads.set('tokens', Buffer.from(body));
        return ctx;
    }

    it('passes when tokens.css equals the regenerated theme', async () => {
        const ctx = await themeContext(generateTheme(TOKENS, tokensSource));
        expect((await checkTheme(ctx)).status).toBe('PASS');
    });

    it('fails with a hand-edited colour, telling to run npm run theme (ERR-0002-08)', async () => {
        const edited = generateTheme(TOKENS, tokensSource).replace(
            '--ft-fundo: #0b0f0c;',
            '--ft-fundo: #0b0f0d;',
        );
        const result = await checkTheme(await themeContext(edited));
        expect(result.status).toBe('FAIL');
        expect(result.lines.join('\n')).toContain('npm run theme');
        expect(result.lines.join('\n')).toContain('--ft-fundo: #0b0f0d;');
    });

    it('fails when tokens.css is missing', async () => {
        const result = await checkTheme(await themeContext(undefined));
        expect(result.status).toBe('FAIL');
        expect(result.lines.join('\n')).toContain('npm run theme');
    });

    it('fails when the pinned tokens cannot generate a theme (ERR-0004-01)', async () => {
        const ctx = await themeContext('');
        ctx.downloads.set('tokens', Buffer.from(JSON.stringify({ color: { tokens: [] } })));
        expect((await checkTheme(ctx)).status).toBe('FAIL');
    });

    it('fails when the tokens source was not downloaded', async () => {
        const ctx = await themeContext('');
        ctx.downloads.clear();
        expect((await checkTheme(ctx)).status).toBe('FAIL');
    });

    it('skips (contexto) without a tokens entry in sources.json', async () => {
        expect((await checkTheme(context({}, fetch))).status).toBe('SKIP');
    });
});

describe('generateRouteTree (step 5)', () => {
    it('passes after generating the route tree', async () => {
        let calls = 0;
        const result = await generateRouteTree({ generateRoutes: async () => calls++ });
        expect(result.status).toBe('PASS');
        expect(calls).toBe(1);
    });

    it('fails with the generator message', async () => {
        const result = await generateRouteTree({
            generateRoutes: async () => {
                throw new Error('rota duplicada');
            },
        });
        expect(result).toEqual({
            status: 'FAIL',
            lines: ['falha ao gerar a árvore de rotas: rota duplicada'],
        });
    });

    it('writes the tree of a routes directory, using tsr.config.json', async () => {
        const root = await mkdtemp(join(tmpdir(), 'routes-'));
        await writeFile(
            join(root, 'tsr.config.json'),
            JSON.stringify({
                target: 'react',
                routesDirectory: './src/routes',
                generatedRouteTree: './src/routeTree.gen.ts',
                // Na mesma pasta temporária: o gerador renomeia do tmpDir para o destino.
                tmpDir: join(root, '.tanstack-tmp'),
            }),
        );
        await mkdir(join(root, 'src/routes'), { recursive: true });
        await writeFile(
            join(root, 'src/routes/__root.tsx'),
            "import { createRootRoute } from '@tanstack/react-router';\nexport const Route = createRootRoute();\n",
        );
        await writeFile(
            join(root, 'src/routes/sobre.tsx'),
            "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/sobre')();\n",
        );

        const path = await generateRoutes(root);

        expect(path).toBe(join(root, 'src/routeTree.gen.ts'));
        expect(await readFile(path, 'utf8')).toContain("path: '/sobre'");
    });
});

describe('runContract', () => {
    it('skips step 3 (contexto) only when sources.json has no tokens entry', async () => {
        const log = [];
        const code = await runContract(
            context({}, fetch),
            STEPS.filter((step) => step.title.startsWith('3.')),
            (line) => log.push(line),
        );
        expect(code).toBe(0);
        expect(log[0]).toMatch(/^SKIP \(contexto\)/);
    });

    it('declares the five steps in order', () => {
        expect(STEPS.map((step) => step.title.charAt(0))).toEqual(['1', '2', '3', '4', '5']);
    });

    it('runs every step after a failure and exits with 1', async () => {
        const ran = [];
        const steps = [
            { title: 'a', run: async () => (ran.push('a'), { status: 'FAIL', lines: ['x'] }) },
            { title: 'b', run: async () => (ran.push('b'), { status: 'PASS', lines: [] }) },
            { title: 'c', run: pendingStep('pending', 'T-0000-00') },
        ];
        const code = await runContract(context({}, fetch), steps, () => {});
        expect(code).toBe(1);
        expect(ran).toEqual(['a', 'b']);
    });
});
