import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { formatMonth } from '@/shared/dates';
import { BarList, type BarListItem } from '@/ui/charts/bar-list';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';

import { CardRow, ChartWithTable, ReportState, SegmentedControl } from './parts';
import type { Period } from './period';
import { byTypeReportQuery, type ByTypeKind, type ByTypeMonth, type ByTypeReport } from './queries';

const KINDS = [
    { value: 'expenses', label: 'Despesas' },
    { value: 'earnings', label: 'Receitas' },
] as const;

export const REFUNDS_LABEL = 'Estornos de cartão';

/**
 * Os tipos do período, somados mês a mês (só soma, INV-0015-02), por total decrescente e nome,
 * como a API ordena `byType`.
 */
export function totalsByType(report: ByTypeReport): BarListItem[] {
    const totals = new Map<string, BarListItem>();
    for (const month of report.months) {
        for (const type of month.byType) {
            const current = totals.get(type.typeId);
            totals.set(type.typeId, {
                key: type.typeId,
                label: type.name,
                cents: (current?.cents ?? 0) + type.totalCents,
            });
        }
    }
    return [...totals.values()].sort(
        (a, b) => b.cents - a.cents || a.label.localeCompare(b.label, 'pt-BR'),
    );
}

/** Soma dos estornos de cartão do período (só em despesas). */
export function totalRefunds(report: ByTypeReport): number {
    return report.months.reduce((sum, month) => sum + (month.refundsCents ?? 0), 0);
}

function typeCents(month: ByTypeMonth, typeId: string): number {
    return month.byType.find((type) => type.typeId === typeId)?.totalCents ?? 0;
}

function ByTypeContent({ kind, report }: { kind: ByTypeKind; report: ByTypeReport }) {
    const types = totalsByType(report);
    const refunds = kind === 'expenses' ? totalRefunds(report) : 0;
    const noun = kind === 'expenses' ? 'despesa' : 'receita';
    if (types.length === 0 && refunds === 0) {
        return (
            <EmptyState
                variant="vazio"
                title={`Nenhuma ${noun} no período.`}
                description="Escolha outro período ou inclua os previstos."
            />
        );
    }

    const title = kind === 'expenses' ? 'Despesas por tipo' : 'Receitas por tipo';
    const columns: EntryColumn<ByTypeMonth>[] = [
        { header: 'Mês', cell: (month) => formatMonth(month.month) },
        ...types.map((type): EntryColumn<ByTypeMonth> => ({
            header: type.label,
            align: 'end',
            cell: (month) => <Money cents={typeCents(month, type.key)} />,
        })),
        {
            header: 'Total do mês',
            align: 'end',
            cell: (month) => <Money cents={month.totalCents} />,
        },
    ];
    if (kind === 'expenses') {
        columns.push({
            header: REFUNDS_LABEL,
            align: 'end',
            cell: (month) => <Money cents={month.refundsCents ?? 0} />,
        });
    }

    return (
        <ChartWithTable
            title={title}
            chart={
                <div className="flex flex-col gap-4">
                    <BarList label={title} items={types} />
                    {kind === 'expenses' && (
                        <div
                            data-slot="refunds"
                            className="flex flex-col gap-1 border-t border-linha pt-3"
                        >
                            <dl className="flex items-baseline justify-between gap-3">
                                <dt className="text-corpo text-texto">{REFUNDS_LABEL}</dt>
                                <dd>
                                    <Money cents={refunds} size="valor-pequeno" />
                                </dd>
                            </dl>
                            <p className="text-pequeno text-texto-apoio">
                                À parte: não abatem os tipos.
                            </p>
                        </div>
                    )}
                </div>
            }
            table={
                <EntryList
                    items={report.months}
                    getKey={(month) => month.month}
                    caption={`${title} por mês`}
                    columns={columns}
                    empty={null}
                    renderCard={(month) => (
                        <div className="flex flex-col gap-2">
                            <span className="text-corpo-forte">{formatMonth(month.month)}</span>
                            <dl className="flex flex-col gap-1">
                                {month.byType.map((type) => (
                                    <CardRow key={type.typeId} label={type.name}>
                                        <Money cents={type.totalCents} />
                                    </CardRow>
                                ))}
                                <CardRow label="Total do mês">
                                    <Money cents={month.totalCents} />
                                </CardRow>
                            </dl>
                            {kind === 'expenses' && (
                                <dl className="border-t border-linha pt-2">
                                    <CardRow label={REFUNDS_LABEL}>
                                        <Money cents={month.refundsCents ?? 0} />
                                    </CardRow>
                                </dl>
                            )}
                        </div>
                    )}
                />
            }
        />
    );
}

/**
 * Aba **Por tipo** (spec 0015): despesas ou receitas por tipo, com **Incluir previstos**
 * (`includeForecast=true`); em despesas, os estornos de cartão à parte, sem abater o tipo.
 */
export function ByTypeTab({ period }: { period: Period }) {
    const [kind, setKind] = useState<ByTypeKind>('expenses');
    const [includeForecast, setIncludeForecast] = useState(false);
    const query = useQuery(byTypeReportQuery(kind, period, includeForecast));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
                <SegmentedControl
                    label="Lançamentos"
                    segments={KINDS}
                    value={kind}
                    onChange={setKind}
                />
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-corpo text-texto">
                    <input
                        type="checkbox"
                        checked={includeForecast}
                        onChange={(event) => setIncludeForecast(event.target.checked)}
                        className="size-5 accent-acento"
                    />
                    Incluir previstos
                </label>
            </div>
            <ReportState query={query}>
                {(report) => <ByTypeContent kind={kind} report={report} />}
            </ReportState>
        </div>
    );
}
