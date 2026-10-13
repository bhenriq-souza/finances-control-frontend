import { isIsoDate } from './iso';

/**
 * Texto do `DateField` (spec 0009, ADR 0001 local): a máscara `dd/mm/aaaa` e a conversão para o
 * valor do formulário, `YYYY-MM-DD`. Funções puras; o componente só as liga ao campo.
 */

const PASTED_ISO = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/;
const MASKED = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Aplica a máscara ao que foi digitado ou colado: só dígitos (no máximo 8), com as barras postas
 * entre dia, mês e ano. Colar `aaaa-mm-dd` vira `dd/mm/aaaa`.
 */
export function maskDateInput(raw: string): string {
    const pasted = PASTED_ISO.exec(raw);
    if (pasted) return `${pasted[3]}/${pasted[2]}/${pasted[1]}`;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

/**
 * O valor do formulário para o texto do campo: `YYYY-MM-DD` quando a data está completa e existe,
 * `''` quando vazio, e o próprio texto nos demais casos — para a validação recusar.
 */
export function dateInputToValue(text: string): string {
    const masked = MASKED.exec(text);
    if (masked) {
        const iso = `${masked[3]}-${masked[2]}-${masked[1]}`;
        if (isIsoDate(iso)) return iso;
    }
    return text;
}

/** O texto exibido para um valor do formulário: `YYYY-MM-DD` vira `dd/mm/aaaa`; o resto fica. */
export function valueToDateInput(value: string | null | undefined): string {
    if (!value) return '';
    if (!isIsoDate(value)) return value;
    const [year, month, day] = value.split('-') as [string, string, string];
    return `${day}/${month}/${year}`;
}
