import { isCents, type Cents } from './cents';

export interface FormatOptions {
    sign?: 'auto' | 'always' | 'never';
}

const MINUS = '−';
const NBSP = String.fromCharCode(0x00a0);
const NARROW_NBSP = String.fromCharCode(0x202f);
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Formata centavos como `R$ 1.234,56` (spec 0008). O `Intl` recebe a string decimal
 * exata, montada sobre os dígitos; nunca `cents / 100`.
 */
export function formatBRL(cents: Cents, options: FormatOptions = {}): string {
    if (!isCents(cents)) {
        throw new RangeError(`formatBRL: valor fora do domínio de centavos: ${String(cents)}`);
    }

    const sign = options.sign ?? 'auto';
    const digits = String(Math.abs(cents)).padStart(3, '0');
    const decimal = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
    // O Intl usa NBSP (U+00A0) ou NBSP estreito (U+202F); normaliza para espaço comum.
    const body = currency
        .format(decimal as `${number}`)
        .replaceAll(NBSP, ' ')
        .replaceAll(NARROW_NBSP, ' ');

    if (cents === 0 || sign === 'never') return body;
    if (cents < 0) return `${MINUS}${body}`;
    return sign === 'always' ? `+${body}` : body;
}
