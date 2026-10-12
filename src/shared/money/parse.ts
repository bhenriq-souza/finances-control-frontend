import type { Cents } from './cents';

export type ParseResult =
    { ok: true; cents: Cents } | { ok: false; reason: 'vazio' | 'formato' | 'limite' };

// Parte inteira: grupos de milhar de exatamente três dígitos, ou só dígitos; parte
// decimal opcional com `,` e um ou dois dígitos.
const FORMAT = /^(?:([0-9]{1,3}(?:\.[0-9]{3})+)|([0-9]+))?(?:,([0-9]{1,2}))?$/;

/** Maior parte inteira (em reais) que cabe no limite: 999.999.999.999 (12 dígitos). */
const MAX_INTEGER_DIGITS = 12;

/**
 * Converte texto no formato brasileiro em centavos (spec 0008). Trabalha só sobre a
 * string, com dígitos e aritmética inteira.
 */
export function parseBRL(text: string): ParseResult {
    let rest = text.trim();
    if (rest === '') return { ok: false, reason: 'vazio' };

    if (rest.startsWith('R$')) rest = rest.slice(2).trim();

    const match = FORMAT.exec(rest);
    if (match === null) return { ok: false, reason: 'formato' };

    const grouped = match[1];
    const plain = match[2];
    const fraction = match[3];
    if (grouped === undefined && plain === undefined && fraction === undefined) {
        return { ok: false, reason: 'formato' };
    }

    const integerDigits = (grouped ?? plain ?? '').replaceAll('.', '').replace(/^0+/, '');
    if (integerDigits.length > MAX_INTEGER_DIGITS) return { ok: false, reason: 'limite' };

    // Um dígito decimal vale dezenas de centavos: "5" -> "50".
    const centsDigits = (fraction ?? '').padEnd(2, '0');
    const cents = Number(`${integerDigits}${centsDigits}`);
    return { ok: true, cents };
}
