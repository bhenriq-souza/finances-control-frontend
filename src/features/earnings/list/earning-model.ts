import type { components } from '@/api/generated/schema';

export type Earning = components['schemas']['EarningResponse'];
export type EarningKind = components['schemas']['EarningKind'];
export type EarningStatus = components['schemas']['EarningStatus'];

/** Natureza da receita, na ordem do formulário e do filtro (spec 0012, "Natureza"). */
export const EARNING_KINDS: readonly EarningKind[] = ['VARIABLE', 'INSTALLMENT', 'FIXED'];

export const EARNING_KIND_LABELS: Readonly<Record<EarningKind, string>> = {
    VARIABLE: 'Variável',
    INSTALLMENT: 'Parcelada',
    FIXED: 'Fixa',
};

/** Os status da API, na ordem do filtro. */
export const EARNING_STATUSES: readonly EarningStatus[] = [
    'OPEN',
    'FORECAST',
    'VERIFYING',
    'OVERDUE',
    'RECEIVED',
];

/** Apoio da descrição: "Parcela n de N" numa parcela, "Fixa" numa ocorrência de série. */
export function earningSupport(earning: Pick<Earning, 'installment' | 'recurrenceId'>) {
    if (earning.installment) {
        return `Parcela ${earning.installment.number} de ${earning.installment.total}`;
    }
    return earning.recurrenceId ? 'Fixa' : null;
}
