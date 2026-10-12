import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { applyApiError } from '@/api/errors/form-errors';
import { today } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { DateField } from '@/ui/date-field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import {
    type BankTransfer,
    useChangeTransferStatus,
    useDeleteTransfer,
    useReloadOnConflict,
} from './api';
import { completeTransferSchema, type CompleteTransferValues } from './schema';
import { errorMessageOf } from './transfer-errors';

const COMPLETE_FORM_ID = 'transferencia-concluir';

interface ActionDialogProps {
    transfer: BankTransfer;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** **Concluir**: `PATCH /bank-transfers/{id}/status` `{ status: 'COMPLETED', completedOn }`. */
export function CompleteTransferDialog({ transfer, open, onOpenChange }: ActionDialogProps) {
    const notify = useNotify();
    const reloadOnConflict = useReloadOnConflict();
    const change = useChangeTransferStatus(transfer.id);
    const form = useForm<CompleteTransferValues>({
        resolver: zodResolver(completeTransferSchema),
        defaultValues: { completedOn: today() },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(async ({ completedOn }) => {
        try {
            await change.mutateAsync({ status: 'COMPLETED', completedOn });
            onOpenChange(false);
            notify({ tone: 'sucesso', message: 'Transferência concluída.' });
        } catch (error) {
            reloadOnConflict(error);
            applyApiError(error, form, { fields: { completedOn: 'completedOn' } });
        }
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Concluir a transferência?"
            description="O valor sai da conta de origem e entra na de destino."
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={COMPLETE_FORM_ID} disabled={change.isPending}>
                        Concluir
                    </Button>
                </>
            }
        >
            <form
                id={COMPLETE_FORM_ID}
                noValidate
                className="flex flex-col gap-4"
                onSubmit={onSubmit}
            >
                <FormAlert message={errors.root?.api?.message} />
                <DateField
                    label="Concluída em"
                    error={errors.completedOn?.message}
                    {...register('completedOn')}
                />
            </form>
        </FormDialog>
    );
}

/** **Desfazer**: confirmação e `PATCH /bank-transfers/{id}/status` `{ status: 'SCHEDULED' }`. */
export function UndoTransferDialog({ transfer, open, onOpenChange }: ActionDialogProps) {
    const notify = useNotify();
    const reloadOnConflict = useReloadOnConflict();
    const change = useChangeTransferStatus(transfer.id);

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) change.reset();
                onOpenChange(next);
            }}
            title="Desfazer a transferência?"
            description="Os saldos das duas contas voltam e a transferência fica agendada."
            confirmLabel="Desfazer"
            pending={change.isPending}
            onConfirm={() =>
                change.mutate(
                    { status: 'SCHEDULED' },
                    {
                        onSuccess: () => {
                            onOpenChange(false);
                            notify({ tone: 'sucesso', message: 'Transferência desfeita.' });
                        },
                        onError: reloadOnConflict,
                    },
                )
            }
        >
            <FormAlert message={change.error ? errorMessageOf(change.error) : null} />
        </ConfirmDialog>
    );
}

/** **Excluir** (só a agendada): confirmação e `DELETE /bank-transfers/{id}`. */
export function DeleteTransferDialog({
    transfer,
    open,
    onOpenChange,
    onDeleted,
}: ActionDialogProps & { onDeleted: () => void }) {
    const notify = useNotify();
    const reloadOnConflict = useReloadOnConflict();
    const remove = useDeleteTransfer(transfer.id);

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) remove.reset();
                onOpenChange(next);
            }}
            title="Excluir a transferência?"
            description={`A transferência ${transfer.description} será excluída. Essa ação não pode ser desfeita.`}
            confirmLabel="Excluir"
            destructive
            pending={remove.isPending}
            onConfirm={() =>
                remove.mutate(undefined, {
                    onSuccess: () => {
                        notify({ tone: 'sucesso', message: 'Transferência excluída.' });
                        onDeleted();
                    },
                    onError: reloadOnConflict,
                })
            }
        >
            <FormAlert message={remove.error ? errorMessageOf(remove.error) : null} />
        </ConfirmDialog>
    );
}
