import { Repeat } from 'lucide-react';
import { useMemo } from 'react';

import { useAccountLookup } from '@/api/queries/lookups';
import { useEarningTypes } from '@/api/queries/reference';
import { formatDate } from '@/shared/dates';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton } from '@/ui/skeleton';

import { asApiError } from '../list/earnings-query';

import { type EarningRecurrence, useEarningRecurrences } from './api';
import { dayOfMonthText } from './recurrence-model';

/** Nome do tipo por id: a série só traz o `typeId` (spec 0017, "Lista"). */
export function useEarningTypeNames(): (id: string) => string {
    const { data } = useEarningTypes();
    return useMemo(() => {
        const names = new Map((data ?? []).map((type) => [type.id, type.name]));
        return (id: string) => names.get(id) ?? '';
    }, [data]);
}

const nextText = (recurrence: EarningRecurrence) =>
    recurrence.nextOccurrenceOn ? formatDate(recurrence.nextOccurrenceOn, 'curta') : '—';

const endText = (recurrence: EarningRecurrence) =>
    recurrence.endsOn ? formatDate(recurrence.endsOn, 'longa') : 'Sem fim';

/** Valor da série de receita, com o `+` sempre visível (sinal do domínio). */
const amount = (recurrence: EarningRecurrence) => (
    <Money cents={recurrence.amountCents} sign="always" tone="auto" />
);

export interface EarningRecurrencesProps {
    /** **Mostrar encerradas**: a lista vem sem `active=true`. */
    showEnded: boolean;
}

/** A aba **Receitas** de `/series` (spec 0017, "Lista"). */
export function EarningRecurrences({ showEnded }: EarningRecurrencesProps) {
    const query = useEarningRecurrences(showEnded);
    const typeName = useEarningTypeNames();
    const accounts = useAccountLookup();

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

    const columns: readonly EntryColumn<EarningRecurrence>[] = [
        { header: 'Descrição', cell: (recurrence) => recurrence.description },
        { header: 'Tipo', cell: (recurrence) => typeName(recurrence.typeId) },
        {
            header: 'Repetição',
            cell: (recurrence) => dayOfMonthText(recurrence.dayOfMonth),
            hideBelow: 'lg',
        },
        { header: 'Conta', cell: (recurrence) => accounts.label(recurrence.bankAccountId) },
        { header: 'Próxima', cell: nextText },
        { header: 'Fim', cell: endText, hideBelow: 'lg' },
        { header: 'Valor', cell: amount, align: 'end' },
    ];

    return (
        <EntryList
            items={query.data}
            getKey={(recurrence) => recurrence.id}
            caption="Séries de receitas"
            columns={columns}
            href={(recurrence) => `/series/receitas/${recurrence.id}`}
            renderCard={(recurrence) => (
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-corpo-forte">{recurrence.description}</span>
                        <span className="text-pequeno text-texto-apoio">
                            <span>{typeName(recurrence.typeId)}</span> ·{' '}
                            <span>{accounts.label(recurrence.bankAccountId)}</span>
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
                        showEnded ? 'Nenhuma série de receita.' : 'Nenhuma série de receita ativa.'
                    }
                    description="Lançar uma receita fixa cria a série, que repete o lançamento todo mês."
                />
            }
        />
    );
}
