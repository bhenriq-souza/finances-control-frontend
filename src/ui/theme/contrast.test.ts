import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// AC-0004-03, INV-0004-03, ERR-0004-03: os pares vêm do check-contrast.mjs do hub.

type Theme = 'escuro' | 'claro';
type Vars = Record<string, string>;

const TEXT = 4.5;
const MARK = 3;

/** [cor, fundo, mínimo] — cópia literal da lista do hub (docs/design/check-contrast.mjs). */
const pairs: [string, string, number][] = [
    ['texto', 'fundo', TEXT],
    ['texto', 'superficie', TEXT],
    ['texto', 'superficie-elevada', TEXT],
    ['texto', 'positivo-fundo', TEXT],
    ['texto', 'negativo-fundo', TEXT],
    ['texto', 'atencao-fundo', TEXT],
    ['texto', 'info-fundo', TEXT],
    ['texto-apoio', 'fundo', TEXT],
    ['texto-apoio', 'superficie', TEXT],
    ['texto-apoio', 'superficie-elevada', TEXT],
    ['acento', 'fundo', TEXT],
    ['acento', 'superficie', TEXT],
    ['sobre-acento', 'acento', TEXT],
    ['sobre-acento', 'acento-hover', TEXT],
    ['positivo', 'fundo', TEXT],
    ['positivo', 'superficie', TEXT],
    ['positivo', 'positivo-fundo', TEXT],
    ['negativo', 'fundo', TEXT],
    ['negativo', 'superficie', TEXT],
    ['negativo', 'negativo-fundo', TEXT],
    ['atencao', 'fundo', TEXT],
    ['atencao', 'superficie', TEXT],
    ['atencao', 'atencao-fundo', TEXT],
    ['info', 'fundo', TEXT],
    ['info', 'superficie', TEXT],
    ['info', 'info-fundo', TEXT],
    ['linha-forte', 'fundo', MARK],
    ['linha-forte', 'superficie', MARK],
    ['foco', 'fundo', MARK],
    ['foco', 'superficie', MARK],
];

const themes: Theme[] = ['escuro', 'claro'];

/** Lê as declarações `--ft-*` do bloco do tema (o escuro é o `:root` padrão, junto com `[data-tema]`). */
function parseThemes(css: string): Record<Theme, Vars> {
    const result = {} as Record<Theme, Vars>;
    for (const theme of themes) {
        const block = new RegExp(`:root\\[data-tema='${theme}'\\]\\s*\\{([^}]*)\\}`).exec(css);
        if (!block?.[1]) throw new Error(`bloco do tema ${theme} não encontrado em tokens.css`);
        const vars: Vars = {};
        for (const match of block[1].matchAll(/--ft-([a-z-]+):\s*([^;]+);/g)) {
            vars[match[1]!] = match[2]!.trim();
        }
        result[theme] = vars;
    }
    return result;
}

/** Valor de uma variável do tema; ausente é erro de teste, não NaN silencioso. */
function color(vars: Vars, name: string): string {
    const value = vars[name];
    if (value === undefined) throw new Error(`variável --ft-${name} ausente no tema`);
    return value;
}

function luminance(hex: string): number {
    const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255)) as [
        number,
        number,
        number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [la, lb] = [luminance(a), luminance(b)];
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const twoDecimals = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Pares abaixo do mínimo, citando tema, par, razão obtida e mínimo (ERR-0004-03). */
function failures(all: Record<Theme, Vars>): string[] {
    const out: string[] = [];
    for (const theme of themes) {
        for (const [fg, bg, min] of pairs) {
            const ratio = contrast(color(all[theme], fg), color(all[theme], bg));
            if (ratio < min) {
                out.push(
                    `${theme}: ${fg} sobre ${bg} = ${twoDecimals.format(ratio)}:1 (mín. ${min}:1)`,
                );
            }
        }
    }
    return out;
}

// O Vitest roda na raiz do projeto; no ambiente jsdom `import.meta.url` não é um caminho de arquivo.
const tokensCss = readFileSync(resolve(process.cwd(), 'src/ui/theme/tokens.css'), 'utf8');
const parsed = parseThemes(tokensCss);

describe('theme contrast', () => {
    it('has the 30 pairs of the hub in both themes (60 checks)', () => {
        expect(pairs).toHaveLength(30);
        expect(pairs.length * themes.length).toBe(60);
    });

    for (const theme of themes) {
        for (const [fg, bg, min] of pairs) {
            it(`${theme}: ${fg} on ${bg} is at least ${min}:1`, () => {
                const ratio = contrast(color(parsed[theme], fg), color(parsed[theme], bg));
                expect(ratio, `${theme}: ${fg} sobre ${bg}`).toBeGreaterThanOrEqual(min);
            });
        }
    }

    it('reports no failures for the generated tokens.css', () => {
        expect(failures(parsed)).toEqual([]);
    });

    it('fails when texto-apoio of the light theme becomes the mist #9aa69d (AC-0004-03)', () => {
        const swapped = {
            escuro: parsed.escuro,
            claro: { ...parsed.claro, 'texto-apoio': '#9aa69d' },
        };
        const found = failures(swapped);
        expect(found.length).toBeGreaterThan(0);
        expect(found.every((line) => line.startsWith('claro: texto-apoio'))).toBe(true);
        expect(found[0]).toMatch(/2\.\d\d:1 \(mín\. 4\.5:1\)/);
    });
});
