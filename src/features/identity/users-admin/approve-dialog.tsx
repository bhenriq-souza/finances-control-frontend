import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { applyApiError } from '@/api/errors/form-errors';
import { PROFILE_LABELS, type Profile } from '@/api/queries/current-user';
import { invalidateAfter } from '@/api/queries/invalidation';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { Input } from '@/ui/components/ui/input';
import { useNotify } from '@/ui/notice';
import { SelectField } from '@/ui/select-field';

import { PROFILE_OPTIONS } from './profile-options';
import {
    grantProfile,
    workspacesListQuery,
    type GrantBody,
    type PlatformUser,
    type Workspace,
} from './users-api';

const FORM_ID = 'liberar-acesso';

/** Tamanho máximo do nome do espaço (spec 0021). */
export const WORKSPACE_NAME_MAX = 80;

type Where = 'novo' | 'existente';

interface Values {
    where: Where;
    workspaceName: string;
    workspaceId: string;
    profile: Profile;
}

export interface ApproveDialogProps {
    user: PlatformUser;
    onClose: () => void;
    /** `USER_NOT_FOUND`: a lista de usuários é recarregada. */
    onStale: () => void;
}

/**
 * Diálogo **Liberar acesso** (spec 0021): o usuário aguardando entra num espaço novo, do qual vira
 * administrador, ou num espaço existente, com um perfil. O corpo enviado tem sempre uma das
 * formas da spec (INV-0021-03); a lista só muda pela resposta do backend (INV-0021-04).
 */
export function ApproveDialog({ user, onClose, onStale }: ApproveDialogProps) {
    const queryClient = useQueryClient();
    const notify = useNotify();
    const workspaces = useQuery(workspacesListQuery);

    const {
        register,
        handleSubmit,
        control,
        setError,
        formState: { errors },
    } = useForm<Values>({
        defaultValues: {
            where: 'novo',
            workspaceName: user.name.slice(0, WORKSPACE_NAME_MAX),
            workspaceId: '',
            profile: 'VIEWER',
        },
    });
    const [where, workspaceName, workspaceId] = useWatch({
        control,
        name: ['where', 'workspaceName', 'workspaceId'],
    });

    const approve = useMutation({
        mutationFn: (body: GrantBody) => grantProfile(user.id, body),
        onSuccess: async (_data, body) => {
            await invalidateAfter(queryClient, 'profile');
            const name =
                'newWorkspace' in body
                    ? body.newWorkspace.name
                    : (workspaces.data?.find(
                          (w) => 'workspaceId' in body && w.id === body.workspaceId,
                      )?.name ?? '');
            onClose();
            notify({
                tone: 'sucesso',
                message: `Acesso de ${user.name} liberado no espaço ${name}.`,
            });
        },
        onError: (error) => {
            applyApiError(
                error,
                { setError },
                { fields: { name: 'workspaceName', newWorkspace: 'workspaceName' } },
            );
            if (error instanceof ApiError) {
                if (error.code === 'USER_NOT_FOUND' || error.code === 'USER_ALREADY_IN_WORKSPACE') {
                    onStale();
                }
                if (error.code === 'WORKSPACE_NOT_FOUND') void workspaces.refetch();
            }
        },
    });

    const missingData = where === 'novo' ? workspaceName.trim() === '' : workspaceId === '';
    const existingDisabled = workspaces.isError;

    function onSubmit(values: Values) {
        if (values.where === 'novo') {
            const name = values.workspaceName.trim();
            if (name === '') {
                setError('workspaceName', {
                    type: 'required',
                    message: 'Informe o nome do espaço.',
                });
                return;
            }
            approve.mutate({ profile: 'ADMIN', newWorkspace: { name } });
            return;
        }
        approve.mutate({ profile: values.profile, workspaceId: values.workspaceId });
    }

    const options = (workspaces.data ?? []).map((workspace: Workspace) => ({
        value: workspace.id,
        label: `${workspace.name} (${workspace.memberCount} ${workspace.memberCount === 1 ? 'membro' : 'membros'})`,
    }));

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={`Liberar acesso de ${user.name}`}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form={FORM_ID}
                        disabled={missingData || approve.isPending}
                    >
                        Salvar
                    </Button>
                </>
            }
        >
            <form
                id={FORM_ID}
                noValidate
                className="flex flex-col gap-4"
                onSubmit={handleSubmit(onSubmit)}
            >
                <FormAlert message={errors.root?.api?.message} />
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-corpo-forte">Onde</legend>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {(
                            [
                                ['novo', 'Novo espaço'],
                                ['existente', 'Espaço existente'],
                            ] as const
                        ).map(([value, label]) => (
                            <label
                                key={value}
                                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-linha px-4 py-3 has-checked:border-acento has-checked:bg-superficie-elevada has-disabled:cursor-not-allowed has-disabled:opacity-50"
                            >
                                <input
                                    type="radio"
                                    value={value}
                                    disabled={value === 'existente' && existingDisabled}
                                    className="size-4 accent-acento"
                                    {...register('where')}
                                />
                                <span className="text-corpo-forte">{label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                {where === 'novo' ? (
                    <>
                        <Field label="Nome do espaço" error={errors.workspaceName?.message}>
                            {(field) => (
                                <Input
                                    {...field}
                                    maxLength={WORKSPACE_NAME_MAX}
                                    autoComplete="off"
                                    {...register('workspaceName')}
                                />
                            )}
                        </Field>
                        <p className="text-corpo text-texto-apoio">
                            {user.name} será o administrador deste espaço.
                        </p>
                    </>
                ) : (
                    <>
                        {workspaces.isError && (
                            <EmptyState
                                variant="erro"
                                error={{
                                    userMessage:
                                        workspaces.error instanceof ApiError
                                            ? workspaces.error.userMessage
                                            : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE,
                                }}
                                onRetry={() => void workspaces.refetch()}
                            />
                        )}
                        <SelectField
                            label="Espaço"
                            placeholder="Escolha o espaço"
                            options={options}
                            {...register('workspaceId')}
                        />
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-2 text-corpo-forte">Perfil</legend>
                            {PROFILE_OPTIONS.map(({ value, description }) => (
                                <label
                                    key={value}
                                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-linha px-4 py-3 has-checked:border-acento has-checked:bg-superficie-elevada"
                                >
                                    <input
                                        type="radio"
                                        value={value}
                                        aria-describedby={`${FORM_ID}-${value}`}
                                        className="mt-1 size-4 accent-acento"
                                        {...register('profile')}
                                    />
                                    <span className="flex flex-col">
                                        <span className="text-corpo-forte">
                                            {PROFILE_LABELS[value]}
                                        </span>
                                        <span
                                            id={`${FORM_ID}-${value}`}
                                            className="text-corpo text-texto-apoio"
                                        >
                                            {description}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                    </>
                )}
            </form>
        </FormDialog>
    );
}
