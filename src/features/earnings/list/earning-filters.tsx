import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { useBankAccounts, useEarningTypes } from '@/api/queries/reference';
import { addMonths, formatMonth } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { FormDialog } from '@/ui/form-dialog';
import { SelectField, type SelectOption } from '@/ui/select-field';
import { EARNING_STATUS_BADGES } from '@/ui/status-labels';

import {
    EARNING_KIND_LABELS,
    EARNING_KINDS,
    EARNING_STATUSES,
    type EarningKind,
    type EarningStatus,
} from './earning-model';
import { listMonth, type EarningListSearch } from './earning-search';

type FilterKey = 'status' | 'tipo' | 'conta' | 'natureza';

interface FilterProps {
    search: EarningListSearch;
    onSearchChange: (search: EarningListSearch) => void;
}

const STATUS_OPTIONS: readonly SelectOption[] = EARNING_STATUSES.map((status) => ({
    value: status,
    label: EARNING_STATUS_BADGES[status].label,
}));

const KIND_OPTIONS: readonly SelectOption[] = EARNING_KINDS.map((kind) => ({
    value: kind,
    label: EARNING_KIND_LABELS[kind],
}));

const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label, 'pt-BR');

/** Opções de tipo e de conta: os ativos e, se o filtro aponta para um arquivado, ele também. */
function useReferenceOptions(search: EarningListSearch) {
    const types = useEarningTypes().data ?? [];
    const accounts = useBankAccounts().data ?? [];
    const typeOptions = types
        .filter((type) => type.archivedAt === null || type.id === search.tipo)
        .map((type) => ({ value: type.id, label: type.name }))
        .sort(byLabel);
    const accountOptions = accounts
        .filter((account) => account.archivedAt === null || account.id === search.conta)
        .map((account) => ({ value: account.id, label: account.description }))
        .sort(byLabel);
    return { typeOptions, accountOptions };
}

function labelOf(options: readonly SelectOption[], value: string | undefined): string {
    return options.find((option) => option.value === value)?.label ?? '';
}

/** Os quatro selects dos filtros; cada mudança vai direto para a URL. */
function FilterFields({ search, onSearchChange, idPrefix }: FilterProps & { idPrefix: string }) {
    const { typeOptions, accountOptions } = useReferenceOptions(search);
    const set = (key: FilterKey, value: string) =>
        onSearchChange({ ...search, [key]: value === '' ? undefined : value });

    return (
        <>
            <SelectField
                id={`${idPrefix}-status`}
                label="Status"
                placeholder="Todos"
                options={STATUS_OPTIONS}
                value={search.status ?? ''}
                onChange={(event) => set('status', event.target.value as EarningStatus | '')}
            />
            <SelectField
                id={`${idPrefix}-tipo`}
                label="Tipo"
                placeholder="Todos"
                options={typeOptions}
                value={search.tipo ?? ''}
                onChange={(event) => set('tipo', event.target.value)}
            />
            <SelectField
                id={`${idPrefix}-conta`}
                label="Conta"
                placeholder="Todas"
                options={accountOptions}
                value={search.conta ?? ''}
                onChange={(event) => set('conta', event.target.value)}
            />
            <SelectField
                id={`${idPrefix}-natureza`}
                label="Natureza"
                placeholder="Todas"
                options={KIND_OPTIONS}
                value={search.natureza ?? ''}
                onChange={(event) => set('natureza', event.target.value as EarningKind | '')}
            />
        </>
    );
}

/** Navegação de mês: ‹ outubro de 2026 ›. */
export function MonthNavigation({ search, onSearchChange }: FilterProps) {
    const month = listMonth(search);
    const go = (n: number) => onSearchChange({ ...search, mes: addMonths(month, n) });
    return (
        <div className="flex items-center justify-between gap-2 md:justify-start">
            <Button variant="ghost" aria-label="Mês anterior" onClick={() => go(-1)}>
                <ChevronLeft aria-hidden="true" />
            </Button>
            <h2 className="min-w-44 text-center text-titulo-3">{formatMonth(month)}</h2>
            <Button variant="ghost" aria-label="Próximo mês" onClick={() => go(1)}>
                <ChevronRight aria-hidden="true" />
            </Button>
        </div>
    );
}

/**
 * Filtros da lista (spec 0012, "Filtros"): no celular, o botão **Filtros** abre uma folha; a
 * partir de `md`, uma linha de selects. Os filtros ativos aparecem como etiquetas removíveis.
 */
export function EarningFilters({ search, onSearchChange }: FilterProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const { typeOptions, accountOptions } = useReferenceOptions(search);

    const tags: { key: FilterKey | 'grupo'; label: string }[] = [];
    if (search.grupo) tags.push({ key: 'grupo', label: 'Parcelamento' });
    if (search.status) {
        tags.push({ key: 'status', label: EARNING_STATUS_BADGES[search.status].label });
    }
    if (search.tipo) tags.push({ key: 'tipo', label: labelOf(typeOptions, search.tipo) });
    if (search.conta) tags.push({ key: 'conta', label: labelOf(accountOptions, search.conta) });
    if (search.natureza) {
        tags.push({ key: 'natureza', label: EARNING_KIND_LABELS[search.natureza] });
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="md:hidden">
                <Button variant="outline" className="w-full" onClick={() => setSheetOpen(true)}>
                    <SlidersHorizontal aria-hidden="true" />
                    Filtros
                </Button>
            </div>
            <div
                role="group"
                aria-label="Filtros"
                className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4"
            >
                <FilterFields idPrefix="filtro" search={search} onSearchChange={onSearchChange} />
            </div>
            {tags.length > 0 && (
                <ul aria-label="Filtros ativos" className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <li key={tag.key}>
                            <button
                                type="button"
                                aria-label={`Remover filtro ${tag.label}`}
                                onClick={() => onSearchChange({ ...search, [tag.key]: undefined })}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-linha-forte bg-superficie-elevada px-3 text-pequeno text-texto outline-none hover:bg-superficie focus-visible:ring-2 focus-visible:ring-foco"
                            >
                                {tag.label}
                                <X aria-hidden="true" className="size-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <FormDialog
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                title="Filtros"
                footer={<Button onClick={() => setSheetOpen(false)}>Ver receitas</Button>}
            >
                <div className="flex flex-col gap-4">
                    <FilterFields
                        idPrefix="folha"
                        search={search}
                        onSearchChange={onSearchChange}
                    />
                </div>
            </FormDialog>
        </div>
    );
}
