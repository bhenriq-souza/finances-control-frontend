import { clsx } from 'clsx';
import { useRef, useState, type KeyboardEvent } from 'react';

import { BalanceTab } from './balance-tab';
import { ByTypeTab } from './by-type-tab';
import { CashFlowTab } from './cash-flow-tab';
import { PeriodFields } from './parts';
import { REPORT_TABS, resolvePeriod, type Period, type ReportTab } from './period';
import type { ReportsSearch } from './search';

export interface ReportsPageProps {
    search: ReportsSearch;
    /** Troca os parâmetros de busca da rota (aba e período). */
    onSearchChange: (search: ReportsSearch) => void;
}

const TAB_LABELS: Record<ReportTab, string> = {
    saldo: 'Saldo',
    'por-tipo': 'Por tipo',
    fluxo: 'Fluxo de caixa',
};

const PANEL_ID = 'relatorio-painel';
const tabId = (tab: ReportTab) => `relatorio-aba-${tab}`;

/** Abas com `role="tablist"`; as setas e Home/End movem entre elas (padrão de abas do WAI-ARIA). */
function ReportTabs({
    active,
    onChange,
}: {
    active: ReportTab;
    onChange: (tab: ReportTab) => void;
}) {
    const refs = useRef<Partial<Record<ReportTab, HTMLButtonElement | null>>>({});

    const onKeyDown = (event: KeyboardEvent) => {
        const index = REPORT_TABS.indexOf(active);
        const last = REPORT_TABS.length - 1;
        const target = {
            ArrowRight: index === last ? 0 : index + 1,
            ArrowLeft: index === 0 ? last : index - 1,
            Home: 0,
            End: last,
        }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        const tab = REPORT_TABS[target]!;
        onChange(tab);
        refs.current[tab]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label="Relatórios"
            onKeyDown={onKeyDown}
            className="flex gap-1 overflow-x-auto border-b border-linha"
        >
            {REPORT_TABS.map((tab) => {
                const selected = tab === active;
                return (
                    <button
                        key={tab}
                        ref={(element) => {
                            refs.current[tab] = element;
                        }}
                        id={tabId(tab)}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={PANEL_ID}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(tab)}
                        className={clsx(
                            '-mb-px min-h-11 border-b-2 px-4 text-corpo-forte whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-foco',
                            selected
                                ? 'border-acento text-texto'
                                : 'border-transparent text-texto-apoio hover:text-texto',
                        )}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * `/relatorios` (spec 0015): abas na URL (`?aba=saldo|por-tipo|fluxo`), o período `de`/`ate`
 * validado antes de ir à API e, em cada aba, o gráfico com a tabela dos mesmos números.
 */
export function ReportsPage({ search, onSearchChange }: ReportsPageProps) {
    const tab = search.aba ?? 'saldo';
    const period = resolvePeriod(tab, search);
    // O filtro de conta vale para as abas de saldo e de fluxo de caixa.
    const [account, setAccount] = useState<string>();

    const changePeriod = (next: Period) =>
        onSearchChange({ ...search, aba: tab, de: next.from, ate: next.to });

    return (
        <div className="flex flex-col gap-4 md:gap-6">
            <h1 className="text-titulo-1">Relatórios</h1>
            <ReportTabs active={tab} onChange={(aba) => onSearchChange({ aba })} />
            <div
                role="tabpanel"
                id={PANEL_ID}
                aria-labelledby={tabId(tab)}
                className="flex flex-col gap-4"
            >
                <PeriodFields
                    key={`${tab}:${period.from}:${period.to}`}
                    period={period}
                    onChange={changePeriod}
                />
                {tab === 'saldo' && (
                    <BalanceTab period={period} account={account} onAccountChange={setAccount} />
                )}
                {tab === 'por-tipo' && <ByTypeTab period={period} />}
                {tab === 'fluxo' && (
                    <CashFlowTab period={period} account={account} onAccountChange={setAccount} />
                )}
            </div>
        </div>
    );
}
