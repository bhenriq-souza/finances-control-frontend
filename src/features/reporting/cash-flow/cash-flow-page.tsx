import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { useAccountLookup } from '@/api/queries/lookups';
import { useCreditCards } from '@/api/queries/reference';
import {
    addMonths,
    formatDate,
    formatMonth,
    monthOf,
    monthRange,
    today,
    type IsoMonth,
} from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton, Skeleton } from '@/ui/skeleton';
import { SelectField } from '@/ui/select-field';
import { StatusBadge } from '@/ui/status-badge';
import { earningBadge, expenseBadge, statementBadge, type Badge } from '@/ui/status-labels';

import { activeCards, countLabel } from '../dashboard/dashboard-data';
import { asApiError, expensesQuery, monthEarningsQuery } from '../dashboard/dashboard-queries';
import { balanceReportQuery } from '../reports/queries';

import {
    balanceWindow,
    cashFlowBalances,
    cashFlowRows,
    filterRows,
    overdueBefore,
    rowAmount,
    summarizeRows,
    type BalanceKind,
    type BalanceValue,
    type CashFlowRow,
    type Earning,
    type Expense,
    type FlowTotal,
    type Statement,
} from './cash-flow-model';
import { monthStatementsQuery, overdueEarningsQuery } from './queries';
import { cashFlowMonth, SITUATIONS, type CashFlowSearch, type Situation } from './search';

/** O menu de cada tipo de linha, que a rota compõe com as ações das outras features. */
export interface CashFlowRowActions {
    expense?: (expense: Expense) => ReactNode;
    earning?: (earning: Earning) => ReactNode;
    statement?: (statement: Statement) => ReactNode;
}

export interface CashFlowPageProps {
    search: CashFlowSearch;
    /** Troca o mês ou o filtro; a rota mantém os demais parâmetros. */
    onSearchChange: (next: Pick<CashFlowSearch, 'mes' | 'situacao'>) => void;
    /** O menu das linhas; sem ele (o `leitor`), nenhuma linha tem menu. */
    rowActions?: CashFlowRowActions;
    /** Os alertas de erro das transições sem diálogo, acima da lista. */
    alerts?: ReactNode;
    /** Os diálogos das ações, sobre a tela. */
    dialogs?: ReactNode;
}

const SITUATION_LABELS: Readonly<Record<Situation, string>> = {
    realizados: 'Realizados',
    'a-vencer': 'A vencer',
    vencidos: 'Vencidos',
};

/** O selo de um saldo do resumo: realizado ou previsto, pelo `kind` do ponto da API. */
const BALANCE_BADGES: Readonly<Record<BalanceKind, Badge>> = {
    REALIZED: { label: 'Realizado', family: 'neutra' },
    FORECAST: { label: 'Previsto', family: 'info' },
};

const PANEL = 'flex min-w-0 flex-col gap-2 rounded-md border border-linha bg-superficie p-4';

const LINK_CLASS =
    'rounded-sm text-acento underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco';

function MonthNavigation({ month, onGo }: { month: IsoMonth; onGo: (n: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <Button variant="ghost" aria-label="Mês anterior" onClick={() => onGo(-1)}>
                <ChevronLeft aria-hidden="true" className="size-5" />
            </Button>
            <h2 className="min-w-44 text-center text-titulo-3" aria-live="polite">
                {formatMonth(month)}
            </h2>
            <Button variant="ghost" aria-label="Próximo mês" onClick={() => onGo(1)}>
                <ChevronRight aria-hidden="true" className="size-5" />
            </Button>
        </div>
    );
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
    const id = useId();
    return (
        <section aria-labelledby={id} className={PANEL}>
            <h3 id={id} className="text-rotulo text-texto-apoio">
                {title}
            </h3>
            {children}
        </section>
    );
}

function BalanceCard({ title, value }: { title: string; value: BalanceValue | null }) {
    return (
        <SummaryCard title={title}>
            {value ? (
                <>
                    <Money cents={value.cents} size="valor" />
                    <StatusBadge badge={BALANCE_BADGES[value.kind]} className="self-start" />
                </>
            ) : (
                <span className="text-corpo text-texto-apoio">—</span>
            )}
        </SummaryCard>
    );
}

function FlowCard({ title, total, sign }: { title: string; total: FlowTotal; sign: 1 | -1 }) {
    return (
        <SummaryCard title={title}>
            <Money cents={sign * total.totalCents} sign="always" tone="auto" />
            <p className="text-pequeno text-texto-apoio">
                {countLabel(total.realized, 'realizada', 'realizadas')} ·{' '}
                {countLabel(total.pending, 'pendente', 'pendentes')}
            </p>
        </SummaryCard>
    );
}

/** A nota das vencidas de meses anteriores, que o saldo previsto do mês corrente conta. */
function OverdueNote({ expenses, earnings }: { expenses: number; earnings: number }) {
    const total = expenses + earnings;
    if (total === 0) return null;
    return (
        <div className="flex flex-col gap-2 rounded-md border border-linha bg-superficie-elevada p-4 text-pequeno text-texto md:flex-row md:flex-wrap md:items-center md:gap-4">
            <p>
                O saldo previsto conta com {countLabel(total, 'vencida', 'vencidas')} de meses
                anteriores.
            </p>
            {expenses > 0 && (
                <Link
                    to="/despesas"
                    search={{ status: 'OVERDUE' }}
                    className={clsx('inline-flex min-h-11 items-center', LINK_CLASS)}
                >
                    Ver despesas vencidas
                </Link>
            )}
            {earnings > 0 && (
                <Link
                    to="/receitas"
                    search={{ status: 'OVERDUE' }}
                    className={clsx('inline-flex min-h-11 items-center', LINK_CLASS)}
                >
                    Ver receitas vencidas
                </Link>
            )}
        </div>
    );
}

/** O estado de um grupo de consultas: o primeiro erro, ou se ainda falta algum dado. */
function groupState(queries: readonly UseQueryResult[]) {
    const failed = queries.find((query) => query.isError);
    return {
        error: failed ? asApiError(failed.error) : null,
        pending: queries.some((query) => query.data === undefined),
        retry: () => {
            for (const query of queries) if (query.isError) void query.refetch();
        },
    };
}

function Summary({
    rows,
    month,
    current,
    listQueries,
}: {
    rows: readonly CashFlowRow[] | undefined;
    month: IsoMonth;
    current: IsoMonth;
    listQueries: readonly UseQueryResult[];
}) {
    const balance = useQuery(balanceReportQuery(balanceWindow(month, current)));
    const isCurrent = month === current;
    const overdueExpenses = useQuery({
        ...expensesQuery({ status: 'OVERDUE' }),
        enabled: isCurrent,
    });
    const overdueEarnings = useQuery({ ...overdueEarningsQuery, enabled: isCurrent });
    const state = groupState([balance, ...listQueries]);

    let content;
    if (state.error) {
        content = <EmptyState variant="erro" error={state.error} onRetry={state.retry} />;
    } else if (state.pending || !rows || !balance.data) {
        content = (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className="h-24 w-full" />
                ))}
            </div>
        );
    } else {
        const balances = cashFlowBalances(balance.data, month, current);
        const summary = summarizeRows(rows);
        content = (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <BalanceCard title="Saldo no início" value={balances?.start ?? null} />
                <FlowCard title="Entradas" total={summary.inflows} sign={1} />
                <FlowCard title="Saídas" total={summary.outflows} sign={-1} />
                <BalanceCard title="Saldo no fim" value={balances?.end ?? null} />
            </div>
        );
    }

    return (
        <section aria-label="Resumo do mês" className="flex flex-col gap-3">
            {content}
            {isCurrent && overdueExpenses.data && overdueEarnings.data && (
                <OverdueNote
                    {...overdueBefore(month, overdueExpenses.data, overdueEarnings.data)}
                />
            )}
        </section>
    );
}

interface RowTexts {
    title: string;
    support: string | null;
}

function RowDescription({ texts }: { texts: RowTexts }) {
    return (
        <span className="flex min-w-0 flex-col">
            <span>{texts.title}</span>
            {texts.support && (
                <span className="text-pequeno text-texto-apoio">{texts.support}</span>
            )}
        </span>
    );
}

function rowBadge(row: CashFlowRow): Badge {
    switch (row.kind) {
        case 'earning':
            return earningBadge(row.earning);
        case 'expense':
            return expenseBadge(row.expense);
        case 'statement':
            return statementBadge(row.statement);
    }
}

/** O destino da linha (spec 0015): o lançamento, a fatura ou, na projetada, o cartão. */
function rowHref(row: CashFlowRow): string {
    switch (row.kind) {
        case 'earning':
            return `/receitas/${row.earning.id}`;
        case 'expense':
            return `/despesas/${row.expense.id}`;
        case 'statement':
            return row.statement.id
                ? `/cartoes/${row.card.id}/faturas/${row.statement.id}`
                : `/cartoes/${row.card.id}`;
    }
}

function rowMenu(actions: CashFlowRowActions, row: CashFlowRow): ReactNode {
    switch (row.kind) {
        case 'earning':
            return actions.earning?.(row.earning) ?? null;
        case 'expense':
            return actions.expense?.(row.expense) ?? null;
        case 'statement':
            return actions.statement?.(row.statement) ?? null;
    }
}

const Amount = ({ row }: { row: CashFlowRow }) => (
    <Money cents={rowAmount(row)} sign="always" tone="auto" />
);

function RowList({
    rows,
    situation,
    month,
    rowActions,
}: {
    rows: readonly CashFlowRow[];
    situation: Situation | undefined;
    month: IsoMonth;
    rowActions: CashFlowRowActions | undefined;
}) {
    const accounts = useAccountLookup();
    const texts = (row: CashFlowRow): RowTexts => {
        switch (row.kind) {
            case 'earning':
                return {
                    title: row.earning.description,
                    support: `${row.earning.earningType.name} · ${accounts.label(row.earning.bankAccountId)}`,
                };
            case 'expense':
                return {
                    title: row.expense.description,
                    support: `${row.expense.expenseType.name} · ${accounts.label(row.expense.bankAccountId ?? '')}`,
                };
            case 'statement':
                return {
                    title: `Fatura ${row.card.name}`,
                    support: row.card.paymentBankAccountId
                        ? accounts.label(row.card.paymentBankAccountId)
                        : null,
                };
        }
    };

    const columns: readonly EntryColumn<CashFlowRow>[] = [
        { header: 'Data', cell: (row) => formatDate(row.date, 'relativa') },
        { header: 'Descrição', cell: (row) => <RowDescription texts={texts(row)} /> },
        { header: 'Situação', cell: (row) => <StatusBadge badge={rowBadge(row)} /> },
        { header: 'Valor', cell: (row) => <Amount row={row} />, align: 'end' },
    ];
    const hasActions =
        rowActions !== undefined &&
        (rowActions.expense !== undefined ||
            rowActions.earning !== undefined ||
            rowActions.statement !== undefined);

    return (
        <EntryList
            items={filterRows(rows, situation)}
            getKey={(row) => row.key}
            caption={`Fluxo de caixa de ${formatMonth(month)}`}
            columns={columns}
            renderCard={(row) => (
                <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <span className="text-corpo-forte">
                            <RowDescription texts={texts(row)} />
                        </span>
                        <Amount row={row} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-pequeno text-texto-apoio">
                        <span>{formatDate(row.date, 'relativa')}</span>
                        <StatusBadge badge={rowBadge(row)} />
                    </div>
                </div>
            )}
            href={rowHref}
            actions={hasActions ? (row) => rowMenu(rowActions, row) : undefined}
            empty={
                <EmptyState
                    variant="vazio"
                    icon={Wallet}
                    title={
                        rows.length === 0
                            ? 'Nada entra nem sai neste mês.'
                            : 'Nada nesta situação neste mês.'
                    }
                />
            }
        />
    );
}

/**
 * Fluxo de caixa do mês (`/fluxo-de-caixa`, spec 0015): o resumo (saldos, entradas e saídas) e a
 * lista de receitas, despesas de conta e faturas com data no mês, com o filtro de situação. As
 * ações das linhas vêm da rota, que as compõe com `expenses`, `earnings` e `statements`: este
 * módulo não importa outra feature (INV-0015-06).
 */
export function CashFlowPage({
    search,
    onSearchChange,
    rowActions,
    alerts,
    dialogs,
}: CashFlowPageProps) {
    const current = monthOf(today());
    const month = cashFlowMonth(search);
    const earnings = useQuery(monthEarningsQuery(month));
    const expenses = useQuery(expensesQuery(monthRange(month)));
    const cards = useCreditCards();
    const active = cards.data ? activeCards(cards.data) : [];
    const statements = useQueries({
        queries: active.map((card) => monthStatementsQuery(card.id, month)),
    });

    const listQueries: UseQueryResult[] = [earnings, expenses, cards, ...statements];
    const list = groupState(listQueries);
    const rows =
        list.pending || list.error
            ? undefined
            : cashFlowRows({
                  month,
                  earnings: earnings.data ?? [],
                  expenses: expenses.data ?? [],
                  statements: active.map((card, index) => ({
                      card,
                      statements: statements[index]?.data ?? [],
                  })),
              });

    let content;
    if (list.error) {
        content = <EmptyState variant="erro" error={list.error} onRetry={list.retry} />;
    } else if (!rows) {
        content = <EntryListSkeleton />;
    } else {
        content = (
            <RowList
                rows={rows}
                situation={search.situacao}
                month={month}
                rowActions={rowActions}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6">
            <h1 className="text-titulo-1">Fluxo de caixa</h1>
            <MonthNavigation
                month={month}
                onGo={(n) =>
                    onSearchChange({ mes: addMonths(month, n), situacao: search.situacao })
                }
            />
            <Summary rows={rows} month={month} current={current} listQueries={listQueries} />
            <div className="md:max-w-xs">
                <SelectField
                    label="Situação"
                    placeholder="Todos"
                    value={search.situacao ?? ''}
                    onChange={(event) =>
                        onSearchChange({
                            mes: search.mes,
                            situacao:
                                event.target.value === ''
                                    ? undefined
                                    : (event.target.value as Situation),
                        })
                    }
                    options={SITUATIONS.map((value) => ({
                        value,
                        label: SITUATION_LABELS[value],
                    }))}
                />
            </div>
            {alerts}
            {content}
            {dialogs}
        </div>
    );
}
