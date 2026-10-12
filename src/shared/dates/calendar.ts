import {
    BUSINESS_TIME_ZONE,
    daysInMonth,
    parseIsoDate,
    parseIsoMonth,
    toIsoDate,
    toIsoMonth,
    type IsoDate,
    type IsoMonth,
} from './iso';

// Um único formatador: `en-CA` não importa, só as partes numéricas são lidas.
const businessDayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** A data de hoje em `America/Sao_Paulo` (INV-0009-05), seja qual for o fuso do aparelho. */
export function today(): IsoDate {
    const parts = businessDayFormat.formatToParts(new Date());
    const part = (type: 'year' | 'month' | 'day') =>
        Number(parts.find((p) => p.type === type)?.value);
    return toIsoDate({ year: part('year'), month: part('month'), day: part('day') });
}

/** Soma `n` dias (negativo subtrai) por aritmética de calendário em UTC, sem fuso. */
export function addDays(date: IsoDate, n: number): IsoDate {
    const { year, month, day } = parseIsoDate(date);
    const shifted = new Date(Date.UTC(year, month - 1, day + n));
    return toIsoDate({
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
    });
}

/** Soma `n` meses a um `YYYY-MM`. */
export function addMonths(month: IsoMonth, n: number): IsoMonth {
    const parsed = parseIsoMonth(month);
    const index = parsed.year * 12 + (parsed.month - 1) + n;
    return toIsoMonth(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
}

/** O mês de uma data: `'2026-10-15'` → `'2026-10'`. */
export function monthOf(date: IsoDate): IsoMonth {
    const { year, month } = parseIsoDate(date);
    return toIsoMonth(year, month);
}

/** O primeiro e o último dia do mês, como os filtros `from`/`to` da API. */
export function monthRange(month: IsoMonth): { from: IsoDate; to: IsoDate } {
    const parsed = parseIsoMonth(month);
    return {
        from: toIsoDate({ ...parsed, day: 1 }),
        to: toIsoDate({ ...parsed, day: daysInMonth(parsed.year, parsed.month) }),
    };
}
