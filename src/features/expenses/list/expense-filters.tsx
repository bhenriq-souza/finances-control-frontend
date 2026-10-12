import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { useAccountLookup, useCardLookup } from '@/api/queries/lookups';
import { useBankAccounts, useCreditCards, useExpenseTypes } from '@/api/queries/reference';
import { Button } from '@/ui/components/ui/button';
import { FormDialog } from '@/ui/form-dialog';
import { SelectField, type SelectOption } from '@/ui/select-field';
import { EXPENSE_STATUS_BADGES } from '@/ui/status-labels';

import { FILTER_KEYS, type ExpenseListSearch, type FilterKey } from './expense-list-search';
import { EXPENSE_KIND_LABELS, EXPENSE_KINDS, EXPENSE_STATUSES } from './expense-model';

interface FiltersProps {
    search: ExpenseListSearch;
    onSearchChange: (next: ExpenseListSearch) => void;
}

const ALL = 'Todos';

/** Itens ativos e, se arquivado, o já escolhido — para que o select mostre o filtro da URL. */
function optionsOf<T extends { id: string; archivedAt: string | null }>(
    items: readonly T[] | undefined,
    selected: string | undefined,
    labelOf: (item: T) => string,
): SelectOption[] {
    return (items ?? [])
        .filter((item) => item.archivedAt === null || item.id === selected)
        .map((item) => ({ value: item.id, label: labelOf(item) }));
}

/** O select "Conta ou cartão" guarda `conta:<id>` ou `cartao:<id>`. */
function paymentValue(search: ExpenseListSearch): string {
    if (search.conta) return `conta:${search.conta}`;
    if (search.cartao) return `cartao:${search.cartao}`;
    return '';
}

function FilterFields({ search, onSearchChange }: FiltersProps) {
    const types = useExpenseTypes();
    const accounts = useBankAccounts();
    const cards = useCreditCards();

    const set = (patch: Partial<ExpenseListSearch>) => onSearchChange({ ...search, ...patch });
    const orUndefined = <T extends string>(value: string) =>
        value === '' ? undefined : (value as T);

    return (
        <>
            <SelectField
                label="Status"
                placeholder={ALL}
                value={search.status ?? ''}
                onChange={(event) => set({ status: orUndefined(event.target.value) })}
                options={EXPENSE_STATUSES.map((status) => ({
                    value: status,
                    label: EXPENSE_STATUS_BADGES[status].label,
                }))}
            />
            <SelectField
                label="Tipo"
                placeholder={ALL}
                value={search.tipo ?? ''}
                onChange={(event) => set({ tipo: orUndefined(event.target.value) })}
                options={optionsOf(types.data, search.tipo, (type) => type.name)}
            />
            <SelectField
                label="Conta ou cartão"
                placeholder={ALL}
                value={paymentValue(search)}
                onChange={(event) => {
                    const [kind, id] = event.target.value.split(':');
                    set({
                        conta: kind === 'conta' ? id : undefined,
                        cartao: kind === 'cartao' ? id : undefined,
                    });
                }}
                options={[
                    {
                        label: 'Contas',
                        options: optionsOf(accounts.data, search.conta, (a) => a.description).map(
                            (option) => ({ ...option, value: `conta:${option.value}` }),
                        ),
                    },
                    {
                        label: 'Cartões',
                        options: optionsOf(cards.data, search.cartao, (c) => c.name).map(
                            (option) => ({ ...option, value: `cartao:${option.value}` }),
                        ),
                    },
                ]}
            />
            <SelectField
                label="Natureza"
                placeholder={ALL}
                value={search.natureza ?? ''}
                onChange={(event) => set({ natureza: orUndefined(event.target.value) })}
                options={EXPENSE_KINDS.map((kind) => ({
                    value: kind,
                    label: EXPENSE_KIND_LABELS[kind],
                }))}
            />
        </>
    );
}

/** Rótulo da etiqueta de cada filtro ativo. */
function useFilterLabels(search: ExpenseListSearch): Partial<Record<FilterKey, string>> {
    const types = useExpenseTypes();
    const accounts = useAccountLookup();
    const cards = useCardLookup();
    const typeName = (id: string) =>
        types.data?.find((type) => type.id === id)?.name ?? (types.data ? 'Tipo removido' : '');
    return {
        status: search.status && EXPENSE_STATUS_BADGES[search.status].label,
        tipo: search.tipo && typeName(search.tipo),
        conta: search.conta && accounts.label(search.conta),
        cartao: search.cartao && cards.label(search.cartao),
        natureza: search.natureza && EXPENSE_KIND_LABELS[search.natureza],
        grupo: search.grupo && 'Parcelamento',
    };
}

/** Etiquetas removíveis dos filtros ativos (spec 0012, "Filtros"). */
export function FilterTags({ search, onSearchChange }: FiltersProps) {
    const labels = useFilterLabels(search);
    const active = FILTER_KEYS.filter((key) => search[key] !== undefined);
    if (active.length === 0) return null;
    return (
        <ul aria-label="Filtros ativos" className="flex flex-wrap gap-2">
            {active.map((key) => (
                <li key={key}>
                    <button
                        type="button"
                        aria-label={`Remover filtro ${labels[key] ?? ''}`}
                        onClick={() => onSearchChange({ ...search, [key]: undefined })}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-linha-forte bg-superficie-elevada px-3 text-pequeno text-texto outline-none hover:bg-superficie focus-visible:ring-2 focus-visible:ring-foco"
                    >
                        {labels[key]}
                        <X aria-hidden="true" className="size-4 text-texto-apoio" />
                    </button>
                </li>
            ))}
        </ul>
    );
}

/**
 * Painel **Filtros**: no celular, um botão que abre a folha com os selects; no tablet e no
 * desktop, uma linha de selects. Toda mudança vai para a URL na hora.
 */
export function ExpenseFilters({ search, onSearchChange }: FiltersProps) {
    const [open, setOpen] = useState(false);
    const count = FILTER_KEYS.filter((key) => key !== 'grupo' && search[key] !== undefined).length;
    return (
        <>
            <div className="md:hidden">
                <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
                    <SlidersHorizontal aria-hidden="true" />
                    {count > 0 ? `Filtros (${count})` : 'Filtros'}
                </Button>
                <FormDialog
                    open={open}
                    onOpenChange={setOpen}
                    title="Filtros"
                    footer={<Button onClick={() => setOpen(false)}>Ver despesas</Button>}
                >
                    <div className="flex flex-col gap-4">
                        <FilterFields search={search} onSearchChange={onSearchChange} />
                    </div>
                </FormDialog>
            </div>
            <section
                aria-label="Filtros"
                className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4"
            >
                {open ? null : <FilterFields search={search} onSearchChange={onSearchChange} />}
            </section>
        </>
    );
}
