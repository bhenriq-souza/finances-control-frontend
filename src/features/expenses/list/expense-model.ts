import type { components, operations } from '@/api/generated/schema';
import { monthOf, today, type IsoDate, type IsoMonth } from '@/shared/dates';

export type Expense = components['schemas']['ExpenseResponse'];
export type ExpenseKind = components['schemas']['ExpenseKind'];
export type ExpenseStatus = components['schemas']['ExpenseStatus'];

/** Parâmetros de `GET /expenses`, exatamente como o contrato os define. */
export type ExpenseListQuery = NonNullable<operations['listExpenses']['parameters']['query']>;

export const EXPENSE_STATUSES = [
    'OPEN',
    'FORECAST',
    'PAID',
    'OVERDUE',
    'VERIFYING',
] as const satisfies readonly ExpenseStatus[];

export const EXPENSE_KINDS = [
    'VARIABLE',
    'INSTALLMENT',
    'FIXED',
] as const satisfies readonly ExpenseKind[];

/** Rótulos da natureza (spec 0012, "Filtros" e formulário). */
export const EXPENSE_KIND_LABELS: Readonly<Record<ExpenseKind, string>> = {
    VARIABLE: 'Variável',
    INSTALLMENT: 'Parcelada',
    FIXED: 'Fixa',
};

/** Texto de apoio da descrição: "Parcela n de N" numa parcela, "Fixa" numa ocorrência de série. */
export function expenseSupportText(expense: Expense): string | null {
    if (expense.installment) {
        return `Parcela ${expense.installment.number} de ${expense.installment.total}`;
    }
    if (expense.recurrenceId) return 'Fixa';
    return null;
}

const collator = new Intl.Collator('pt-BR');

/** Ordem da lista: `occurredOn` crescente, depois `description` (no cliente, spec 0012). */
export function sortExpenses(expenses: readonly Expense[]): Expense[] {
    return [...expenses].sort(
        (a, b) =>
            a.occurredOn.localeCompare(b.occurredOn) ||
            collator.compare(a.description, b.description),
    );
}

export interface ExpenseSummary {
    /** Soma de `amountCents` da lista carregada. */
    totalCents: number;
    paid: number;
    pending: number;
    overdue: number;
}

/**
 * Resumo do mês, somado no cliente (a API não devolve totais; a lista é completa por não haver
 * paginação). Pagas são `PAID`, vencidas são `OVERDUE` e pendentes são as demais, ainda por pagar
 * (`OPEN`, `FORECAST`, `VERIFYING`).
 */
export function summarizeExpenses(expenses: readonly Expense[]): ExpenseSummary {
    const summary: ExpenseSummary = { totalCents: 0, paid: 0, pending: 0, overdue: 0 };
    for (const expense of expenses) {
        summary.totalCents += expense.amountCents;
        if (expense.status === 'PAID') summary.paid += 1;
        else if (expense.status === 'OVERDUE') summary.overdue += 1;
        else summary.pending += 1;
    }
    return summary;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "n pagas · n pendentes · n vencidas", com o singular para 1. */
export function summaryCountsText({ paid, pending, overdue }: ExpenseSummary): string {
    return [
        plural(paid, 'paga', 'pagas'),
        plural(pending, 'pendente', 'pendentes'),
        plural(overdue, 'vencida', 'vencidas'),
    ].join(' · ');
}

/** O mês de referência padrão da lista: o de `today()`. */
export const currentMonth = (reference: IsoDate = today()): IsoMonth => monthOf(reference);
