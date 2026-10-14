import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sha256 } from './contract.mjs';
import { generateTheme, writeTheme } from './theme.mjs';

const SOURCE = {
    repository: 'owner/hub',
    ref: 'abc123',
    path: 'docs/design/tokens.json',
    sha256: 'f'.repeat(64),
};

/** Fixture mínima, no formato do tokens.json do hub, com os tokens que o mapeamento do shadcn/ui exige. */
function fixture() {
    const both = (escuro, claro) => ({ escuro, claro });
    return {
        color: {
            tokens: [
                { name: 'marca-noite', value: '#0b0f0c' },
                { name: 'marca-cal', value: '#eef3e9' },
                { name: 'fundo', value: both('{marca-noite}', '{marca-cal}') },
                { name: 'superficie', value: both('#111111', '#ffffff') },
                { name: 'superficie-elevada', value: both('#1c261f', '#f6f9f3') },
                { name: 'linha', value: both('#232c25', '#cbd5c7') },
                { name: 'linha-forte', value: both('#5e755f', '#7a8a7d') },
                { name: 'texto', value: both('{marca-cal}', '{marca-noite}') },
                { name: 'texto-apoio', value: both('#9aa69d', '#5a665c') },
                { name: 'acento', value: both('#a6e86b', '#2f7a1a') },
                { name: 'sobre-acento', value: both('{marca-noite}', '#ffffff') },
                { name: 'foco', value: both('#a6e86b', '#2f7a1a') },
                { name: 'negativo', value: both('#ec6355', '#ad2724') },
                { name: 'fixo', value: '#123456' },
                { name: 'cadeia', value: both('{fixo}', '{fundo}') },
            ],
        },
        type: {
            families: { sans: '"Outfit", sans-serif', mono: '"JetBrains Mono", monospace' },
            groups: [
                {
                    styles: [
                        {
                            name: 'display',
                            fontSize: '32px',
                            lineHeight: '40px',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                        },
                        { name: 'corpo', fontSize: '15px', lineHeight: '22px', fontWeight: 400 },
                    ],
                },
                {
                    styles: [
                        { name: 'valor', fontSize: '16px', lineHeight: '24px', fontWeight: 600 },
                    ],
                },
            ],
        },
        radius: {
            tokens: [
                { name: 'raio-sm', value: '4px' },
                { name: 'raio-md', value: '8px' },
                { name: 'raio-lg', value: '12px' },
                { name: 'raio-pill', value: '999px' },
            ],
        },
        shadow: {
            tokens: [
                {
                    name: 'sombra-flutuante',
                    value: both(
                        '0 8px 24px rgba(0, 0, 0, 0.45)',
                        '0 8px 24px rgba(11, 15, 12, 0.14)',
                    ),
                },
            ],
        },
        breakpoint: {
            tokens: [
                { name: 'bp-tablet', value: '768px' },
                { name: 'bp-desktop', value: '1024px' },
            ],
        },
    };
}

/** Corpo de um bloco `<abertura> { … }` do CSS gerado. */
function block(css, opening) {
    const start = css.indexOf(`${opening} {`);
    expect(start, `bloco ${opening}`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf('\n}', start));
}

describe('generateTheme (AC-0004-01, INV-0004-01)', () => {
    const css = generateTheme(fixture(), SOURCE);

    it('starts with the generated-file header naming the pinned source', () => {
        expect(css.split('\n')[0]).toBe(
            `/* Gerado por scripts/theme.mjs — não edite. Fonte: owner/hub@abc123 (docs/design/tokens.json), sha256 ${'f'.repeat(64)}. */`,
        );
    });

    it('emits the dark theme as the :root default and the light theme in both light selectors', () => {
        const dark = block(css, ":root,\n:root[data-tema='escuro']");
        expect(dark).toContain('--ft-fundo: #0b0f0c;');
        expect(dark).toContain('--ft-texto: #eef3e9;');
        expect(dark).toContain('--ft-sobre-acento: #0b0f0c;');
        const light = block(css, ":root[data-tema='claro']");
        expect(light).toContain('--ft-fundo: #eef3e9;');
        expect(light).toContain('--ft-sobre-acento: #ffffff;');
        const media = block(
            css,
            '@media (prefers-color-scheme: light) {\n    :root:not([data-tema])',
        );
        expect(media).toContain('        --ft-fundo: #eef3e9;');
        expect(css.indexOf(':root[data-tema=')).toBeLessThan(
            css.indexOf('@media (prefers-color-scheme: light)'),
        );
    });

    it('resolves aliases (also chained) to hexadecimal and keeps fixed values in both themes', () => {
        const dark = block(css, ":root,\n:root[data-tema='escuro']");
        const light = block(css, ":root[data-tema='claro']");
        expect(dark).toContain('--ft-cadeia: #123456;');
        expect(light).toContain('--ft-cadeia: #eef3e9;');
        expect(dark).toContain('--ft-fixo: #123456;');
        expect(light).toContain('--ft-fixo: #123456;');
        expect(css).not.toMatch(/--ft-[a-z0-9-]+: \{/);
    });

    it('emits the floating shadow per theme', () => {
        expect(block(css, ":root,\n:root[data-tema='escuro']")).toContain(
            '--ft-sombra-flutuante: 0 8px 24px rgba(0, 0, 0, 0.45);',
        );
        expect(block(css, ":root[data-tema='claro']")).toContain(
            '--ft-sombra-flutuante: 0 8px 24px rgba(11, 15, 12, 0.14);',
        );
    });

    it('never emits a marca-* variable', () => {
        expect(css).not.toContain('marca');
    });

    it('maps the shadcn/ui variables to the semantic tokens', () => {
        const root = block(css, ':root');
        expect(root).toContain('--background: var(--ft-fundo);');
        expect(root).toContain('--card: var(--ft-superficie);');
        expect(root).toContain('--popover-foreground: var(--ft-texto);');
        expect(root).toContain('--primary: var(--ft-acento);');
        expect(root).toContain('--primary-foreground: var(--ft-sobre-acento);');
        expect(root).toContain('--accent: var(--ft-superficie-elevada);');
        expect(root).toContain('--muted-foreground: var(--ft-texto-apoio);');
        expect(root).toContain('--destructive: var(--ft-negativo);');
        expect(root).toContain('--border: var(--ft-linha);');
        expect(root).toContain('--input: var(--ft-linha-forte);');
        expect(root).toContain('--ring: var(--ft-foco);');
        expect(root).toContain('--radius: 8px;');
    });

    it('declares the Tailwind @theme inline block', () => {
        const theme = block(css, '@theme inline');
        expect(theme).toContain('--color-texto-apoio: var(--ft-texto-apoio);');
        expect(theme).not.toContain('--color-marca');
        expect(theme).toContain('--color-primary: var(--primary);');
        expect(theme).toContain('--color-input: var(--input);');
        expect(theme).toContain('--font-sans: "Outfit", sans-serif;');
        expect(theme).toContain('--font-mono: "JetBrains Mono", monospace;');
        expect(theme).toContain('--spacing: 4px;');
        expect(theme).toContain('--radius-sm: 4px;');
        expect(theme).toContain('--radius-md: 8px;');
        expect(theme).toContain('--radius-lg: 12px;');
        expect(theme).toContain('--radius-full: 999px;');
        expect(theme).toContain('--breakpoint-md: 768px;');
        expect(theme).toContain('--breakpoint-lg: 1024px;');
        expect(theme).toContain('--text-display: 32px;');
        expect(theme).toContain('--text-display--line-height: 40px;');
        expect(theme).toContain('--text-display--font-weight: 600;');
        expect(theme).toContain('--text-display--letter-spacing: -0.01em;');
        expect(theme).toContain('--text-corpo--font-weight: 400;');
        expect(theme).not.toContain('--text-corpo--letter-spacing');
        expect(theme).toContain('--text-valor--line-height: 24px;');
    });

    it('is deterministic and ends with a single newline', () => {
        expect(generateTheme(fixture(), SOURCE)).toBe(css);
        expect(css.endsWith('}\n')).toBe(true);
    });
});

describe('generateTheme errors (ERR-0004-01)', () => {
    const color = (tokens, name) => tokens.color.tokens.find((token) => token.name === name);

    it('fails citing the alias that does not resolve', () => {
        const tokens = fixture();
        color(tokens, 'fundo').value.claro = '{inexistente}';
        expect(() => generateTheme(tokens, SOURCE)).toThrow(
            /alias não resolve: fundo → \{inexistente\}/,
        );
    });

    it('fails on a circular alias', () => {
        const tokens = fixture();
        color(tokens, 'fixo').value = '{cadeia}';
        expect(() => generateTheme(tokens, SOURCE)).toThrow(/circular/);
    });

    it('fails citing a colour that lacks a value for one of the themes', () => {
        const tokens = fixture();
        delete color(tokens, 'texto').value.claro;
        expect(() => generateTheme(tokens, SOURCE)).toThrow(
            /texto não tem valor para o tema claro/,
        );
    });

    it('fails on an invalid token name', () => {
        const tokens = fixture();
        color(tokens, 'fixo').name = 'Fixo_Ruim';
        expect(() => generateTheme(tokens, SOURCE)).toThrow(/nome de token inválido/);
    });

    it('fails when a token required by the shadcn/ui mapping is missing', () => {
        const tokens = fixture();
        tokens.color.tokens = tokens.color.tokens.filter((token) => token.name !== 'foco');
        expect(() => generateTheme(tokens, SOURCE)).toThrow(/foco/);
    });

    it('fails when the shadow lacks a theme', () => {
        const tokens = fixture();
        delete tokens.shadow.tokens[0].value.claro;
        expect(() => generateTheme(tokens, SOURCE)).toThrow(/sombra-flutuante/);
    });
});

describe('writeTheme', () => {
    async function run(tokens, overrides = {}) {
        const body = JSON.stringify(tokens);
        const source = { ...SOURCE, sha256: sha256(body) };
        const dir = await mkdtemp(join(tmpdir(), 'theme-'));
        const outFile = join(dir, 'tokens.css');
        const fetchImpl = async () => new Response(body);
        const result = await writeTheme({
            sources: { tokens: source, ...overrides },
            fetch: fetchImpl,
            outFile,
        });
        return { result, outFile, source };
    }

    it('writes the generated CSS, identical on a second run', async () => {
        const first = await run(fixture());
        expect(first.result.ok).toBe(true);
        const css = await readFile(first.outFile, 'utf8');
        expect(css).toBe(generateTheme(fixture(), first.source));
        const second = await run(fixture());
        expect(await readFile(second.outFile, 'utf8')).toBe(css);
    });

    it('writes nothing when the tokens are invalid', async () => {
        const tokens = fixture();
        tokens.color.tokens.find((token) => token.name === 'fundo').value.claro = '{x}';
        const { result, outFile } = await run(tokens);
        expect(result.ok).toBe(false);
        expect(result.message).toContain('alias não resolve');
        await expect(readFile(outFile, 'utf8')).rejects.toThrow();
    });

    it('fails when sources.json has no tokens entry', async () => {
        const result = await writeTheme({ sources: {}, fetch });
        expect(result.ok).toBe(false);
    });
});
