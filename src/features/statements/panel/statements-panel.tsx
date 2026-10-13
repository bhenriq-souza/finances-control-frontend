import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { formatDate, formatMonth, monthOf } from '@/shared/dates';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton, Skeleton } from '@/ui/skeleton';

import {
    asApiError,
    currentStatementQuery,
    previousStatements,
    statementHref,
    statementsListQuery,
    upcomingStatements,
    upcomingWindow,
    type Statement,
} from './statement-model';
import { RefundActions, type RefundActionSlots } from '../refunds/refund-actions';

import { Heading, StatementBadge, StatementBody, StatementDates } from './statement-parts';

function closingMonth(statement: Statement): string {
    return formatMonth(monthOf(statement.closesOn));
}

/** Um bloco do painel, com o seu próprio carregamento e erro (ERR-0013-02, "por bloco"). */
function PanelSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return (
        <section aria-labelledby={id} className="flex flex-col gap-4">
            <Heading level={2} id={id}>
                {title}
            </Heading>
            {children}
        </section>
    );
}

function QueryError({ query }: { query: Pick<UseQueryResult, 'error' | 'refetch'> }) {
    return (
        <EmptyState
            variant="erro"
            error={asApiError(query.error ?? new Error())}
            onRetry={() => void query.refetch()}
        />
    );
}

function CurrentStatement({
    query,
    refunds,
}: {
    query: UseQueryResult<Statement>;
    refunds: RefundActionSlots;
}) {
    if (query.isError) return <QueryError query={query} />;
    if (!query.data) {
        return (
            <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }
    const statement = query.data;
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <StatementDates statement={statement} />
                <StatementBadge statement={statement} />
            </div>
            {refunds.newRefund && <div className="flex flex-wrap gap-3">{refunds.newRefund}</div>}
            <StatementBody statement={statement} level={3} refundActions={refunds.rowActions} />
        </div>
    );
}

type PersistedStatement = Statement & { id: string };

const PREVIOUS_COLUMNS: readonly EntryColumn<PersistedStatement>[] = [
    { header: 'Mês', cell: closingMonth },
    { header: 'Vencimento', cell: (statement) => formatDate(statement.dueOn, 'curta') },
    { header: 'Status', cell: (statement) => <StatementBadge statement={statement} /> },
    {
        header: 'Total',
        cell: (statement) => <Money cents={statement.amountDueCents} />,
        align: 'end',
    },
    {
        header: 'Restante',
        cell: (statement) => <Money cents={statement.remainingCents} />,
        align: 'end',
    },
];

function PreviousStatements({ cardId }: { cardId: string }) {
    const query = useQuery(statementsListQuery(cardId));
    if (query.isError) return <QueryError query={query} />;
    if (!query.data) return <EntryListSkeleton />;
    return (
        <EntryList
            items={previousStatements(query.data)}
            getKey={(statement) => statement.id}
            caption="Faturas anteriores"
            columns={PREVIOUS_COLUMNS}
            renderCard={(statement) => (
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-corpo text-texto">{closingMonth(statement)}</span>
                        <span className="text-pequeno text-texto-apoio">
                            Vence em {formatDate(statement.dueOn, 'curta')}
                        </span>
                        <StatementBadge statement={statement} />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        <Money cents={statement.amountDueCents} />
                        <span className="text-pequeno text-texto-apoio">
                            Restante <Money cents={statement.remainingCents} size="valor-pequeno" />
                        </span>
                    </div>
                </div>
            )}
            href={(statement) => statementHref(cardId, statement.id)}
            empty={
                <EmptyState
                    variant="vazio"
                    title="Nenhuma fatura fechada."
                    description="As faturas fechadas dos últimos 12 meses aparecem aqui."
                />
            }
        />
    );
}

const UPCOMING_COLUMNS: readonly EntryColumn<Statement>[] = [
    { header: 'Mês', cell: closingMonth },
    { header: 'Total', cell: (statement) => <Money cents={statement.totalCents} />, align: 'end' },
];

/** Próximas faturas (projetadas, sem `id`): nunca têm link nem ação (INV-0013-03). */
function UpcomingStatements({
    cardId,
    current,
}: {
    cardId: string;
    current: UseQueryResult<Statement>;
}) {
    const closesOn = current.data?.closesOn;
    const query = useQuery({
        ...statementsListQuery(cardId, closesOn ? upcomingWindow(closesOn) : undefined),
        enabled: closesOn !== undefined,
    });
    if (current.isError) return <QueryError query={current} />;
    if (query.isError) return <QueryError query={query} />;
    if (!query.data) return <EntryListSkeleton />;
    return (
        <EntryList
            items={upcomingStatements(query.data)}
            getKey={(statement) => statement.closesOn}
            caption="Próximas faturas"
            columns={UPCOMING_COLUMNS}
            renderCard={(statement) => (
                <div className="flex items-center justify-between gap-3">
                    <span className="text-corpo text-texto">{closingMonth(statement)}</span>
                    <Money cents={statement.totalCents} />
                </div>
            )}
            empty={
                <EmptyState
                    variant="vazio"
                    title="Nenhuma fatura futura."
                    description="As parcelas das próximas faturas aparecem aqui."
                />
            }
        />
    );
}

/**
 * Painel de faturas de `/cartoes/$cartaoId` (spec 0013), só leitura: a fatura aberta de hoje com
 * o detalhe, as anteriores (com link para o detalhe) e as próximas (sem link). Cada bloco carrega
 * e falha sozinho.
 */
export function StatementsPanel({ cardId }: { cardId: string }) {
    const current = useQuery(currentStatementQuery(cardId));
    return (
        <div className="flex flex-col gap-8">
            <PanelSection id="fatura-atual" title="Fatura atual">
                <RefundActions cardId={cardId}>
                    {(refunds) => <CurrentStatement query={current} refunds={refunds} />}
                </RefundActions>
            </PanelSection>
            <PanelSection id="faturas-anteriores" title="Faturas anteriores">
                <PreviousStatements cardId={cardId} />
            </PanelSection>
            <PanelSection id="proximas-faturas" title="Próximas faturas">
                <UpcomingStatements cardId={cardId} current={current} />
            </PanelSection>
        </div>
    );
}
