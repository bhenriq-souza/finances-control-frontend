import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { invalidateAfter } from '@/api/queries/invalidation';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { FormAlert } from '@/ui/form-alert';
import { useNotify } from '@/ui/notice';

import { removeAvatar } from './avatar-api';

/**
 * **Remover foto** (spec 0006): confirma, envia `DELETE /users/me/avatar` e consulta
 * `GET /users/me` de novo (pela invalidação da raiz `users`); as iniciais voltam. Um erro fica no
 * alerta da confirmação, que continua aberta.
 */
export function RemoveAvatarDialog({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const notify = useNotify();
    const [error, setError] = useState<string | null>(null);

    const remove = useMutation({
        mutationFn: removeAvatar,
        onSuccess: async () => {
            await invalidateAfter(queryClient, 'profile');
            onClose();
            notify({ tone: 'sucesso', message: 'Foto removida.' });
        },
        onError: (cause) =>
            setError(
                cause instanceof ApiError
                    ? cause.userMessage
                    : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE,
            ),
    });

    return (
        <ConfirmDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Remover sua foto?"
            description="As iniciais voltam a aparecer."
            confirmLabel="Remover"
            destructive
            pending={remove.isPending}
            onConfirm={() => {
                setError(null);
                remove.mutate();
            }}
        >
            <FormAlert message={error} />
        </ConfirmDialog>
    );
}
