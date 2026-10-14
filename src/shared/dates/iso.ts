/**
 * Datas de negócio da API (spec 0009): `YYYY-MM-DD` e `YYYY-MM`, sem hora, no fuso
 * `America/Sao_Paulo`. Circulam como strings (INV-0009-05); o `Date` só aparece por dentro, em UTC.
 */

/** Data de negócio `YYYY-MM-DD`. */
export type IsoDate = string;

/** Mês de negócio `YYYY-MM`. */
export type IsoMonth = string;

export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

/** Verdadeiro para `YYYY-MM-DD` que existe no calendário (`2026-02-30` é falso). */
export function isIsoDate(value: unknown): value is IsoDate {
    if (typeof value !== 'string') return false;
    const match = ISO_DATE.exec(value);
    if (!match) return false;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (month < 1 || month > 12 || day < 1) return false;
    return day <= daysInMonth(year, month);
}

/** Verdadeiro para `YYYY-MM` com mês entre 01 e 12. */
export function isIsoMonth(value: unknown): value is IsoMonth {
    if (typeof value !== 'string') return false;
    const match = ISO_MONTH.exec(value);
    if (!match) return false;
    const month = Number(match[2]);
    return month >= 1 && month <= 12;
}

export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type DateParts = { year: number; month: number; day: number };

export function parseIsoDate(date: IsoDate): DateParts {
    if (!isIsoDate(date)) throw new RangeError(`Data inválida: ${date}`);
    const [year, month, day] = date.split('-').map(Number) as [number, number, number];
    return { year, month, day };
}

export function parseIsoMonth(month: IsoMonth): { year: number; month: number } {
    if (!isIsoMonth(month)) throw new RangeError(`Mês inválido: ${month}`);
    const [y, m] = month.split('-').map(Number) as [number, number];
    return { year: y, month: m };
}

const pad = (value: number, size: number) => String(value).padStart(size, '0');

export function toIsoDate({ year, month, day }: DateParts): IsoDate {
    return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function toIsoMonth(year: number, month: number): IsoMonth {
    return `${pad(year, 4)}-${pad(month, 2)}`;
}
