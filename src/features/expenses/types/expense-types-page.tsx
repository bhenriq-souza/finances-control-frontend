import { Archive, ArchiveRestore, Pencil, Plus, Tags } from 'lucide-react';
import { useMemo } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { useCan } from '@/api/permissions';
import { type ExpenseType, useExpenseTypes } from '@/api/queries/reference';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { useNotify } from '@/ui/notice';
import { EntryListSkeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import { ExpenseTypeFormDialog } from './expense-type-form-dialog';
import { useArchiveExpenseType } from './mutations';
import type { ExpenseTypesSearch } from './search';

export interface ExpenseTypesPageProps {
    search: ExpenseTypesSearch;
    /** Troca a busca da rota (abrir e fechar o formulário, mostrar os arquivados). */
    onSearchChange: (next: ExpenseTypesSearch) => void;
}

const byName = (a: ExpenseType, b: ExpenseType) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

const isArchived = (type: ExpenseType) => type.archivedAt !== null;

/** A mensagem do catálogo de um erro da API (INV-0000-06). */
const userMessageOf = (error: unknown) =>
    error instanceof ApiError ? error.userMessage : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE;

/**
 * `/despesas/tipos` (spec 0012): padrão de **cadastro** da spec 0009 — `EntryList` por nome, selo
 * **Arquivado** e, com `entries.write`, **Novo tipo** (`?novo=1`), **Renomear** (`?editar=<id>`),
 * **Arquivar** e **Desarquivar**. Sem a permissão, nenhum controle de escrita é renderizado e os
 * parâmetros `novo` e `editar` não têm efeito (INV-0009-03).
 */
export function ExpenseTypesPage({ search, onSearchChange }: ExpenseTypesPageProps) {
    const canWrite = useCan('entries.write');
    const notify = useNotify();
    const query = useExpenseTypes();
    const archive = useArchiveExpenseType();
    const showArchived = search.arquivados === 1;

    const items = useMemo(
        () => (query.data ?? []).filter((type) => showArchived || !isArchived(type)).sort(byName),
        [query.data, showArchived],
    );
    // A busca da lista, sem os parâmetros que abrem o formulário.
    const listSearch: ExpenseTypesSearch = showArchived ? { arquivados: 1 } : {};
    const openNew = () => onSearchChange({ ...listSearch, novo: 1 });
    const openRename = (type: ExpenseType) => onSearchChange({ ...listSearch, editar: type.id });
    const closeForm = () => onSearchChange(listSearch);

    function toggleArchived(type: ExpenseType) {
        const archiving = !isArchived(type);
        archive.mutate(
            { id: type.id, archive: archiving },
            {
                onSuccess: () =>
                    notify({
                        tone: 'sucesso',
                        message: archiving ? 'Tipo arquivado.' : 'Tipo desarquivado.',
                    }),
                onError: (error) => notify({ tone: 'erro', message: userMessageOf(error) }),
            },
        );
    }

    function actions(type: ExpenseType) {
        const pending = archive.isPending && archive.variables?.id === type.id;
        return (
            <div className="flex flex-wrap gap-2 md:justify-end">
                <Button
                    variant="outline"
                    aria-label={`Renomear ${type.name}`}
                    onClick={() => openRename(type)}
                >
                    <Pencil aria-hidden="true" />
                    Renomear
                </Button>
                <Button
                    variant="outline"
                    aria-label={`${isArchived(type) ? 'Desarquivar' : 'Arquivar'} ${type.name}`}
                    disabled={pending}
                    onClick={() => toggleArchived(type)}
                >
                    {isArchived(type) ? (
                        <ArchiveRestore aria-hidden="true" />
                    ) : (
                        <Archive aria-hidden="true" />
                    )}
                    {isArchived(type) ? 'Desarquivar' : 'Arquivar'}
                </Button>
            </div>
        );
    }

    const badge = (type: ExpenseType) =>
        isArchived(type) ? <StatusBadge badge={DERIVED_BADGES.arquivado} /> : null;

    const columns: EntryColumn<ExpenseType>[] = [
        { header: 'Nome', cell: (type) => type.name },
        { header: 'Situação', cell: badge },
    ];
    if (canWrite) columns.push({ header: 'Ações', cell: actions, align: 'end' });

    const editing =
        canWrite && search.editar !== undefined
            ? query.data?.find((type) => type.id === search.editar)
            : undefined;
    const creating = canWrite && search.novo === 1 && editing === undefined;

    function content() {
        if (query.isPending) return <EntryListSkeleton />;
        if (query.isError) {
            return (
                <EmptyState
                    variant="erro"
                    error={{ userMessage: userMessageOf(query.error) }}
                    onRetry={() => void query.refetch()}
                />
            );
        }
        return (
            <EntryList
                items={items}
                getKey={(type) => type.id}
                caption="Tipos de despesa"
                columns={columns}
                renderCard={(type) => (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-corpo-forte">{type.name}</span>
                            {badge(type)}
                        </div>
                        {canWrite && actions(type)}
                    </div>
                )}
                empty={
                    <EmptyState
                        variant="vazio"
                        icon={Tags}
                        title={
                            showArchived
                                ? 'Nenhum tipo de despesa.'
                                : 'Nenhum tipo de despesa ativo.'
                        }
                        description="Os tipos organizam as despesas nos filtros e nos relatórios."
                    />
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titulo-1">Tipos de despesa</h1>
                {canWrite && (
                    <Button onClick={openNew}>
                        <Plus aria-hidden="true" />
                        Novo tipo
                    </Button>
                )}
            </div>
            <div>
                <Button
                    variant="ghost"
                    aria-pressed={showArchived}
                    onClick={() => onSearchChange(showArchived ? {} : { arquivados: 1 })}
                >
                    Mostrar arquivados
                </Button>
            </div>
            {content()}
            {(creating || editing) && (
                <ExpenseTypeFormDialog
                    key={editing?.id ?? 'novo'}
                    expenseType={editing}
                    onClose={closeForm}
                />
            )}
        </div>
    );
}
