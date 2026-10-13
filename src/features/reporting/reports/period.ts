import { addMonths, isIsoMonth, monthOf, today, type IsoMonth } from '@/shared/dates';

/** As abas de `/relatorios` (spec 0015), na ordem de exibição. */
export const REPORT_TABS = ['saldo', 'por-tipo', 'fluxo'] as const;

export type ReportTab = (typeof REPORT_TABS)[number];

export interface Period {
    from: IsoMonth;
    to: IsoMonth;
}

/** Janela máxima, a mesma da API (`ReportFrom`: mais de 120 meses é 400). */
export const MAX_PERIOD_MONTHS = 120;

export const PERIOD_MESSAGES = {
    required: 'Informe os dois meses.',
    order: 'O mês inicial não pode ser depois do mês final.',
    tooLong: `O período pode ter no máximo ${MAX_PERIOD_MONTHS} meses.`,
} as const;

/**
 * O padrão do período de cada aba, a partir do mês de `today()`: saldo de −5 a +6, por tipo só o
 * mês corrente, fluxo de caixa de −5 ao mês corrente.
 */
export function defaultPeriod(tab: ReportTab, current: IsoMonth = monthOf(today())): Period {
    switch (tab) {
        case 'saldo':
            return { from: addMonths(current, -5), to: addMonths(current, 6) };
        case 'por-tipo':
            return { from: current, to: current };
        case 'fluxo':
            return { from: addMonths(current, -5), to: current };
    }
}

/** Quantos meses a janela cobre, inclusive as pontas. */
function monthsBetween(from: IsoMonth, to: IsoMonth): number {
    const index = (month: IsoMonth) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
    return index(to) - index(from) + 1;
}

/**
 * Valida um período como a API: dois `YYYY-MM`, `de ≤ ate` e no máximo 120 meses. Devolve a
 * mensagem do erro, ou `null` quando o período pode ir à API (AC-0015-09).
 */
export function periodError(from: string | undefined, to: string | undefined): string | null {
    if (!isIsoMonth(from) || !isIsoMonth(to)) return PERIOD_MESSAGES.required;
    if (from > to) return PERIOD_MESSAGES.order;
    if (monthsBetween(from, to) > MAX_PERIOD_MONTHS) return PERIOD_MESSAGES.tooLong;
    return null;
}

/**
 * O período da aba a partir da URL: `de`/`ate` válidos valem; um ausente vem do padrão da aba; um
 * par inválido é descartado e vale o padrão inteiro (ERR-0015-02).
 */
export function resolvePeriod(
    tab: ReportTab,
    search: { de?: IsoMonth; ate?: IsoMonth },
    current?: IsoMonth,
): Period {
    const fallback = defaultPeriod(tab, current);
    const from = search.de ?? fallback.from;
    const to = search.ate ?? fallback.to;
    return periodError(from, to) === null ? { from, to } : fallback;
}
