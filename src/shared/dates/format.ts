import { addDays, today } from './calendar';
import { parseIsoDate, parseIsoMonth, type IsoDate, type IsoMonth } from './iso';

// Tabelas próprias em vez de `Intl` com `month: 'short'`: em pt-BR o `Intl` escreve `15 de out.`,
// e a spec pede `15 out.` na forma curta; com as tabelas a saída não varia entre navegadores.
const SHORT_MONTHS = [
    'jan.',
    'fev.',
    'mar.',
    'abr.',
    'mai.',
    'jun.',
    'jul.',
    'ago.',
    'set.',
    'out.',
    'nov.',
    'dez.',
] as const;

const LONG_MONTHS = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
] as const;

export type DateStyle = 'curta' | 'longa' | 'relativa';

/**
 * `'curta'` → `15 out.`; `'longa'` → `15 de out. de 2026`; `'relativa'` → `Hoje`, `Ontem`,
 * `Amanhã` ou a curta. A referência da relativa é `today()`.
 */
export function formatDate(date: IsoDate, style: DateStyle): string {
    const { year, month, day } = parseIsoDate(date);
    const short = `${day} ${SHORT_MONTHS[month - 1]}`;
    if (style === 'longa') return `${day} de ${SHORT_MONTHS[month - 1]} de ${year}`;
    if (style === 'relativa') {
        const reference = today();
        if (date === reference) return 'Hoje';
        if (date === addDays(reference, -1)) return 'Ontem';
        if (date === addDays(reference, 1)) return 'Amanhã';
    }
    return short;
}

/** `'2026-10'` → `outubro de 2026`. */
export function formatMonth(month: IsoMonth): string {
    const parsed = parseIsoMonth(month);
    return `${LONG_MONTHS[parsed.month - 1]} de ${parsed.year}`;
}
