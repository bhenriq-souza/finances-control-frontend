import { createFileRoute } from '@tanstack/react-router';
import { useId, useRef, type KeyboardEvent } from 'react';
import { z } from 'zod';

import { EarningRecurrences } from '@/features/earnings';
import { ExpenseRecurrences } from '@/features/expenses';

/** `/series`: `aba` (`despesas` | `receitas`) e `encerradas` (spec 0017, "Rotas e navegação"). */
const seriesSearchSchema = z.object({
    aba: z.enum(['despesas', 'receitas']).optional().catch(undefined),
    encerradas: z.literal(1).optional().catch(undefined),
});

type SeriesSearch = z.infer<typeof seriesSearchSchema>;
type Tab = NonNullable<SeriesSearch['aba']>;

const TABS: readonly { value: Tab; label: string }[] = [
    { value: 'despesas', label: 'Despesas' },
    { value: 'receitas', label: 'Receitas' },
];

/** Séries fixas de despesas e de receitas, em abas; cada aba vem da sua feature (spec 0017). */
export const Route = createFileRoute('/_app/series/')({
    validateSearch: seriesSearchSchema,
    component: SeriesRoute,
});

function SeriesRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const id = useId();
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const active: Tab = search.aba ?? 'despesas';
    const showEnded = search.encerradas === 1;

    const change = (next: Partial<SeriesSearch>) =>
        void navigate({ search: (prev) => ({ ...prev, ...next }) });

    // Setas trocam de aba e movem o foco (padrão de abas da WAI-ARIA).
    function onKeyDown(event: KeyboardEvent, index: number) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next = (index + step + TABS.length) % TABS.length;
        change({ aba: TABS[next]!.value });
        tabs.current[next]?.focus();
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-titulo-1">Séries fixas</h1>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div
                    role="tablist"
                    aria-label="Séries"
                    className="flex gap-1 border-b border-linha"
                >
                    {TABS.map((tab, index) => {
                        const selected = tab.value === active;
                        return (
                            <button
                                key={tab.value}
                                ref={(element) => {
                                    tabs.current[index] = element;
                                }}
                                type="button"
                                role="tab"
                                id={`${id}-${tab.value}`}
                                aria-selected={selected}
                                aria-controls={`${id}-painel`}
                                tabIndex={selected ? 0 : -1}
                                onClick={() => change({ aba: tab.value })}
                                onKeyDown={(event) => onKeyDown(event, index)}
                                className={`-mb-px min-h-11 border-b-2 px-4 text-corpo-forte outline-none focus-visible:ring-2 focus-visible:ring-foco ${
                                    selected
                                        ? 'border-acento text-texto'
                                        : 'border-transparent text-texto-apoio hover:text-texto'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        id={`${id}-encerradas`}
                        type="checkbox"
                        checked={showEnded}
                        onChange={(event) =>
                            change({ encerradas: event.target.checked ? 1 : undefined })
                        }
                        className="size-5 accent-acento"
                    />
                    <label htmlFor={`${id}-encerradas`} className="text-corpo text-texto">
                        Mostrar encerradas
                    </label>
                </div>
            </div>

            <div role="tabpanel" id={`${id}-painel`} aria-labelledby={`${id}-${active}`}>
                {active === 'despesas' ? (
                    <ExpenseRecurrences showEnded={showEnded} />
                ) : (
                    <EarningRecurrences showEnded={showEnded} />
                )}
            </div>
        </div>
    );
}
