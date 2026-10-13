import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import { useBankAccounts, useEarningTypes } from '@/api/queries/reference';
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

import { EARNING_KIND_LABELS, EARNING_KINDS, type Earning } from '../list/earning-model';

import {
    type CreateEarning,
    type UpdateEarning,
    useCreateEarning,
    useReloadOnConflict,
    useUpdateEarning,
} from './api';
import {
    DESCRIPTION_MAX,
    earningFormSchema,
    INSTALLMENTS_MAX,
    INSTALLMENTS_MIN,
    NOTES_MAX,
    type EarningFormOutput,
    type EarningFormValues,
} from './earning-schema';

const FORM_ID = 'receita-formulario';
const SAVED = 'Receita salva.';

/** Nota da troca de conta numa parcela (spec 0014): o backend leva a conta às não recebidas. */
export const INSTALLMENT_ACCOUNT_NOTE = 'A conta muda em todas as parcelas não recebidas.';
export const INSTALLMENT_EDIT_NOTE = 'A alteração vale só para esta parcela.';

const STATUS_OPTIONS: readonly SelectOption[] = [
    { value: 'OPEN', label: 'Pendente' },
    { value: 'FORECAST', label: 'Previsto' },
    { value: 'VERIFYING', label: 'Verificando' },
];

const FIELD_MAP: ApiFieldMap<EarningFormValues> = {
    fields: {
        kind: 'kind',
        description: 'description',
        earningTypeId: 'earningTypeId',
        amountCents: 'amount',
        bankAccountId: 'bankAccountId',
        occurredOn: 'occurredOn',
        installmentTotal: 'installmentTotal',
        recurrenceEndsOn: 'recurrenceEndsOn',
        status: 'status',
        notes: 'notes',
    },
    codes: {
        EARNING_TYPE_ARCHIVED: 'earningTypeId',
        EARNING_TYPE_NOT_FOUND: 'earningTypeId',
        BANK_ACCOUNT_ARCHIVED: 'bankAccountId',
        BANK_ACCOUNT_NOT_FOUND: 'bankAccountId',
    },
};

/** Texto do `MoneyInput` para um valor salvo: `1.234,56`, como ele mesmo formata. */
function amountText(cents: number): string {
    return formatBRL(cents as Cents, { sign: 'never' }).replace(/^R\$\s*/, '');
}

const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label, 'pt-BR');

/** Os ativos e, ao alterar, o atual mesmo arquivado (para o select mostrar o valor salvo). */
function activeOptions<T extends { id: string; archivedAt: string | null }>(
    items: readonly T[] | undefined,
    label: (item: T) => string,
    keep: string | undefined,
): SelectOption[] {
    return (items ?? [])
        .filter((item) => item.archivedAt === null || item.id === keep)
        .map((item) => ({ value: item.id, label: label(item) }))
        .sort(byLabel);
}

/** Corpo do `POST`: parcelas só em Parcelada, **Repetir até** só em Fixa e se informado. */
export function createBody(values: EarningFormOutput): CreateEarning {
    const body: CreateEarning = {
        description: values.description,
        earningTypeId: values.earningTypeId,
        kind: values.kind,
        amountCents: values.amount,
        occurredOn: values.occurredOn,
        bankAccountId: values.bankAccountId,
        status: values.status,
    };
    if (values.kind === 'INSTALLMENT') body.installmentTotal = Number(values.installmentTotal);
    if (values.kind === 'FIXED' && values.recurrenceEndsOn !== '') {
        body.recurrenceEndsOn = values.recurrenceEndsOn;
    }
    if (values.notes !== '') body.notes = values.notes;
    return body;
}

/**
 * Corpo do `PATCH`: só o que mudou. Nunca `kind`, `status`, `receivedOn` nem campos de parcela
 * (INV-0014-04); o valor de uma receita recebida não é enviado.
 */
export function changedFields(earning: Earning, values: EarningFormOutput): UpdateEarning {
    const body: UpdateEarning = {};
    if (values.description !== earning.description) body.description = values.description;
    if (values.earningTypeId !== earning.earningType.id) body.earningTypeId = values.earningTypeId;
    if (values.occurredOn !== earning.occurredOn) body.occurredOn = values.occurredOn;
    if (earning.status !== 'RECEIVED' && values.amount !== earning.amountCents) {
        body.amountCents = values.amount;
    }
    if (values.bankAccountId !== earning.bankAccountId) body.bankAccountId = values.bankAccountId;
    const notes = values.notes === '' ? null : values.notes;
    if (notes !== earning.notes) body.notes = notes;
    return body;
}

function defaultValues(earning: Earning | undefined): EarningFormValues {
    if (earning) {
        return {
            kind: earning.kind,
            description: earning.description,
            earningTypeId: earning.earningType.id,
            amount: amountText(earning.amountCents),
            bankAccountId: earning.bankAccountId,
            occurredOn: earning.occurredOn,
            installmentTotal: '',
            recurrenceEndsOn: '',
            status: 'OPEN',
            notes: earning.notes ?? '',
            scope: 'one',
        };
    }
    return {
        kind: 'VARIABLE',
        description: '',
        earningTypeId: '',
        amount: '',
        bankAccountId: '',
        occurredOn: today(),
        installmentTotal: String(INSTALLMENTS_MIN),
        recurrenceEndsOn: '',
        status: 'OPEN',
        notes: '',
        scope: 'one',
    };
}

function RadioOption({ children, ...props }: ComponentProps<'input'>) {
    return (
        <label className="flex min-h-11 items-center gap-2 text-corpo text-texto">
            <input type="radio" className="size-4 accent-acento" {...props} />
            {children}
        </label>
    );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-rotulo text-texto-apoio">{label}</span>
            <span className="text-corpo text-texto">{value}</span>
        </div>
    );
}

export interface EarningFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Sem ela, criar; com ela, alterar. */
    earning?: Earning;
}

/**
 * Formulário de receita (spec 0014, "Formulário de receita", sobre os campos da spec 0012): criar
 * uma receita variável, parcelada ou fixa numa conta, ou alterar uma existente — com a conta
 * alterável, a nota da cascata numa parcela e, numa ocorrência de série, a escolha entre **Só
 * esta** e **Esta e as próximas previstas**.
 */
export function EarningFormDialog({ open, onOpenChange, earning }: EarningFormDialogProps) {
    const notify = useNotify();
    const navigate = useNavigate();
    const reloadOnConflict = useReloadOnConflict();
    const types = useEarningTypes();
    const accounts = useBankAccounts();
    const create = useCreateEarning();
    const update = useUpdateEarning(earning?.id ?? '');
    const editing = earning !== undefined;

    const form = useForm<EarningFormValues, unknown, EarningFormOutput>({
        resolver: zodResolver(earningFormSchema(editing ? 'edit' : 'create')),
        defaultValues: defaultValues(earning),
    });
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = form;
    const kind = useWatch({ control, name: 'kind' });

    const typeOptions = activeOptions(types.data, (type) => type.name, earning?.earningType.id);
    const accountOptions = activeOptions(
        accounts.data,
        (account) => account.description,
        earning?.bankAccountId,
    );
    const pending = create.isPending || update.isPending;

    const onSubmit = handleSubmit(async (values) => {
        try {
            if (earning) {
                const body = changedFields(earning, values);
                if (Object.keys(body).length > 0) {
                    await update.mutateAsync({ body, scope: values.scope });
                }
                onOpenChange(false);
                notify({ tone: 'sucesso', message: SAVED });
                return;
            }
            const created = await create.mutateAsync(createBody(values));
            notify({
                tone: 'sucesso',
                message: created.length > 1 ? `${created.length} receitas criadas.` : SAVED,
            });
            const first = created[0];
            if (first) {
                void navigate({ to: '/receitas/$receitaId', params: { receitaId: first.id } });
            } else {
                onOpenChange(false);
            }
        } catch (error) {
            reloadOnConflict(error);
            applyApiError(error, form, FIELD_MAP);
        }
    });

    const installment = earning?.installment;
    const received = earning?.status === 'RECEIVED';

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title={editing ? 'Alterar receita' : 'Nova receita'}
            description={installment ? INSTALLMENT_EDIT_NOTE : undefined}
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} disabled={pending}>
                        Salvar
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                {editing ? (
                    <ReadOnlyRow
                        label="Natureza"
                        value={
                            installment
                                ? `${EARNING_KIND_LABELS[earning.kind]} · Parcela ${installment.number} de ${installment.total}`
                                : EARNING_KIND_LABELS[earning.kind]
                        }
                    />
                ) : (
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-rotulo text-texto">Natureza</legend>
                        <div className="flex flex-col gap-2 md:flex-row md:gap-6">
                            {EARNING_KINDS.map((value) => (
                                <RadioOption key={value} value={value} {...register('kind')}>
                                    {EARNING_KIND_LABELS[value]}
                                </RadioOption>
                            ))}
                        </div>
                    </fieldset>
                )}
                <Field label="Descrição" error={errors.description?.message}>
                    {(control) => (
                        <Input
                            {...control}
                            autoComplete="off"
                            maxLength={DESCRIPTION_MAX}
                            {...register('description')}
                        />
                    )}
                </Field>
                <SelectField
                    label="Tipo"
                    placeholder="Escolha o tipo"
                    options={typeOptions}
                    error={errors.earningTypeId?.message}
                    {...register('earningTypeId')}
                />
                <Controller
                    control={control}
                    name="amount"
                    render={({ field, fieldState }) => (
                        <MoneyInput
                            label={!editing && kind === 'INSTALLMENT' ? 'Valor total' : 'Valor'}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            disabled={received}
                            error={fieldState.error?.message}
                        />
                    )}
                />
                <SelectField
                    label="Conta"
                    placeholder="Escolha a conta"
                    options={accountOptions}
                    help={installment ? INSTALLMENT_ACCOUNT_NOTE : undefined}
                    error={errors.bankAccountId?.message}
                    {...register('bankAccountId')}
                />
                <DateField
                    label="Data prevista"
                    error={errors.occurredOn?.message}
                    {...register('occurredOn')}
                />
                {!editing && kind === 'INSTALLMENT' && (
                    <Field label="Parcelas" error={errors.installmentTotal?.message}>
                        {(control) => (
                            <Input
                                {...control}
                                type="number"
                                inputMode="numeric"
                                min={INSTALLMENTS_MIN}
                                max={INSTALLMENTS_MAX}
                                step={1}
                                {...register('installmentTotal')}
                            />
                        )}
                    </Field>
                )}
                {!editing && kind === 'FIXED' && (
                    <DateField
                        label="Repetir até"
                        help="Sem data, a série segue mês a mês."
                        error={errors.recurrenceEndsOn?.message}
                        {...register('recurrenceEndsOn')}
                    />
                )}
                {!editing && (
                    <SelectField
                        label="Situação inicial"
                        options={STATUS_OPTIONS}
                        error={errors.status?.message}
                        {...register('status')}
                    />
                )}
                <Field label="Observações" error={errors.notes?.message}>
                    {(control) => (
                        <textarea
                            {...control}
                            rows={3}
                            maxLength={NOTES_MAX}
                            className="flex min-h-22 w-full min-w-0 rounded-md border border-linha-forte bg-superficie px-3 py-2 text-corpo text-texto outline-none placeholder:text-texto-apoio focus-visible:ring-2 focus-visible:ring-foco aria-invalid:border-negativo"
                            {...register('notes')}
                        />
                    )}
                </Field>
                {earning?.recurrenceId && (
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-rotulo text-texto">Aplicar a</legend>
                        <div className="flex flex-col gap-2 md:flex-row md:gap-6">
                            <RadioOption value="one" {...register('scope')}>
                                Só esta
                            </RadioOption>
                            <RadioOption value="following" {...register('scope')}>
                                Esta e as próximas previstas
                            </RadioOption>
                        </div>
                    </fieldset>
                )}
            </form>
        </FormDialog>
    );
}
