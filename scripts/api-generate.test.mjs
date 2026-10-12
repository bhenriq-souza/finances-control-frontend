import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { apiGenerate, generateTypes } from './api-generate.mjs';
import { sha256 } from './contract.mjs';

// Contrato mínimo com a forma de GET /users/me do backend: 200 { data: UserResponse }.
const CONTRACT = `openapi: 3.1.0
info: { title: fixture, version: '1' }
paths:
  /users/me:
    get:
      operationId: getMe
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema:
                type: object
                required: [data]
                properties:
                  data:
                    $ref: '#/components/schemas/UserResponse'
components:
  schemas:
    UserResponse:
      type: object
      required: [id, email]
      properties:
        id: { type: string }
        email: { type: string }
`;

describe('generateTypes', () => {
    it('types GET /users/me 200 as data: UserResponse (AC-0005-01)', async () => {
        const types = await generateTypes(CONTRACT);
        expect(types).toContain('"/users/me"');
        expect(types).toMatch(/UserResponse: \{[^}]*id: string;[^}]*email: string;/);
        expect(types).toMatch(
            /"application\/json": \{\s*data: components\["schemas"\]\["UserResponse"\];/,
        );
    });
});

describe('apiGenerate', () => {
    const source = {
        repository: 'o/r',
        ref: 'v1',
        path: 'docs/openapi.yaml',
        sha256: sha256(CONTRACT),
    };

    it('downloads, checks the sha256 and writes the types', async () => {
        const outFile = join(await mkdtemp(join(tmpdir(), 'gen-')), 'out', 'schema.d.ts');
        const fetchImpl = async () => new Response(CONTRACT);
        const result = await apiGenerate({
            sources: { openapi: source },
            fetch: fetchImpl,
            outFile,
        });
        expect(result.ok).toBe(true);
        expect(await readFile(outFile, 'utf8')).toContain('UserResponse');
    });

    it('does not write anything when the sha256 diverges', async () => {
        const outFile = join(await mkdtemp(join(tmpdir(), 'gen-')), 'schema.d.ts');
        const fetchImpl = async () => new Response('tampered');
        const result = await apiGenerate({
            sources: { openapi: source },
            fetch: fetchImpl,
            outFile,
        });
        expect(result.ok).toBe(false);
        await expect(readFile(outFile, 'utf8')).rejects.toThrow();
    });

    it('fails when sources.json has no openapi entry', async () => {
        const result = await apiGenerate({ sources: {}, fetch });
        expect(result.ok).toBe(false);
    });
});
