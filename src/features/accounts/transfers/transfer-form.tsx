import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';

import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import { type BankAccount, useBankAccounts } from '@/api/queries/reference';
import { today } from '@/shared/dates';
import { formatBRL, type Cents } from '@/shared/money';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { DateField } from '@/ui/date-field';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { MoneyInput } from '@/ui/money-input';
import { useNotify } from '@/ui/notice';
import { SelectField, type SelectOption } from '@/ui/select-field';

import {
    type BankTransfer,
    type CreateBankTransfer,
    type UpdateBankTransfer,
    useCreateTransfer,
    useReloadOnConflict,
    useUpdateTransfer,
} from './api';
import {
    transferDetailsSchema,
    transferSchema,
    type TransferDetailsValues,
    type TransferOutput,
    type TransferValues,
} from './schema';
import { applyTransferError } from './transfer-errors';

const FORM_ID = 'transferencia-formulario';
const SAVED = 'Transferência salva.';

const FIELD_MAP: ApiFieldMap<TransferValues> = {
    fields: {
        fromBankAccountId: 'fromBankAccountId',
        toBankAccountId: 'toBankAccountId',
        amountCents: 'amount',
        occurredOn: 'occurredOn',
        completedOn: 'completedOn',
        description: 'description',
        notes: 'notes',
    },
};

const DETAILS_FIELD_MAP: ApiFieldMap<TransferDetailsValues> = {
    fields: { description: 'description', notes: 'notes' },
};

export interface TransferFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Sem ela, criar; com ela, alterar. */
    transfer?: BankTransfer;
}

/**
 * Formulário de transferência (spec 0018, "Formulário"): criar, alterar a agendada (contas,
 * valor, data, descrição, observações) ou a concluída (só descrição e observações, AC-0018-05).
 */
export function TransferFormDialog({ open, onOpenChange, transfer }: TransferFormDialogProps) {
    if (transfer?.status === 'COMPLETED') {
        return <DetailsFormDialog open={open} onOpenChange={onOpenChange} transfer={transfer} />;
    }
    return <FullFormDialog open={open} onOpenChange={onOpenChange} transfer={transfer} />;
}

function Footer({ onCancel, pending }: { onCancel: () => void; pending: boolean }) {
    return (
        <>
            <Button variant="outline" onClick={onCancel}>
                Cancelar
            </Button>
            <Button type="submit" form={FORM_ID} disabled={pending}>
                Salvar
            </Button>
        </>
    );
}

/** Texto do `MoneyInput` para um valor salvo: `1.234,56`, como ele mesmo formata. */
function amountText(cents: number): string {
    return formatBRL(cents as Cents, { sign: 'never' }).replace(/^R\$\s*/, '');
}

function accountOptions(
    accounts: readonly BankAccount[] | undefined,
    include: readonly string[],
): SelectOption[] {
    return (accounts ?? [])
        .filter((account) => account.archivedAt === null || include.includes(account.id))
        .map((account) => ({ value: account.id, label: account.description }));
}

/** Corpo do `PATCH`: só o que mudou (spec 0018), nunca `status` nem `completedOn`. */
export function changedFields(
    transfer: BankTransfer,
    values: Omit<TransferOutput, 'status' | 'completedOn'>,
): UpdateBankTransfer {
    const body: UpdateBankTransfer = {};
    if (values.fromBankAccountId !== transfer.fromBankAccountId)
        body.fromBankAccountId = values.fromBankAccountId;
    if (values.toBankAccountId !== transfer.toBankAccountId)
        body.toBankAccountId = values.toBankAccountId;
    if (values.amount !== transfer.amountCents) body.amountCents = values.amount;
    if (values.occurredOn !== transfer.occurredOn) body.occurredOn = values.occurredOn;
    Object.assign(body, changedDetails(transfer, values));
    return body;
}

function changedDetails(
    transfer: BankTransfer,
    values: { description: string; notes: string },
): UpdateBankTransfer {
    const body: UpdateBankTransfer = {};
    const description = values.description.trim();
    const notes = values.notes.trim() || null;
    if (description !== transfer.description) body.description = description;
    if (notes !== transfer.notes) body.notes = notes;
    return body;
}

/** Corpo do `POST`: `completedOn` só na concluída e só se informado. */
export function createBody(values: TransferOutput): CreateBankTransfer {
    const notes = values.notes.trim();
    const completedOn = values.status === 'COMPLETED' ? values.completedOn : '';
    return {
        fromBankAccountId: values.fromBankAccountId,
        toBankAccountId: values.toBankAccountId,
        amountCents: values.amount,
        occurredOn: values.occurredOn,
        status: values.status,
        ...(completedOn ? { completedOn } : {}),
        description: values.description.trim(),
        ...(notes ? { notes } : {}),
    };
}

function FullFormDialog({ open, onOpenChange, transfer }: TransferFormDialogProps) {
    const notify = useNotify();
    const reloadOnConflict = useReloadOnConflict();
    const accounts = useBankAccounts();
    const create = useCreateTransfer();
    const update = useUpdateTransfer(transfer?.id ?? '');
    const editing = transfer !== undefined;

    const form = useForm<TransferValues, unknown, TransferOutput>({
        resolver: zodResolver(transferSchema),
        defaultValues: transfer
            ? {
                  fromBankAccountId: transfer.fromBankAccountId,
                  toBankAccountId: transfer.toBankAccountId,
                  amount: amountText(transfer.amountCents),
                  occurredOn: transfer.occurredOn,
                  status: transfer.status,
                  completedOn: '',
                  description: transfer.description,
                  notes: transfer.notes ?? '',
              }
            : {
                  fromBankAccountId: '',
                  toBankAccountId: '',
                  amount: '',
                  occurredOn: today(),
                  status: 'COMPLETED',
                  completedOn: '',
                  description: '',
                  notes: '',
              },
    });
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = form;
    const [from, to, status] = useWatch({
        control,
        name: ['fromBankAccountId', 'toBankAccountId', 'status'],
    });

    const keep = useMemo(
        () => (transfer ? [transfer.fromBankAccountId, transfer.toBankAccountId] : []),
        [transfer],
    );
    const fromOptions = accountOptions(accounts.data, keep);
    // Para: sem a de origem — a não ser que já esteja escolhida, para o erro do schema aparecer
    // sobre o que a pessoa vê (AC-0018-03).
    const toOptions = accountOptions(accounts.data, keep).filter(
        (option) => option.value !== from || option.value === to,
    );

    const pending = create.isPending || update.isPending;

    const onSubmit = handleSubmit(async (values) => {
        try {
            if (transfer) {
                const body = changedFields(transfer, values);
                if (Object.keys(body).length > 0) await update.mutateAsync(body);
            } else {
                await create.mutateAsync(createBody(values));
            }
            onOpenChange(false);
            notify({ tone: 'sucesso', message: SAVED });
        } catch (error) {
            reloadOnConflict(error);
            applyTransferError(error, form, values, FIELD_MAP);
        }
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title={editing ? 'Editar transferência' : 'Nova transferência'}
            footer={<Footer onCancel={() => onOpenChange(false)} pending={pending} />}
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <SelectField
                    label="De"
                    placeholder="Escolha a conta"
                    options={fromOptions}
                    error={errors.fromBankAccountId?.message}
                    {...register('fromBankAccountId')}
                />
                <SelectField
                    label="Para"
                    placeholder="Escolha a conta"
                    options={toOptions}
                    error={errors.toBankAccountId?.message}
                    {...register('toBankAccountId')}
                />
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
                <DateField
                    label="Data"
                    error={errors.occurredOn?.message}
                    {...register('occurredOn')}
                />
                {!editing && (
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-rotulo text-texto">Situação</legend>
                        <div className="flex flex-col gap-2 md:flex-row md:gap-6">
                            <label className="flex min-h-11 items-center gap-2 text-corpo text-texto">
                                <input
                                    type="radio"
                                    value="COMPLETED"
                                    className="size-4 accent-acento"
                                    {...register('status')}
                                />
                                Concluída agora
                            </label>
                            <label className="flex min-h-11 items-center gap-2 text-corpo text-texto">
                                <input
                                    type="radio"
                                    value="SCHEDULED"
                                    className="size-4 accent-acento"
                                    {...register('status')}
                                />
                                Agendar
                            </label>
                        </div>
                    </fieldset>
                )}
                {!editing && status === 'COMPLETED' && (
                    <DateField
                        label="Concluída em"
                        help="Vazio usa a data da transferência."
                        error={errors.completedOn?.message}
                        {...register('completedOn')}
                    />
                )}
                <DescriptionFields
                    description={register('description')}
                    notes={register('notes')}
                    descriptionError={errors.description?.message}
                    notesError={errors.notes?.message}
                />
            </form>
        </FormDialog>
    );
}

function DescriptionFields({
    description,
    notes,
    descriptionError,
    notesError,
}: {
    description: UseFormRegisterReturn;
    notes: UseFormRegisterReturn;
    descriptionError?: string;
    notesError?: string;
}) {
    return (
        <>
            <Field label="Descrição" error={descriptionError}>
                {(field) => <Input {...field} {...description} />}
            </Field>
            <Field label="Observações" error={notesError}>
                {(field) => <Input {...field} {...notes} />}
            </Field>
        </>
    );
}

/** Concluída: só descrição e observações (AC-0018-05, INV-0018-02). */
function DetailsFormDialog({
    open,
    onOpenChange,
    transfer,
}: TransferFormDialogProps & { transfer: BankTransfer }) {
    const notify = useNotify();
    const reloadOnConflict = useReloadOnConflict();
    const update = useUpdateTransfer(transfer.id);
    const form = useForm<TransferDetailsValues>({
        resolver: zodResolver(transferDetailsSchema),
        defaultValues: { description: transfer.description, notes: transfer.notes ?? '' },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(async (values) => {
        try {
            const body = changedDetails(transfer, values);
            if (Object.keys(body).length > 0) await update.mutateAsync(body);
            onOpenChange(false);
            notify({ tone: 'sucesso', message: SAVED });
        } catch (error) {
            reloadOnConflict(error);
            applyApiError(error, form, DETAILS_FIELD_MAP);
        }
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Editar transferência"
            description="Na transferência concluída só a descrição e as observações mudam."
            footer={<Footer onCancel={() => onOpenChange(false)} pending={update.isPending} />}
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <DescriptionFields
                    description={register('description')}
                    notes={register('notes')}
                    descriptionError={errors.description?.message}
                    notesError={errors.notes?.message}
                />
            </form>
        </FormDialog>
    );
}
