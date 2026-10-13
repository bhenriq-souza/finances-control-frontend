import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useId, type ReactNode } from 'react';

import { useBankAccounts } from '@/api/queries/reference';
import { formatDate, formatMonth, monthRange, type IsoMonth } from '@/shared/dates';
import { Money } from '@/ui/money';
import { Skeleton } from '@/ui/skeleton';

import {
    countLabel,
    forecastBalance,
    realizedBalance,
    summarizeEarnings,
    summarizeExpenses,
} from './dashboard-data';
import { balanceReportQuery, expensesQuery, monthEarningsQuery } from './dashboard-queries';
import { PANEL, QueryContent } from './section';

/** Um cartão de número do topo do dashboard: `section` nomeada pelo rótulo. */
function SummaryCard({
    title,
    className,
    children,
}: {
    title: string;
    className?: string;
    children: ReactNode;
}) {
    const id = useId();
    return (
        <section
            aria-labelledby={id}
            className={clsx(PANEL, 'flex min-w-0 flex-col gap-2', className)}
        >
            <h2 id={id} className="text-rotulo text-texto-apoio uppercase">
                {title}
            </h2>
            {children}
        </section>
    );
}

const valueSkeleton = (
    <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
    </div>
);

/** "Previsto para 31 out.": o saldo do ponto `FORECAST` e a variação sobre o realizado. */
function Forecast({ month, realized }: { month: IsoMonth; realized: number | undefined }) {
    const query = useQuery(balanceReportQuery(month));
    const lastDay = formatDate(monthRange(month).to, 'curta');
    return (
        <div className="flex flex-col gap-1 border-t border-linha pt-3">
            <QueryContent query={query} skeleton={<Skeleton className="h-5 w-2/3" />}>
                {(report) => {
                    const forecast = forecastBalance(report, month);
                    return (
                        <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <dt className="text-pequeno text-texto-apoio">
                                Previsto para {lastDay}
                            </dt>
                            <dd className="flex items-baseline gap-2">
                                {forecast === null ? (
                                    <span className="text-corpo text-texto-apoio">—</span>
                                ) : (
                                    <>
                                        <Money cents={forecast} size="valor" />
                                        {realized !== undefined && (
                                            <Money
                                                cents={forecast - realized}
                                                sign="always"
                                                tone="auto"
                                                size="valor-pequeno"
                                            />
                                        )}
                                    </>
                                )}
                            </dd>
                        </dl>
                    );
                }}
            </QueryContent>
        </div>
    );
}

/** Saldo realizado (contas ativas) e, abaixo, o previsto do mês. */
function RealizedCard({ month, className }: { month: IsoMonth; className?: string }) {
    const accounts = useBankAccounts();
    const realized = accounts.data ? realizedBalance(accounts.data) : undefined;
    return (
        <SummaryCard title={`Saldo realizado · ${formatMonth(month)}`} className={className}>
            <QueryContent query={accounts} skeleton={<Skeleton className="h-9 w-2/3" />}>
                {(data) => <Money cents={realizedBalance(data)} size="valor-destaque" />}
            </QueryContent>
            <Forecast month={month} realized={realized} />
        </SummaryCard>
    );
}

/** Receitas do mês: o total com `+` e "n recebidas · n pendentes". */
function EarningsCard({ month }: { month: IsoMonth }) {
    const query = useQuery(monthEarningsQuery(month));
    return (
        <SummaryCard title="Receitas do mês">
            <QueryContent query={query} skeleton={valueSkeleton}>
                {(earnings) => {
                    const summary = summarizeEarnings(earnings);
                    return (
                        <>
                            <Money cents={summary.totalCents} sign="always" tone="auto" />
                            <p className="text-pequeno text-texto-apoio">
                                {countLabel(summary.received, 'recebida', 'recebidas')} ·{' '}
                                {countLabel(summary.pending, 'pendente', 'pendentes')}
                            </p>
                        </>
                    );
                }}
            </QueryContent>
        </SummaryCard>
    );
}

/** Despesas do mês: o total com `−` e "n pagas · n pendentes · n vencidas". */
function ExpensesCard({ month }: { month: IsoMonth }) {
    const query = useQuery(expensesQuery(monthRange(month)));
    return (
        <SummaryCard title="Despesas do mês">
            <QueryContent query={query} skeleton={valueSkeleton}>
                {(expenses) => {
                    const summary = summarizeExpenses(expenses);
                    return (
                        <>
                            <Money cents={-summary.totalCents} sign="always" tone="auto" />
                            <p className="text-pequeno text-texto-apoio">
                                {countLabel(summary.paid, 'paga', 'pagas')} ·{' '}
                                {countLabel(summary.pending, 'pendente', 'pendentes')} ·{' '}
                                {countLabel(summary.overdue, 'vencida', 'vencidas')}
                            </p>
                        </>
                    );
                }}
            </QueryContent>
        </SummaryCard>
    );
}

/**
 * O topo do dashboard: saldo realizado com o previsto, receitas e despesas do mês. Celular: o
 * saldo em toda a largura e os dois totais lado a lado; tablet e desktop: três colunas.
 */
export function BalanceCards({ month, className }: { month: IsoMonth; className?: string }) {
    return (
        <div className={clsx('grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4', className)}>
            <RealizedCard month={month} className="col-span-2 md:col-span-1" />
            <EarningsCard month={month} />
            <ExpensesCard month={month} />
        </div>
    );
}
