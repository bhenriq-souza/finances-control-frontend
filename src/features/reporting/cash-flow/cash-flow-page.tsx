import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { useCallback, useEffect, useId, type ReactNode } from 'react';

import { useAccountLookup } from '@/api/queries/lookups';
import { useBankAccounts, useCreditCards } from '@/api/queries/reference';
import { addMonths, formatDate, formatMonth, monthOf, today, type IsoMonth } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton, Skeleton } from '@/ui/skeleton';
import { SelectField } from '@/ui/select-field';
import { StatusBadge } from '@/ui/status-badge';
import {
    bankTransferBadge,
    earningBadge,
    expenseBadge,
    statementBadge,
    type Badge,
} from '@/ui/status-labels';

import { activeCards, countLabel } from '../dashboard/dashboard-data';
import { asApiError } from '../dashboard/dashboard-queries';
import { AccountSelect, useAccountNotFound } from '../reports/parts';
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
import {
    monthEarningsQuery,
    monthExpensesQuery,
    monthStatementsQuery,
    monthTransfersQuery,
    overdueEarningsQuery,
    overdueExpensesQuery,
    scheduledTransfersQuery,
} from './queries';
import { cashFlowMonth, SITUATIONS, type CashFlowSearch, type Situation } from './search';

/** O menu de cada tipo de linha, que a rota compõe com as ações das outras features. */
export interface CashFlowRowActions {
    expense?: (expense: Expense) => ReactNode;
    earning?: (earning: Earning) => ReactNode;
    statement?: (statement: Statement) => ReactNode;
}

export interface CashFlowPageProps {
    search: CashFlowSearch;
    /**
     * Troca o mês ou os filtros; a rota mantém os demais parâmetros. Com `replace`, a troca não
     * cria uma entrada no histórico (o filtro de conta descartado).
     */
    onSearchChange: (
        next: Partial<Pick<CashFlowSearch, 'mes' | 'situacao' | 'conta'>>,
        options?: { replace?: boolean },
    ) => void;
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

/**
 * A nota das vencidas de meses anteriores, que o saldo previsto do mês corrente conta; com uma
 * conta escolhida, os links levam a conta e as transferências agendadas contam, sem link.
 */
function OverdueNote({
    expenses,
    earnings,
    transfers,
    account,
}: {
    expenses: number;
    earnings: number;
    transfers: number;
    account: string | undefined;
}) {
    const total = expenses + earnings + transfers;
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
                    search={{ status: 'OVERDUE', conta: account }}
                    className={clsx('inline-flex min-h-11 items-center', LINK_CLASS)}
                >
                    Ver despesas vencidas
                </Link>
            )}
            {earnings > 0 && (
                <Link
                    to="/receitas"
                    search={{ status: 'OVERDUE', conta: account }}
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
    account,
    listQueries,
    onAccountNotFound,
}: {
    rows: readonly CashFlowRow[] | undefined;
    month: IsoMonth;
    current: IsoMonth;
    account: AccountFilter;
    listQueries: readonly UseQueryResult[];
    onAccountNotFound: () => void;
}) {
    const ready = account.status !== 'pending';
    const bankAccountId = account.status === 'chosen' ? account.id : undefined;
    const balance = useQuery({
        ...balanceReportQuery(balanceWindow(month, current), bankAccountId),
        enabled: ready,
    });
    const isCurrent = month === current;
    const overdueExpenses = useQuery({
        ...overdueExpensesQuery(bankAccountId),
        enabled: ready && isCurrent,
    });
    const overdueEarnings = useQuery({
        ...overdueEarningsQuery(bankAccountId),
        enabled: ready && isCurrent,
    });
    const scheduledTransfers = useQuery({
        ...scheduledTransfersQuery(bankAccountId ?? ''),
        enabled: bankAccountId !== undefined && isCurrent,
    });
    // `404 BANK_ACCOUNT_NOT_FOUND`: o aviso e o filtro de conta sai (spec 0015, "Mapa de erros").
    const notFound = useAccountNotFound(
        bankAccountId === undefined ? null : balance.error,
        onAccountNotFound,
    );
    const state = groupState([balance, ...listQueries]);
    const overdueTransfers = bankAccountId === undefined ? [] : scheduledTransfers.data;

    let content;
    if (state.error && !notFound) {
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
            {isCurrent && overdueExpenses.data && overdueEarnings.data && overdueTransfers && (
                <OverdueNote
                    {...overdueBefore(
                        month,
                        overdueExpenses.data,
                        overdueEarnings.data,
                        overdueTransfers,
                    )}
                    account={bankAccountId}
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
        case 'transfer':
            return bankTransferBadge(row.transfer);
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
        case 'transfer':
            return `/transferencias/${row.transfer.id}`;
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
        // A transferência não tem menu (spec 0015).
        case 'transfer':
            return null;
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
            case 'transfer':
                return {
                    title: row.transfer.description,
                    support: `${accounts.label(row.transfer.fromBankAccountId)} → ${accounts.label(row.transfer.toBankAccountId)}`,
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
 * O filtro de conta (`?conta=`, revisão de 2026-10-14): todas as contas, a conta escolhida ou
 * pendente, enquanto `GET /bank-accounts` carrega ou o id desconhecido sai da URL. Pendente, as
 * consultas esperam, para não pedir os números de todas as contas no lugar dos da escolhida.
 */
type AccountFilter = { status: 'all' } | { status: 'pending' } | { status: 'chosen'; id: string };

function useAccountFilter(
    conta: string | undefined,
    onDiscard: () => void,
): { filter: AccountFilter; query: UseQueryResult } {
    const accounts = useBankAccounts();
    const unknown =
        conta !== undefined &&
        accounts.data !== undefined &&
        !accounts.data.some((account) => account.id === conta);
    // Id que não está em `GET /bank-accounts` é descartado.
    useEffect(() => {
        if (unknown) onDiscard();
    }, [unknown, onDiscard]);

    let filter: AccountFilter;
    if (conta === undefined) filter = { status: 'all' };
    else if (accounts.data === undefined || unknown) filter = { status: 'pending' };
    else filter = { status: 'chosen', id: conta };
    return { filter, query: accounts };
}

/**
 * Fluxo de caixa do mês (`/fluxo-de-caixa`, spec 0015): o resumo (saldos, entradas e saídas) e a
 * lista de receitas, despesas de conta e faturas com data no mês, com os filtros de situação e
 * de conta; com uma conta escolhida, só os números dela, transferências inclusive (INV-0015-08).
 * As ações das linhas vêm da rota, que as compõe com `expenses`, `earnings` e `statements`: este
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
    const dropAccount = useCallback(
        () => onSearchChange({ conta: undefined }, { replace: true }),
        [onSearchChange],
    );
    const account = useAccountFilter(search.conta, dropAccount);
    const ready = account.filter.status !== 'pending';
    const bankAccountId = account.filter.status === 'chosen' ? account.filter.id : undefined;

    const earnings = useQuery({ ...monthEarningsQuery(month, bankAccountId), enabled: ready });
    const expenses = useQuery({ ...monthExpensesQuery(month, bankAccountId), enabled: ready });
    const transfers = useQuery({
        ...monthTransfersQuery(bankAccountId ?? '', month),
        enabled: bankAccountId !== undefined,
    });
    const cards = useCreditCards();
    // Com uma conta escolhida, só os cartões que ela paga.
    const active = cards.data
        ? activeCards(cards.data).filter(
              (card) => bankAccountId === undefined || card.paymentBankAccountId === bankAccountId,
          )
        : [];
    const statements = useQueries({
        queries: active.map((card) => ({
            ...monthStatementsQuery(card.id, month),
            enabled: ready,
        })),
    });

    const listQueries: UseQueryResult[] = [
        ...(search.conta === undefined ? [] : [account.query]),
        earnings,
        expenses,
        ...(bankAccountId === undefined ? [] : [transfers]),
        cards,
        ...statements,
    ];
    const list = groupState(listQueries);
    const rows =
        list.pending || list.error
            ? undefined
            : cashFlowRows({
                  month,
                  today: today(),
                  account: bankAccountId,
                  earnings: earnings.data ?? [],
                  expenses: expenses.data ?? [],
                  transfers: bankAccountId === undefined ? [] : (transfers.data ?? []),
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
                    onSearchChange({
                        mes: addMonths(month, n),
                        situacao: search.situacao,
                        conta: search.conta,
                    })
                }
            />
            <Summary
                rows={rows}
                month={month}
                current={current}
                account={account.filter}
                listQueries={listQueries}
                onAccountNotFound={dropAccount}
            />
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="md:w-72">
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
                                conta: search.conta,
                            })
                        }
                        options={SITUATIONS.map((value) => ({
                            value,
                            label: SITUATION_LABELS[value],
                        }))}
                    />
                </div>
                <AccountSelect
                    value={search.conta}
                    onChange={(conta) =>
                        onSearchChange({ mes: search.mes, situacao: search.situacao, conta })
                    }
                />
            </div>
            {alerts}
            {content}
            {dialogs}
        </div>
    );
}
