import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import { today } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { DateField } from '@/ui/date-field';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { MoneyInput } from '@/ui/money-input';
import { useNotify } from '@/ui/notice';
import { SelectField } from '@/ui/select-field';
import { Skeleton } from '@/ui/skeleton';

import { asApiError, type StatementRefund } from '../panel/statement-model';

import { useCreateRefund, useDeleteRefund, useUpdateRefund } from './refund-api';
import { useRefundExpenseOptions, type RefundExpenseOptions } from './refund-expense-options';
import {
    changedRefundFields,
    createRefundBody,
    DESCRIPTION_MAX,
    editRefundSchema,
    newRefundSchema,
    NOTES_MAX,
    type EditRefundValues,
    type NewRefundOutput,
    type NewRefundValues,
} from './refund-schema';

const NEW_FORM_ID = 'estorno-novo';
const EDIT_FORM_ID = 'estorno-editar';

export const REFUND_NOTICES = {
    created: 'Estorno registrado.',
    saved: 'Estorno salvo.',
    deleted: 'Estorno excluído.',
} as const;

/** Ajuda do lançamento (spec 0013). */
export const POSTED_ON_HELP = 'Deixe vazio para a fatura do dia.';

const NEW_FIELD_MAP: ApiFieldMap<NewRefundValues> = {
    fields: {
        description: 'description',
        amountCents: 'amount',
        occurredOn: 'occurredOn',
        postedOn: 'postedOn',
        expenseId: 'expenseId',
        notes: 'notes',
    },
    codes: {
        STATEMENT_CLOSED: 'postedOn',
        REFUND_EXPENSE_MISMATCH: 'expenseId',
        REFUND_EXCEEDS_EXPENSE: 'amount',
    },
};

const EDIT_FIELD_MAP: ApiFieldMap<EditRefundValues> = {
    fields: { description: 'description', notes: 'notes' },
};

const TEXTAREA_CLASS =
    'flex min-h-22 w-full min-w-0 rounded-md border border-linha-forte bg-superficie px-3 py-2 text-corpo text-texto outline-none placeholder:text-texto-apoio focus-visible:ring-2 focus-visible:ring-foco aria-invalid:border-negativo';

function closeOn(onClose: () => void) {
    return (open: boolean) => {
        if (!open) onClose();
    };
}

function Footer({
    formId,
    pending,
    onClose,
}: {
    formId: string;
    pending: boolean;
    onClose: () => void;
}) {
    return (
        <>
            <Button variant="outline" onClick={onClose}>
                Cancelar
            </Button>
            <Button type="submit" form={formId} disabled={pending}>
                Salvar
            </Button>
        </>
    );
}

export interface NewRefundDialogProps {
    cardId: string;
    /**
     * A despesa de origem pré-selecionada (`?despesa`): das duas faturas listadas ou, fora delas,
     * lida por `GET /expenses/{id}` quando é deste cartão; senão, ignorada (AC-0013-11).
     */
    expenseId?: string;
    onClose: () => void;
}

/**
 * **Novo estorno** (spec 0013, "Estornos") → `POST /credit-card-refunds` com `creditCardId`. O
 * formulário espera as despesas de origem (fatura atual, última fechada e, se for o caso, a de
 * `?despesa` lida à parte) para já vir com ela selecionada. Um erro da API vai ao campo do mapa ou ao alerta, com o diálogo aberto.
 */
export function NewRefundDialog({ cardId, expenseId, onClose }: NewRefundDialogProps) {
    const options = useRefundExpenseOptions(cardId, expenseId);
    const create = useCreateRefund();
    return (
        <FormDialog
            open
            onOpenChange={closeOn(onClose)}
            title="Novo estorno"
            footer={
                <Footer
                    formId={NEW_FORM_ID}
                    pending={!options.ready || create.isPending}
                    onClose={onClose}
                />
            }
        >
            {options.ready ? (
                <NewRefundForm
                    cardId={cardId}
                    expenseId={expenseId}
                    options={options}
                    onClose={onClose}
                    create={create}
                />
            ) : (
                <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-2/3" />
                </div>
            )}
        </FormDialog>
    );
}

function NewRefundForm({
    cardId,
    expenseId,
    options,
    onClose,
    create,
}: Omit<NewRefundDialogProps, 'expenseId'> & {
    expenseId?: string;
    options: RefundExpenseOptions;
    create: ReturnType<typeof useCreateRefund>;
}) {
    const notify = useNotify();
    const form = useForm<NewRefundValues, unknown, NewRefundOutput>({
        resolver: zodResolver(newRefundSchema),
        defaultValues: {
            description: '',
            amount: '',
            occurredOn: today(),
            postedOn: '',
            expenseId: expenseId && options.has(expenseId) ? expenseId : '',
            notes: '',
        },
    });
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit((values) =>
        create.mutate(createRefundBody(cardId, values), {
            onSuccess: () => {
                onClose();
                notify({ tone: 'sucesso', message: REFUND_NOTICES.created });
            },
            onError: (error) => applyApiError(error, form, NEW_FIELD_MAP),
        }),
    );

    return (
        <form id={NEW_FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
            <FormAlert message={errors.root?.api?.message} />
            <Field label="Descrição" error={errors.description?.message}>
                {(fieldControl) => (
                    <Input
                        {...fieldControl}
                        autoComplete="off"
                        maxLength={DESCRIPTION_MAX}
                        {...register('description')}
                    />
                )}
            </Field>
            <Controller
                control={control}
                name="amount"
                render={({ field, fieldState }) => (
                    <MoneyInput
                        label="Valor"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        error={fieldState.error?.message}
                    />
                )}
            />
            <DateField label="Data do estorno" control={form.control} name="occurredOn" />
            <DateField
                label="Lançado em"
                help={POSTED_ON_HELP}
                control={form.control}
                name="postedOn"
            />
            <SelectField
                label="Despesa de origem"
                placeholder="Nenhuma"
                options={options.groups}
                error={errors.expenseId?.message}
                {...register('expenseId')}
            />
            <Field label="Observações" error={errors.notes?.message}>
                {(fieldControl) => (
                    <textarea
                        {...fieldControl}
                        rows={3}
                        maxLength={NOTES_MAX}
                        className={TEXTAREA_CLASS}
                        {...register('notes')}
                    />
                )}
            </Field>
        </form>
    );
}

export interface RefundDialogProps {
    refund: StatementRefund;
    onClose: () => void;
}

/**
 * **Editar** um estorno (spec 0013): só a descrição e as observações → `PATCH
 * /credit-card-refunds/{id}` com o que mudou; sem mudança, só fecha.
 */
export function EditRefundDialog({ refund, onClose }: RefundDialogProps) {
    const notify = useNotify();
    const update = useUpdateRefund();
    const form = useForm<EditRefundValues>({
        resolver: zodResolver(editRefundSchema),
        defaultValues: { description: refund.description, notes: refund.notes ?? '' },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit((values) => {
        const body = changedRefundFields(refund, values);
        if (Object.keys(body).length === 0) {
            onClose();
            return;
        }
        update.mutate(
            { id: refund.id, body },
            {
                onSuccess: () => {
                    onClose();
                    notify({ tone: 'sucesso', message: REFUND_NOTICES.saved });
                },
                onError: (error) => applyApiError(error, form, EDIT_FIELD_MAP),
            },
        );
    });

    return (
        <FormDialog
            open
            onOpenChange={closeOn(onClose)}
            title="Editar estorno"
            description="Para corrigir o valor ou a data, exclua e lance o estorno de novo."
            footer={<Footer formId={EDIT_FORM_ID} pending={update.isPending} onClose={onClose} />}
        >
            <form id={EDIT_FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <Field label="Descrição" error={errors.description?.message}>
                    {(fieldControl) => (
                        <Input
                            {...fieldControl}
                            autoComplete="off"
                            maxLength={DESCRIPTION_MAX}
                            {...register('description')}
                        />
                    )}
                </Field>
                <Field label="Observações" error={errors.notes?.message}>
                    {(fieldControl) => (
                        <textarea
                            {...fieldControl}
                            rows={3}
                            maxLength={NOTES_MAX}
                            className={TEXTAREA_CLASS}
                            {...register('notes')}
                        />
                    )}
                </Field>
            </form>
        </FormDialog>
    );
}

/**
 * **Excluir** um estorno (spec 0013): `ConfirmDialog` → `DELETE /credit-card-refunds/{id}`. O
 * erro (ex.: `STATEMENT_CLOSED`) fica no alerta, com o diálogo aberto.
 */
export function DeleteRefundDialog({ refund, onClose }: RefundDialogProps) {
    const notify = useNotify();
    const remove = useDeleteRefund();
    const confirm = () =>
        remove.mutate(refund.id, {
            onSuccess: () => {
                onClose();
                notify({ tone: 'sucesso', message: REFUND_NOTICES.deleted });
            },
        });

    return (
        <ConfirmDialog
            open
            onOpenChange={closeOn(onClose)}
            title="Excluir estorno?"
            description={`"${refund.description}" sai da fatura e o valor volta a ocupar o limite do cartão.`}
            confirmLabel="Excluir"
            onConfirm={confirm}
            destructive
            pending={remove.isPending}
        >
            <FormAlert message={remove.error ? asApiError(remove.error).userMessage : null} />
        </ConfirmDialog>
    );
}
