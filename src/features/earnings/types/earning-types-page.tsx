import { Plus, Tags } from 'lucide-react';
import { useId } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { useCan } from '@/api/permissions';
import { type EarningType, useEarningTypes } from '@/api/queries/reference';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { useNotify } from '@/ui/notice';
import { EntryListSkeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import { useArchiveEarningType } from './api';
import { EarningTypeFormDialog } from './earning-type-form-dialog';
import type { EarningTypesSearch } from './search';

export interface EarningTypesPageProps {
    search: EarningTypesSearch;
    /** Troca os parâmetros de busca da rota (a URL é a fonte do estado da tela). */
    onSearchChange: (search: EarningTypesSearch) => void;
}

const byName = (a: EarningType, b: EarningType) => a.name.localeCompare(b.name, 'pt-BR');

/** Os tipos da tela: os ativos, ou todos com **Mostrar arquivados**, em ordem de nome. */
export function visibleEarningTypes(
    types: readonly EarningType[],
    showArchived: boolean,
): EarningType[] {
    return types.filter((type) => showArchived || type.archivedAt === null).sort(byName);
}

function RowActions({ earningType, onRename }: { earningType: EarningType; onRename: () => void }) {
    const notify = useNotify();
    const archive = useArchiveEarningType();
    const archived = earningType.archivedAt !== null;

    function toggleArchived() {
        archive.mutate(
            { id: earningType.id, archived: !archived },
            {
                onSuccess: () =>
                    notify({
                        tone: 'sucesso',
                        message: archived
                            ? 'Tipo de receita desarquivado.'
                            : 'Tipo de receita arquivado.',
                    }),
                onError: (error) =>
                    notify({
                        tone: 'erro',
                        message:
                            error instanceof ApiError
                                ? error.userMessage
                                : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE,
                    }),
            },
        );
    }

    return (
        <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" aria-label={`Renomear ${earningType.name}`} onClick={onRename}>
                Renomear
            </Button>
            <Button
                variant="ghost"
                aria-label={`${archived ? 'Desarquivar' : 'Arquivar'} ${earningType.name}`}
                disabled={archive.isPending}
                onClick={toggleArchived}
            >
                {archived ? 'Desarquivar' : 'Arquivar'}
            </Button>
        </div>
    );
}

function ArchivedBadge({ earningType }: { earningType: EarningType }) {
    return earningType.archivedAt !== null ? (
        <StatusBadge badge={DERIVED_BADGES.arquivado} />
    ) : null;
}

/**
 * `/receitas/tipos` (spec 0014): os tipos de receita no padrão de **cadastro** da spec 0009 —
 * `EntryList` por nome com o selo **Arquivado**; com `entries.write`, **Novo tipo**, **Renomear**
 * e **Arquivar** ou **Desarquivar**. `?novo` e `?editar` abrem o formulário só com a permissão
 * (INV-0009-03).
 */
export function EarningTypesPage({ search, onSearchChange }: EarningTypesPageProps) {
    const canWrite = useCan('entries.write');
    const query = useEarningTypes();
    const toggleId = useId();
    const showArchived = search.arquivados === 1;

    const close = () => onSearchChange({ ...search, novo: undefined, editar: undefined });
    const openNew = () => onSearchChange({ ...search, novo: 1, editar: undefined });
    const openRename = (id: string) => onSearchChange({ ...search, novo: undefined, editar: id });

    const types = query.data ? visibleEarningTypes(query.data, showArchived) : [];
    const editing = search.editar
        ? query.data?.find((type) => type.id === search.editar)
        : undefined;
    const formOpen = canWrite && (editing !== undefined || (search.novo === 1 && !search.editar));

    const columns: EntryColumn<EarningType>[] = [
        { header: 'Nome', cell: (type) => type.name },
        { header: 'Situação', cell: (type) => <ArchivedBadge earningType={type} /> },
    ];
    if (canWrite) {
        columns.push({
            header: 'Ações',
            align: 'end',
            cell: (type) => <RowActions earningType={type} onRename={() => openRename(type.id)} />,
        });
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titulo-1">Tipos de receita</h1>
                {canWrite && (
                    <Button onClick={openNew}>
                        <Plus aria-hidden="true" />
                        Novo tipo
                    </Button>
                )}
            </header>

            <div className="flex items-center gap-2">
                <input
                    id={toggleId}
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) =>
                        onSearchChange({
                            ...search,
                            arquivados: event.target.checked ? 1 : undefined,
                        })
                    }
                    className="size-5 accent-acento"
                />
                <label htmlFor={toggleId} className="text-corpo text-texto">
                    Mostrar arquivados
                </label>
            </div>

            {query.isError ? (
                <EmptyState
                    variant="erro"
                    error={
                        query.error instanceof ApiError
                            ? query.error
                            : { userMessage: CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE }
                    }
                    onRetry={() => void query.refetch()}
                />
            ) : !query.data ? (
                <EntryListSkeleton />
            ) : (
                <EntryList
                    items={types}
                    getKey={(type) => type.id}
                    caption="Tipos de receita"
                    columns={columns}
                    renderCard={(type) => (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-corpo-forte">{type.name}</span>
                                <ArchivedBadge earningType={type} />
                            </div>
                            {canWrite && (
                                <RowActions
                                    earningType={type}
                                    onRename={() => openRename(type.id)}
                                />
                            )}
                        </div>
                    )}
                    empty={
                        <EmptyState
                            variant="vazio"
                            icon={Tags}
                            title="Nenhum tipo de receita."
                            description="Os tipos classificam as receitas, como Salário ou Aluguel recebido."
                        />
                    }
                />
            )}

            {formOpen && (
                <EarningTypeFormDialog
                    key={editing?.id ?? 'novo'}
                    earningType={editing}
                    onClose={close}
                />
            )}
        </div>
    );
}
