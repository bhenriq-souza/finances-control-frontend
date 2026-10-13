import { Repeat } from 'lucide-react';
import { useMemo } from 'react';

import { useAccountLookup, useCardLookup, type Lookup } from '@/api/queries/lookups';
import { useExpenseTypes } from '@/api/queries/reference';
import { formatDate } from '@/shared/dates';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton } from '@/ui/skeleton';

import { asApiError } from '../list/expense-list-search';

import { type ExpenseRecurrence, useExpenseRecurrences } from './api';
import { dayOfMonthText } from './recurrence-model';

/** Nome do tipo por id: a série só traz o `typeId` (spec 0017, "Lista"). */
export function useExpenseTypeNames(): (id: string) => string {
    const { data } = useExpenseTypes();
    return useMemo(() => {
        const names = new Map((data ?? []).map((type) => [type.id, type.name]));
        return (id: string) => names.get(id) ?? '';
    }, [data]);
}

/** A conta ou o cartão da série, por nome. */
export function paymentOf(recurrence: ExpenseRecurrence, accounts: Lookup, cards: Lookup) {
    if (recurrence.bankAccountId) return accounts.label(recurrence.bankAccountId);
    return recurrence.creditCardId ? cards.label(recurrence.creditCardId) : '';
}

const nextText = (recurrence: ExpenseRecurrence) =>
    recurrence.nextOccurrenceOn ? formatDate(recurrence.nextOccurrenceOn, 'curta') : '—';

const endText = (recurrence: ExpenseRecurrence) =>
    recurrence.endsOn ? formatDate(recurrence.endsOn, 'longa') : 'Sem fim';

/** Valor da série de despesa: negado, com o `−` sempre visível (sinal do domínio). */
const amount = (recurrence: ExpenseRecurrence) => (
    <Money cents={-recurrence.amountCents} sign="always" tone="auto" />
);

export interface ExpenseRecurrencesProps {
    /** **Mostrar encerradas**: a lista vem sem `active=true`. */
    showEnded: boolean;
}

/** A aba **Despesas** de `/series` (spec 0017, "Lista"). */
export function ExpenseRecurrences({ showEnded }: ExpenseRecurrencesProps) {
    const query = useExpenseRecurrences(showEnded);
    const typeName = useExpenseTypeNames();
    const accounts = useAccountLookup();
    const cards = useCardLookup();

    if (query.isError) {
        return (
            <EmptyState
                variant="erro"
                error={asApiError(query.error)}
                onRetry={() => void query.refetch()}
            />
        );
    }
    if (!query.data) return <EntryListSkeleton />;

    const columns: readonly EntryColumn<ExpenseRecurrence>[] = [
        { header: 'Descrição', cell: (recurrence) => recurrence.description },
        { header: 'Tipo', cell: (recurrence) => typeName(recurrence.typeId) },
        {
            header: 'Repetição',
            cell: (recurrence) => dayOfMonthText(recurrence.dayOfMonth),
            hideBelow: 'lg',
        },
        {
            header: 'Conta / cartão',
            cell: (recurrence) => paymentOf(recurrence, accounts, cards),
        },
        { header: 'Próxima', cell: nextText },
        { header: 'Fim', cell: endText, hideBelow: 'lg' },
        { header: 'Valor', cell: amount, align: 'end' },
    ];

    return (
        <EntryList
            items={query.data}
            getKey={(recurrence) => recurrence.id}
            caption="Séries de despesas"
            columns={columns}
            href={(recurrence) => `/series/despesas/${recurrence.id}`}
            renderCard={(recurrence) => (
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-corpo-forte">{recurrence.description}</span>
                        <span className="text-pequeno text-texto-apoio">
                            <span>{typeName(recurrence.typeId)}</span> ·{' '}
                            <span>{paymentOf(recurrence, accounts, cards)}</span>
                        </span>
                        <span className="text-pequeno text-texto-apoio">
                            {dayOfMonthText(recurrence.dayOfMonth)} · Próxima:{' '}
                            {nextText(recurrence)} · Fim: {endText(recurrence)}
                        </span>
                    </div>
                    {amount(recurrence)}
                </div>
            )}
            empty={
                <EmptyState
                    variant="vazio"
                    icon={Repeat}
                    title={
                        showEnded ? 'Nenhuma série de despesa.' : 'Nenhuma série de despesa ativa.'
                    }
                    description="Lançar uma despesa fixa cria a série, que repete o lançamento todo mês."
                />
            }
        />
    );
}
