import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { applyApiError } from '@/api/errors/form-errors';
import { PROFILE_LABELS, type Profile } from '@/api/queries/current-user';
import { invalidateAfter } from '@/api/queries/invalidation';
import { Button } from '@/ui/components/ui/button';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import { grantProfile, revokeProfile, type PlatformUser } from './users-api';

const FORM_ID = 'perfil-usuario';

/** Os três perfis, com a descrição de uma linha de `docs/user-profiles.md` do hub (spec 0010). */
export const PROFILE_OPTIONS: readonly { value: Profile; description: string }[] = [
    { value: 'ADMIN', description: 'Tudo, inclusive usuários, bancos, contas e cartões' },
    { value: 'BILLER', description: 'Lança e altera despesas, receitas, faturas e transferências' },
    { value: 'VIEWER', description: 'Só consulta' },
];

interface Values {
    profile: Profile | '';
}

export interface ProfileDialogProps {
    user: PlatformUser;
    onClose: () => void;
    /** `USER_NOT_FOUND` (ERR-0010-03): a lista é recarregada. */
    onStale: () => void;
}

/**
 * Diálogo de perfil (spec 0010): liberar acesso de quem está aguardando, ou trocar o perfil e
 * revogar o acesso de quem já tem um. A lista só muda pela resposta do backend, depois de
 * `invalidateAfter` (INV-0010-03); num erro o diálogo continua aberto com o alerta do catálogo.
 */
export function ProfileDialog({ user, onClose, onStale }: ProfileDialogProps) {
    const queryClient = useQueryClient();
    const notify = useNotify();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [revokeError, setRevokeError] = useState<string | null>(null);
    const current = user.profile;

    const {
        register,
        handleSubmit,
        control,
        setError,
        formState: { errors },
    } = useForm<Values>({ defaultValues: { profile: current ?? '' } });
    const chosen = useWatch({ control, name: 'profile' });

    function onApiError(error: unknown) {
        if (error instanceof ApiError && error.code === 'USER_NOT_FOUND') onStale();
    }

    const grant = useMutation({
        mutationFn: (profile: Profile) => grantProfile(user.id, profile),
        onSuccess: async () => {
            await invalidateAfter(queryClient, 'profile');
            onClose();
            notify({ tone: 'sucesso', message: `Perfil de ${user.name} atualizado.` });
        },
        onError: (error) => {
            applyApiError(error, { setError });
            onApiError(error);
        },
    });

    const revoke = useMutation({
        mutationFn: () => revokeProfile(user.id),
        onSuccess: async () => {
            await invalidateAfter(queryClient, 'profile');
            setConfirmOpen(false);
            onClose();
            notify({ tone: 'sucesso', message: `Acesso de ${user.name} revogado.` });
        },
        onError: (error) => {
            setRevokeError(
                error instanceof ApiError
                    ? error.userMessage
                    : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE,
            );
            onApiError(error);
        },
    });

    const title = current ? `Alterar perfil de ${user.name}` : `Liberar acesso de ${user.name}`;

    return (
        <>
            <FormDialog
                open
                onOpenChange={(open) => {
                    if (!open) onClose();
                }}
                title={title}
                footer={
                    <>
                        <Button variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            form={FORM_ID}
                            disabled={chosen === '' || chosen === current || grant.isPending}
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
                    onSubmit={handleSubmit(({ profile }) => {
                        if (profile !== '' && profile !== current) grant.mutate(profile);
                    })}
                >
                    <FormAlert message={errors.root?.api?.message} />
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
                    {current && (
                        <div className="flex flex-col items-start gap-2 border-t border-linha pt-4">
                            <p className="text-corpo text-texto-apoio">
                                Sem perfil, {user.name} não acessa nada até receber um de novo.
                            </p>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setRevokeError(null);
                                    setConfirmOpen(true);
                                }}
                            >
                                Revogar acesso
                            </Button>
                        </div>
                    )}
                </form>
            </FormDialog>
            {current && (
                <ConfirmDialog
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    title={`Revogar o acesso de ${user.name}?`}
                    description={`${user.name} volta para a tela de aguardando aprovação e perde o acesso a tudo até receber um perfil de novo.`}
                    confirmLabel="Revogar"
                    destructive
                    pending={revoke.isPending}
                    onConfirm={() => {
                        setRevokeError(null);
                        revoke.mutate();
                    }}
                >
                    <FormAlert message={revokeError} />
                </ConfirmDialog>
            )}
        </>
    );
}
