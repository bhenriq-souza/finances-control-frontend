import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import { Fragment, useState } from 'react';

import { useAccountLookup } from '@/api/queries/lookups';
import { formatMonth } from '@/shared/dates';
import { MonthColumns } from '@/ui/charts/month-columns';
import { Money } from '@/ui/money';

import { AccountSelect, CardRow, ChartWithTable, ReportState, useAccountNotFound } from './parts';
import type { Period } from './period';
import {
    cashFlowReportQuery,
    type CashFlowAccount,
    type CashFlowMonth,
    type CashFlowReport,
} from './queries';

type Amounts = Omit<CashFlowAccount, 'bankAccountId'>;

const FIELDS = [
    { key: 'inflowsCents', label: 'Entradas' },
    { key: 'expensesPaidCents', label: 'Despesas pagas' },
    { key: 'statementPaymentsCents', label: 'Faturas pagas' },
    { key: 'transfersInCents', label: 'Transferências que entram' },
    { key: 'transfersOutCents', label: 'Transferências que saem' },
] as const satisfies readonly { key: keyof Amounts; label: string }[];

export const NET_LABEL = 'Líquido';

/**
 * Os totais do mês: cada coluna somada entre as contas (só soma, INV-0015-02); o líquido é o
 * `netCents` do mês, como a API o entrega.
 */
export function monthTotals(month: CashFlowMonth): Amounts {
    const totals: Amounts = {
        inflowsCents: 0,
        expensesPaidCents: 0,
        statementPaymentsCents: 0,
        transfersInCents: 0,
        transfersOutCents: 0,
        netCents: month.netCents,
    };
    for (const account of month.accounts) {
        for (const { key } of FIELDS) totals[key] += account[key];
    }
    return totals;
}

const Net = ({ cents }: { cents: number }) => <Money cents={cents} sign="always" tone="auto" />;

const CELL = 'px-4 py-3 text-end';

function CashFlowTable({ report }: { report: CashFlowReport }) {
    const accounts = useAccountLookup();
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const toggle = (month: string) =>
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(month)) next.delete(month);
            else next.add(month);
            return next;
        });

    return (
        <>
            <ul aria-label="Fluxo de caixa por mês" className="flex flex-col gap-3 md:hidden">
                {report.months.map((month) => {
                    const totals = monthTotals(month);
                    const open = expanded.has(month.month);
                    const label = formatMonth(month.month);
                    return (
                        <li
                            key={month.month}
                            className="flex flex-col gap-2 rounded-md border border-linha bg-superficie p-4 text-texto"
                        >
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-corpo-forte">{label}</span>
                                <Net cents={totals.netCents} />
                            </div>
                            <dl className="flex flex-col gap-1">
                                {FIELDS.map((field) => (
                                    <CardRow key={field.key} label={field.label}>
                                        <Money cents={totals[field.key]} />
                                    </CardRow>
                                ))}
                            </dl>
                            <button
                                type="button"
                                aria-expanded={open}
                                aria-label={`Por conta em ${label}`}
                                onClick={() => toggle(month.month)}
                                className="flex min-h-11 items-center gap-2 self-start rounded-md text-corpo-forte text-acento outline-none focus-visible:ring-2 focus-visible:ring-foco"
                            >
                                Por conta
                                <ChevronDown
                                    aria-hidden="true"
                                    className={clsx('size-4', open && 'rotate-180')}
                                />
                            </button>
                            {open && (
                                <ul className="flex flex-col gap-2 border-t border-linha pt-2">
                                    {month.accounts.map((account) => (
                                        <li
                                            key={account.bankAccountId}
                                            className="flex flex-col gap-1"
                                        >
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span>{accounts.label(account.bankAccountId)}</span>
                                                <Net cents={account.netCents} />
                                            </div>
                                            <dl className="flex flex-col gap-1">
                                                {FIELDS.map((field) => (
                                                    <CardRow key={field.key} label={field.label}>
                                                        <Money cents={account[field.key]} />
                                                    </CardRow>
                                                ))}
                                            </dl>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
            <table className="hidden w-full border-collapse overflow-hidden rounded-md border border-linha bg-superficie text-corpo text-texto md:table">
                <caption className="sr-only">Fluxo de caixa por mês</caption>
                <thead className="bg-superficie-elevada">
                    <tr>
                        <th
                            scope="col"
                            className="px-4 py-3 text-start text-rotulo text-texto-apoio"
                        >
                            Mês
                        </th>
                        {[...FIELDS.map((field) => field.label), NET_LABEL].map((label) => (
                            <th
                                key={label}
                                scope="col"
                                className="px-4 py-3 text-end text-rotulo text-texto-apoio"
                            >
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {report.months.map((month) => {
                        const totals = monthTotals(month);
                        const open = expanded.has(month.month);
                        return (
                            <Fragment key={month.month}>
                                <tr className="border-t border-linha">
                                    <th scope="row" className="px-4 py-3 text-start text-corpo">
                                        <button
                                            type="button"
                                            aria-expanded={open}
                                            onClick={() => toggle(month.month)}
                                            className="flex min-h-11 items-center gap-2 rounded-sm text-start outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco"
                                        >
                                            <ChevronDown
                                                aria-hidden="true"
                                                className={clsx(
                                                    'size-4 shrink-0 text-texto-apoio',
                                                    !open && '-rotate-90',
                                                )}
                                            />
                                            {formatMonth(month.month)}
                                        </button>
                                    </th>
                                    {FIELDS.map((field) => (
                                        <td key={field.key} className={CELL}>
                                            <Money cents={totals[field.key]} />
                                        </td>
                                    ))}
                                    <td className={CELL}>
                                        <Net cents={totals.netCents} />
                                    </td>
                                </tr>
                                {open &&
                                    month.accounts.map((account) => (
                                        <tr
                                            key={account.bankAccountId}
                                            data-account={account.bankAccountId}
                                            className="border-t border-linha bg-superficie-elevada"
                                        >
                                            <td className="py-3 pr-4 pl-10 text-start text-texto-apoio">
                                                {accounts.label(account.bankAccountId)}
                                            </td>
                                            {FIELDS.map((field) => (
                                                <td key={field.key} className={CELL}>
                                                    <Money cents={account[field.key]} />
                                                </td>
                                            ))}
                                            <td className={CELL}>
                                                <Net cents={account.netCents} />
                                            </td>
                                        </tr>
                                    ))}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </>
    );
}

/**
 * Aba **Fluxo de caixa** (spec 0015): `GET /reports/cash-flow`, o líquido por mês em colunas (o
 * negativo abaixo do eixo) e a tabela com entradas, despesas pagas, faturas pagas, transferências
 * e o líquido; o detalhe por conta ao expandir o mês.
 */
export function CashFlowTab({
    period,
    account,
    onAccountChange,
}: {
    period: Period;
    account: string | undefined;
    onAccountChange: (bankAccountId: string | undefined) => void;
}) {
    const query = useQuery(cashFlowReportQuery(period, account));
    const notFound = useAccountNotFound(query.error, onAccountChange);

    return (
        <div className="flex flex-col gap-4">
            <AccountSelect value={account} onChange={onAccountChange} />
            <ReportState query={query} pending={notFound}>
                {(report) => (
                    <ChartWithTable
                        title="Líquido por mês"
                        chart={
                            <MonthColumns
                                columns={report.months.map((month) => ({
                                    month: month.month,
                                    cents: month.netCents,
                                }))}
                            />
                        }
                        table={<CashFlowTable report={report} />}
                    />
                )}
            </ReportState>
        </div>
    );
}
