import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    getRuntimeConfig,
    parseRuntimeConfig,
    resetRuntimeConfigForTests,
    RuntimeConfigError,
} from './index';

const VALID = {
    environment: 'dev',
    firebase: {
        apiKey: 'api-key',
        authDomain: 'dev-financial-control.firebaseapp.com',
        projectId: 'dev-financial-control',
        appId: '1:805955182517:web:652d21a187283fa505c3fc',
    },
};

function captureError(fn: () => unknown): RuntimeConfigError {
    try {
        fn();
    } catch (error) {
        if (error instanceof RuntimeConfigError) return error;
        throw error;
    }
    throw new Error('esperava RuntimeConfigError');
}

afterEach(() => {
    delete window.__FTECH_CONFIG__;
    resetRuntimeConfigForTests();
});

describe('parseRuntimeConfig', () => {
    it('accepts the documented shape', () => {
        expect(parseRuntimeConfig(VALID)).toEqual(VALID);
    });

    it.each(['local', 'dev', 'prd'])('accepts environment %s', (environment) => {
        expect(parseRuntimeConfig({ ...VALID, environment }).environment).toBe(environment);
    });

    it.each([undefined, null])('reports %s as missing (ERR-0003-01)', (raw) => {
        const error = captureError(() => parseRuntimeConfig(raw));
        expect(error.kind).toBe('missing');
        expect(error.issues).toEqual([]);
    });

    it('reports a config without firebase.apiKey as invalid, listing the field (ERR-0003-02)', () => {
        const { apiKey: _omitted, ...firebase } = VALID.firebase;
        const error = captureError(() => parseRuntimeConfig({ ...VALID, firebase }));
        expect(error.kind).toBe('invalid');
        expect(error.issues).toHaveLength(1);
        expect(error.issues[0]).toMatch(/^firebase\.apiKey: /);
    });

    it('rejects an unknown environment and an empty field, listing both', () => {
        const error = captureError(() =>
            parseRuntimeConfig({
                ...VALID,
                environment: 'staging',
                firebase: { ...VALID.firebase, appId: '' },
            }),
        );
        expect(error.issues.map((issue) => issue.split(':')[0])).toEqual([
            'environment',
            'firebase.appId',
        ]);
    });

    it('labels a non-object config as an invalid root', () => {
        const error = captureError(() => parseRuntimeConfig('dev'));
        expect(error.kind).toBe('invalid');
        expect(error.issues[0]).toMatch(/^\(raiz\): /);
        expect(error.message).toContain('inválido');
    });
});

describe('getRuntimeConfig', () => {
    it('reads window.__FTECH_CONFIG__ at runtime (INV-0003-03)', () => {
        window.__FTECH_CONFIG__ = { ...VALID, environment: 'prd' };
        expect(getRuntimeConfig().environment).toBe('prd');
    });

    it('throws a missing error when /config.js did not define the object', () => {
        expect(() => getRuntimeConfig()).toThrow(RuntimeConfigError);
    });
});

describe('INV-0003-03 — no environment value in the bundle', () => {
    const SRC = resolve(import.meta.dirname, '../..');

    function sourceFiles(dir: string): string[] {
        return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) return sourceFiles(path);
            return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
                ? [path]
                : [];
        });
    }

    const files = sourceFiles(SRC).map((path) => ({
        path: relative(SRC, path).replaceAll('\\', '/'),
        content: readFileSync(path, 'utf8'),
    }));

    it('only src/shared/config reads window.__FTECH_CONFIG__', () => {
        const readers = files
            .filter(({ content }) => content.includes('__FTECH_CONFIG__'))
            .map(({ path }) => path);
        expect(readers).toEqual(['shared/config/runtime-config.ts']);
    });

    it('no source reads VITE_* variables from import.meta.env', () => {
        const offenders = files
            .filter(({ content }) => /import\.meta\.env\.VITE_/.test(content))
            .map(({ path }) => path);
        expect(offenders).toEqual([]);
    });
});
