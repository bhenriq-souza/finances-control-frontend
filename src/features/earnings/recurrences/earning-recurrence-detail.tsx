import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarX, ChevronLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useCan } from '@/api/permissions';
import { useAccountLookup } from '@/api/queries/lookups';
import { formatDate } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton, Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { earningBadge } from '@/ui/status-labels';

import type { Earning } from '../list/earning-model';
import { asApiError, earningsListQuery } from '../list/earnings-query';

import { type EarningRecurrence, useEarningRecurrence } from './api';
import { EndEarningRecurrenceDialog } from './end-recurrence';
import { useEarningTypeNames } from './earning-recurrences';
import { dayOfMonthText, isEnded, occurrencesOf, occurrenceWindow } from './recurrence-model';
import type { EarningRecurrenceSearch } from './search';

const LIST = '/series';

const LINK_CLASS =
    'rounded-sm text-acento underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco';

export interface EarningRecurrenceDetailPageProps {
    recurrenceId: string;
    search: EarningRecurrenceSearch;
    /** Atualiza os parâmetros de busca da rota (os não citados ficam como estão). */
    onSearchChange: (next: Partial<EarningRecurrenceSearch>) => void;
}

/** `/series/receitas/$serieId` (spec 0017, "Detalhe"). */
export function EarningRecurrenceDetailPage({
    recurrenceId,
    search,
    onSearchChange,
}: EarningRecurrenceDetailPageProps) {
    const query = useEarningRecurrence(recurrenceId);

    let content: ReactNode;
    // Com dado, ele vale mesmo que um recarregamento falhe.
    if (query.data) {
        content = (
            <RecurrenceDetail
                recurrence={query.data}
                search={search}
                onSearchChange={onSearchChange}
            />
        );
    } else if (query.isError) {
        const error = asApiError(query.error);
        content =
            error.code === 'EARNING_RECURRENCE_NOT_FOUND' ? (
                <EmptyState variant="nao-encontrado" backTo={LIST} />
            ) : (
                <EmptyState variant="erro" error={error} onRetry={() => void query.refetch()} />
            );
    } else {
        content = (
            <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    return (
        <div className="flex max-w-3xl flex-col gap-4">
            <Link to={LIST} className={`inline-flex items-center gap-1 self-start ${LINK_CLASS}`}>
                <ChevronLeft aria-hidden="true" className="size-4" />
                Séries fixas
            </Link>
            {content}
        </div>
    );
}

function Item({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1 border-t border-linha py-3 first:border-t-0 md:flex-row md:gap-4">
            <dt className="text-rotulo text-texto-apoio md:w-44 md:shrink-0">{term}</dt>
            <dd className="text-corpo text-texto">{children}</dd>
        </div>
    );
}

/**
 * Um diálogo aberto pela URL só abre se a ação existe; aberto, fica aberto mesmo que um
 * recarregamento a tire (o erro continua à vista).
 */
function useLatchedOpen(requested: boolean, allowed: boolean): boolean {
    const [latched, setLatched] = useState(false);
    const open = requested && (allowed || latched);
    if (open !== latched) setLatched(open);
    return open;
}

function RecurrenceDetail({
    recurrence,
    search,
    onSearchChange,
}: Omit<EarningRecurrenceDetailPageProps, 'recurrenceId'> & { recurrence: EarningRecurrence }) {
    const canWrite = useCan('entries.write');
    const typeName = useEarningTypeNames();
    const accounts = useAccountLookup();
    const canEnd = canWrite && !isEnded(recurrence);
    const endOpen = useLatchedOpen(canWrite && search.encerrar === 1, canEnd);

    return (
        <article className="flex flex-col gap-4">
            <header className="flex flex-col gap-2">
                <h1 className="text-titulo-1">{recurrence.description}</h1>
                <Money
                    cents={recurrence.amountCents}
                    sign="always"
                    tone="auto"
                    size="valor-destaque"
                />
                {canEnd && (
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => onSearchChange({ encerrar: 1 })}>
                            <CalendarX aria-hidden="true" />
                            Encerrar série
                        </Button>
                    </div>
                )}
            </header>

            <section className="rounded-md border border-linha bg-superficie px-4 md:px-6">
                <dl className="flex flex-col">
                    <Item term="Tipo">{typeName(recurrence.typeId)}</Item>
                    <Item term="Repetição">{dayOfMonthText(recurrence.dayOfMonth)}</Item>
                    <Item term="Conta">{accounts.label(recurrence.bankAccountId)}</Item>
                    <Item term="Início">{formatDate(recurrence.startsOn, 'longa')}</Item>
                    <Item term="Próxima ocorrência">
                        {recurrence.nextOccurrenceOn
                            ? formatDate(recurrence.nextOccurrenceOn, 'longa')
                            : '—'}
                    </Item>
                    <Item term="Fim">
                        {recurrence.endsOn ? formatDate(recurrence.endsOn, 'longa') : 'Sem fim'}
                    </Item>
                </dl>
            </section>

            <Occurrences recurrence={recurrence} />

            {endOpen && (
                <EndEarningRecurrenceDialog
                    open
                    recurrence={recurrence}
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ encerrar: undefined });
                    }}
                />
            )}
        </article>
    );
}

const occurrenceColumns: readonly EntryColumn<Earning>[] = [
    { header: 'Data', cell: (earning) => formatDate(earning.occurredOn, 'longa') },
    { header: 'Descrição', cell: (earning) => earning.description },
    { header: 'Status', cell: (earning) => <StatusBadge badge={earningBadge(earning)} /> },
    {
        header: 'Valor',
        cell: (earning) => <Money cents={earning.amountCents} sign="always" tone="auto" />,
        align: 'end',
    },
];

/**
 * As ocorrências: `GET /earnings` no período da série, filtradas no cliente pelo `recurrenceId`
 * (a API não filtra por série; INV-0017-03), em ordem de data.
 */
function Occurrences({ recurrence }: { recurrence: EarningRecurrence }) {
    const query = useQuery(earningsListQuery(occurrenceWindow(recurrence)));

    let content: ReactNode;
    if (query.isError) {
        content = (
            <EmptyState
                variant="erro"
                error={asApiError(query.error)}
                onRetry={() => void query.refetch()}
            />
        );
    } else if (!query.data) {
        content = <EntryListSkeleton />;
    } else {
        content = (
            <EntryList
                items={occurrencesOf(query.data, recurrence.id)}
                getKey={(earning) => earning.id}
                caption="Ocorrências da série"
                columns={occurrenceColumns}
                href={(earning) => `/receitas/${earning.id}`}
                renderCard={(earning) => (
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <span className="text-corpo-forte">
                                {formatDate(earning.occurredOn, 'longa')}
                            </span>
                            <StatusBadge badge={earningBadge(earning)} />
                        </div>
                        <Money cents={earning.amountCents} sign="always" tone="auto" />
                    </div>
                )}
                empty={
                    <EmptyState
                        variant="vazio"
                        title="Nenhuma ocorrência no período."
                        description="As ocorrências da série aparecem aqui."
                    />
                }
            />
        );
    }

    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-titulo-3">Ocorrências</h2>
            {content}
        </section>
    );
}
