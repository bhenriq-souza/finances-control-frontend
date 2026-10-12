import { describe, expect, it } from 'vitest';

import {
    downloadSources,
    pendingStep,
    runContract,
    sha256,
    sourceUrl,
    STEPS,
    verifySource,
} from './contract.mjs';

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

describe('runContract', () => {
    it('passes with steps 2, 3 and 4 skipped, naming the task that implements each', async () => {
        const { fetchImpl } = fetchReturning(CONTENT);
        const log = [];
        const code = await runContract(context({ openapi: SOURCE }, fetchImpl), STEPS, (line) =>
            log.push(line),
        );
        expect(code).toBe(0);
        const skipped = log.filter((line) => line.startsWith('SKIP (contexto)'));
        expect(skipped).toHaveLength(3);
        expect(log.join('\n')).toMatch(/T-0005-01[\s\S]*T-0004-01[\s\S]*T-0005-01/);
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
