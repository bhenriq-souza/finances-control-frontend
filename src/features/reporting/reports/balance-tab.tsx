import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { formatMonth } from '@/shared/dates';
import { MonthColumns } from '@/ui/charts/month-columns';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';

import {
    AccountSelect,
    CardRow,
    ChartWithTable,
    ReportState,
    SegmentedControl,
    useAccountNotFound,
} from './parts';
import type { Period } from './period';
import { balanceReportQuery, type BalancePoint } from './queries';

type Series = 'contas' | 'consolidado';

const SERIES = [
    { value: 'contas', label: 'Contas' },
    { value: 'consolidado', label: 'Contas menos cartões' },
] as const;

export const KIND_LABELS = { REALIZED: 'Realizado', FORECAST: 'Previsto' } as const;

/** Valor opcional da API: nulo ou ausente vira "—". */
function OptionalMoney({ cents }: { cents: number | null | undefined }) {
    return cents === null || cents === undefined ? <span>—</span> : <Money cents={cents} />;
}

interface Row {
    point: BalancePoint;
    /** O valor da coluna do gráfico, o mesmo da tabela (INV-0015-03). */
    charted: number;
}

function columnsFor(byAccount: boolean): EntryColumn<Row>[] {
    const month: EntryColumn<Row> = {
        header: 'Mês',
        cell: ({ point }) => formatMonth(point.month),
    };
    const kind: EntryColumn<Row> = {
        header: 'Situação',
        cell: ({ point }) => KIND_LABELS[point.kind],
    };
    if (byAccount) {
        const account = (row: Row) => row.point.accounts[0];
        return [
            month,
            kind,
            {
                header: 'Saldo',
                align: 'end',
                cell: (row) => <Money cents={row.point.accountsTotalCents} />,
            },
            {
                header: 'Dívida de cartões',
                align: 'end',
                cell: (row) => <OptionalMoney cents={account(row)?.cardDebtCents} />,
            },
            {
                header: 'Saldo após cartões',
                align: 'end',
                cell: (row) => <OptionalMoney cents={account(row)?.balanceAfterCardsCents} />,
            },
        ];
    }
    return [
        month,
        kind,
        {
            header: 'Contas',
            align: 'end',
            cell: (row) => <Money cents={row.point.accountsTotalCents} />,
        },
        {
            header: 'Dívida de cartões',
            align: 'end',
            cell: (row) => <OptionalMoney cents={row.point.cardDebtCents} />,
        },
        {
            header: 'Consolidado',
            align: 'end',
            cell: (row) => <OptionalMoney cents={row.point.consolidatedCents} />,
        },
    ];
}

/**
 * Aba **Saldo** (spec 0015): `GET /reports/balance`, as colunas por mês (realizadas e previstas)
 * de "Contas" ou "Contas menos cartões" e a tabela com os mesmos valores; com uma conta, os
 * números dela.
 */
export function BalanceTab({
    period,
    account,
    onAccountChange,
}: {
    period: Period;
    account: string | undefined;
    onAccountChange: (bankAccountId: string | undefined) => void;
}) {
    const [series, setSeries] = useState<Series>('contas');
    const query = useQuery(balanceReportQuery(period, account));
    const notFound = useAccountNotFound(query.error, onAccountChange);
    const consolidated = !account && series === 'consolidado';

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <AccountSelect value={account} onChange={onAccountChange} />
                {!account && (
                    <SegmentedControl
                        label="Série do gráfico"
                        segments={SERIES}
                        value={series}
                        onChange={setSeries}
                    />
                )}
            </div>
            <ReportState query={query} pending={notFound}>
                {(report) => {
                    const rows: Row[] = report.points.map((point) => ({
                        point,
                        charted: consolidated
                            ? (point.consolidatedCents ?? point.accountsTotalCents)
                            : point.accountsTotalCents,
                    }));
                    const columns = columnsFor(Boolean(account));
                    return (
                        <ChartWithTable
                            title={
                                consolidated
                                    ? 'Saldo consolidado por mês'
                                    : 'Saldo das contas por mês'
                            }
                            chart={
                                <MonthColumns
                                    columns={rows.map(({ point, charted }) => ({
                                        month: point.month,
                                        cents: charted,
                                        forecast: point.kind === 'FORECAST',
                                    }))}
                                />
                            }
                            table={
                                <EntryList
                                    items={rows}
                                    getKey={({ point }) => point.month}
                                    caption="Saldo por mês"
                                    columns={columns}
                                    empty={null}
                                    renderCard={(row) => (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-corpo-forte">
                                                    {formatMonth(row.point.month)}
                                                </span>
                                                <span className="text-pequeno text-texto-apoio">
                                                    {KIND_LABELS[row.point.kind]}
                                                </span>
                                            </div>
                                            <dl className="flex flex-col gap-1">
                                                {columns.slice(2).map((column) => (
                                                    <CardRow
                                                        key={column.header}
                                                        label={column.header}
                                                    >
                                                        {column.cell(row)}
                                                    </CardRow>
                                                ))}
                                            </dl>
                                        </div>
                                    )}
                                />
                            }
                        />
                    );
                }}
            </ReportState>
        </div>
    );
}
