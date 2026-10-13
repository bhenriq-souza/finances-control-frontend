import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { applyApiError } from '@/api/errors/form-errors';
import { today } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { DateField } from '@/ui/date-field';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import type { Expense } from '../../list/expense-model';

import { ActionAlert, describeError } from './action-alert';
import { paySchema, type PayValues } from './action-schemas';
import { deleteCascadeText } from './expense-action-model';
import { useActionErrorEffects, useChangeExpenseStatus, useDeleteExpense } from './mutations';

const PAY_FORM_ID = 'despesa-pagar';

export interface ActionDialogProps {
    expense: Expense;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Volta para a lista (depois de excluir, ou com `EXPENSE_NOT_FOUND`). */
    onBackToList: () => void;
}

/** **Pagar** (despesa de conta): `PATCH /expenses/{id}/status` `{ status: 'PAID', paidOn }`. */
export function PayExpenseDialog({ expense, open, onOpenChange, onBackToList }: ActionDialogProps) {
    const notify = useNotify();
    const onActionError = useActionErrorEffects(onBackToList);
    const change = useChangeExpenseStatus(expense.id);
    const form = useForm<PayValues>({
        resolver: zodResolver(paySchema),
        defaultValues: { paidOn: today() },
    });
    const {
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(async ({ paidOn }) => {
        try {
            await change.mutateAsync({ status: 'PAID', paidOn });
            onOpenChange(false);
            notify({ tone: 'sucesso', message: 'Despesa paga.' });
        } catch (error) {
            if (onActionError(error)) return;
            applyApiError(error, form, { fields: { paidOn: 'paidOn' } });
        }
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Pagar a despesa"
            description="O valor sai do saldo da conta na data do pagamento."
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={PAY_FORM_ID} disabled={change.isPending}>
                        Pagar
                    </Button>
                </>
            }
        >
            <form id={PAY_FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <ActionAlert
                    message={errors.root?.api?.message}
                    code={errors.root?.api?.type}
                    cardId={expense.creditCardId}
                />
                <DateField label="Pago em" control={form.control} name="paidOn" />
            </form>
        </FormDialog>
    );
}

/** **Desfazer pagamento** (despesa de conta paga): confirmação e `{ status: 'OPEN' }`. */
export function UndoPaymentDialog({
    expense,
    open,
    onOpenChange,
    onBackToList,
}: ActionDialogProps) {
    const notify = useNotify();
    const onActionError = useActionErrorEffects(onBackToList);
    const change = useChangeExpenseStatus(expense.id);
    const failure = change.error ? describeError(change.error) : null;

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) change.reset();
                onOpenChange(next);
            }}
            title="Desfazer o pagamento?"
            description="A despesa volta para pendente e o valor volta para o saldo da conta."
            confirmLabel="Desfazer pagamento"
            pending={change.isPending}
            onConfirm={() =>
                change.mutate(
                    { status: 'OPEN' },
                    {
                        onSuccess: () => {
                            onOpenChange(false);
                            notify({ tone: 'sucesso', message: 'Pagamento desfeito.' });
                        },
                        onError: onActionError,
                    },
                )
            }
        >
            <ActionAlert
                message={failure?.message}
                code={failure?.code}
                cardId={expense.creditCardId}
            />
        </ConfirmDialog>
    );
}

/** **Excluir** (não paga): o texto da cascata antes de enviar (INV-0012-04) e `DELETE`. */
export function DeleteExpenseDialog({
    expense,
    open,
    onOpenChange,
    onBackToList,
}: ActionDialogProps) {
    const notify = useNotify();
    const onActionError = useActionErrorEffects(onBackToList);
    const remove = useDeleteExpense(expense.id);
    const failure = remove.error ? describeError(remove.error) : null;

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) remove.reset();
                onOpenChange(next);
            }}
            title="Excluir a despesa?"
            description={deleteCascadeText(expense)}
            confirmLabel="Excluir"
            destructive
            pending={remove.isPending}
            onConfirm={() =>
                remove.mutate(undefined, {
                    onSuccess: () => {
                        notify({ tone: 'sucesso', message: 'Despesa excluída.' });
                        onBackToList();
                    },
                    onError: onActionError,
                })
            }
        >
            <ActionAlert
                message={failure?.message}
                code={failure?.code}
                cardId={expense.creditCardId}
            />
        </ConfirmDialog>
    );
}
