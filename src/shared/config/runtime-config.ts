import { z } from 'zod';

declare global {
    interface Window {
        /** Definido por `/config.js` (spec 0003). Só este módulo lê. */
        __FTECH_CONFIG__?: unknown;
    }
}

const runtimeConfigSchema = z.object({
    environment: z.enum(['local', 'dev', 'prd']),
    firebase: z.object({
        apiKey: z.string().min(1),
        authDomain: z.string().min(1),
        projectId: z.string().min(1),
        appId: z.string().min(1),
    }),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

/** `missing`: ERR-0003-01; `invalid`: ERR-0003-02, com os campos inválidos em `issues`. */
export class RuntimeConfigError extends Error {
    readonly kind: 'missing' | 'invalid';
    readonly issues: readonly string[];

    constructor(kind: 'missing' | 'invalid', issues: readonly string[] = []) {
        super(
            kind === 'missing'
                ? 'window.__FTECH_CONFIG__ ausente'
                : `window.__FTECH_CONFIG__ inválido: ${issues.join('; ')}`,
        );
        this.name = 'RuntimeConfigError';
        this.kind = kind;
        this.issues = issues;
    }
}

/** Valida um objeto de configuração de runtime; lança `RuntimeConfigError`. */
export function parseRuntimeConfig(raw: unknown): RuntimeConfig {
    if (raw === undefined || raw === null) {
        throw new RuntimeConfigError('missing');
    }
    const result = runtimeConfigSchema.safeParse(raw);
    if (!result.success) {
        const issues = result.error.issues.map(
            (issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`,
        );
        throw new RuntimeConfigError('invalid', issues);
    }
    return result.data;
}

let cached: RuntimeConfig | undefined;

/**
 * A configuração de runtime validada, lida de `window.__FTECH_CONFIG__` na primeira chamada.
 * Lança `RuntimeConfigError` se ela estiver ausente ou inválida.
 */
export function getRuntimeConfig(): RuntimeConfig {
    cached ??= parseRuntimeConfig(window.__FTECH_CONFIG__);
    return cached;
}

/** Só para testes: esquece a configuração lida. */
export function resetRuntimeConfigForTests(): void {
    cached = undefined;
}
