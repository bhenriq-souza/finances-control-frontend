import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { applyApiError } from '@/api/errors/form-errors';
import { invalidateAfter } from '@/api/queries/invalidation';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';
import { EntryListSkeleton } from '@/ui/skeleton';

import { WORKSPACE_NAME_MAX } from './approve-dialog';
import { renameWorkspace, workspacesListQuery, type Workspace } from './users-api';

interface Values {
    name: string;
}

function RenameForm({ workspace, onDone }: { workspace: Workspace; onDone: () => void }) {
    const queryClient = useQueryClient();
    const notify = useNotify();
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<Values>({ defaultValues: { name: workspace.name } });

    const rename = useMutation({
        mutationFn: (name: string) => renameWorkspace(workspace.id, name),
        onSuccess: async (_data, name) => {
            await invalidateAfter(queryClient, 'workspace');
            onDone();
            notify({ tone: 'sucesso', message: `Espaço renomeado para ${name}.` });
        },
        onError: (error) => {
            applyApiError(error, { setError }, { fields: { name: 'name' } });
            if (error instanceof ApiError && error.code === 'WORKSPACE_NOT_FOUND') {
                void queryClient.invalidateQueries({ queryKey: workspacesListQuery.queryKey });
            }
        },
    });

    const onSubmit = handleSubmit(({ name }) => {
        const trimmed = name.trim();
        if (trimmed === '') {
            setError('name', { type: 'required', message: 'Informe o nome do espaço.' });
            return;
        }
        rename.mutate(trimmed);
    });

    return (
        <form noValidate className="flex flex-col gap-2" onSubmit={onSubmit}>
            <FormAlert message={errors.root?.api?.message} />
            <Field label={`Nome do espaço ${workspace.name}`} error={errors.name?.message}>
                {(field) => (
                    <Input
                        {...field}
                        maxLength={WORKSPACE_NAME_MAX}
                        autoComplete="off"
                        {...register('name')}
                    />
                )}
            </Field>
            <div className="flex gap-2">
                <Button type="submit" disabled={rename.isPending}>
                    Salvar
                </Button>
                <Button variant="outline" onClick={onDone}>
                    Cancelar
                </Button>
            </div>
        </form>
    );
}

/**
 * Painel de espaços (spec 0021): `FormDialog` com a lista de espaços e a contagem de membros;
 * **Renomear** troca o nome por um campo em linha. Só o admin da plataforma chega aqui
 * (INV-0021-01), e a lista só muda pela resposta do backend (INV-0021-04).
 */
export function WorkspacesPanel({ onClose }: { onClose: () => void }) {
    const { data, error, refetch } = useQuery(workspacesListQuery);
    const [editingId, setEditingId] = useState<string | null>(null);

    const columns: EntryColumn<Workspace>[] = [
        {
            header: 'Nome',
            cell: (workspace) =>
                editingId === workspace.id ? (
                    <RenameForm workspace={workspace} onDone={() => setEditingId(null)} />
                ) : (
                    <span className="text-corpo-forte">{workspace.name}</span>
                ),
        },
        { header: 'Membros', cell: (workspace) => workspace.memberCount, align: 'end' },
        {
            header: 'Ações',
            cell: (workspace) =>
                editingId === workspace.id ? null : (
                    <Button
                        variant="outline"
                        aria-label={`Renomear ${workspace.name}`}
                        onClick={() => setEditingId(workspace.id)}
                    >
                        Renomear
                    </Button>
                ),
            align: 'end',
        },
    ];

    let body;
    if (error) {
        body = (
            <EmptyState
                variant="erro"
                error={
                    error instanceof ApiError
                        ? error
                        : { userMessage: CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE }
                }
                onRetry={() => void refetch()}
            />
        );
    } else if (!data) {
        body = <EntryListSkeleton />;
    } else {
        body = (
            <EntryList
                items={data}
                getKey={(workspace) => workspace.id}
                caption="Espaços"
                columns={columns}
                renderCard={(workspace) => (
                    <div className="flex flex-col gap-3">
                        {editingId === workspace.id ? (
                            <RenameForm workspace={workspace} onDone={() => setEditingId(null)} />
                        ) : (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-corpo-forte">{workspace.name}</span>
                                    <span className="text-corpo text-texto-apoio">
                                        {workspace.memberCount}{' '}
                                        {workspace.memberCount === 1 ? 'membro' : 'membros'}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    aria-label={`Renomear ${workspace.name}`}
                                    onClick={() => setEditingId(workspace.id)}
                                >
                                    Renomear
                                </Button>
                            </>
                        )}
                    </div>
                )}
                empty={<EmptyState variant="vazio" title="Nenhum espaço." />}
            />
        );
    }

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Espaços"
            footer={
                <Button variant="outline" onClick={onClose}>
                    Fechar
                </Button>
            }
        >
            {body}
        </FormDialog>
    );
}
