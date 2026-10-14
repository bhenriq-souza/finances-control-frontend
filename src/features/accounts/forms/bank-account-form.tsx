import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import { type Bank, type BankAccount, useBanks } from '@/api/queries/reference';
import { moneySchema, type Cents } from '@/shared/money';
import { Input } from '@/ui/components/ui/input';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { Money } from '@/ui/money';
import { MoneyInput } from '@/ui/money-input';
import { useNotify } from '@/ui/notice';
import { SelectField, type SelectOption } from '@/ui/select-field';

import { ACCOUNT_TYPE_LABELS, sortByText } from '../list-parts';

import { type CreateBankAccount, type UpdateBankAccount, useSaveBankAccount } from './api';
import { amountText, FormFooter, required } from './form-parts';

const FORM_ID = 'conta-formulario';

const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'INVESTMENT'] as const;

const TYPE_OPTIONS: SelectOption[] = ACCOUNT_TYPES.map((type) => ({
    value: type,
    label: ACCOUNT_TYPE_LABELS[type],
}));

const nonnegativeMoney = moneySchema({ min: 'nonnegative' });

/** Cheque especial: opcional (vazio é zero) e nunca negativo. */
const optionalMoney = z.string().transform((text, ctx): Cents => {
    if (text.trim() === '') return 0 as Cents;
    const result = nonnegativeMoney.safeParse(text);
    if (!result.success) {
        for (const issue of result.error.issues) {
            ctx.issues.push({ code: 'custom', message: issue.message, input: text });
        }
        return z.NEVER;
    }
    return result.data;
});

/**
 * Criar: banco, tipo, número, descrição, saldo inicial (com a caixa **Saldo inicial negativo**,
 * porque o parser não aceita sinal) e cheque especial. Alterar: banco e saldo inicial não existem
 * no formulário (INV-0011-02).
 */
export function bankAccountSchema(editing: boolean) {
    return z.object({
        bankId: editing ? z.string() : required('Escolha o banco.'),
        type: z.enum(ACCOUNT_TYPES),
        accountNumber: required('Informe o número da conta.'),
        description: required('Informe a descrição.'),
        openingBalance: editing ? z.string().transform(() => 0 as Cents) : nonnegativeMoney,
        negativeOpening: z.boolean(),
        overdraftLimit: optionalMoney,
    });
}

type Values = z.input<ReturnType<typeof bankAccountSchema>>;
type Output = z.output<ReturnType<typeof bankAccountSchema>>;

const FIELD_MAP: ApiFieldMap<Values> = {
    fields: {
        bankId: 'bankId',
        type: 'type',
        accountNumber: 'accountNumber',
        description: 'description',
        openingBalanceCents: 'openingBalance',
        overdraftLimitCents: 'overdraftLimit',
    },
    codes: {
        BANK_ACCOUNT_ALREADY_EXISTS: 'accountNumber',
        BANK_ARCHIVED: 'bankId',
        BANK_NOT_FOUND: 'bankId',
    },
};

/** Corpo do `POST`: o saldo inicial negado quando a caixa está marcada (AC-0011-03). */
export function createBankAccountBody(values: Output): CreateBankAccount {
    const opening = values.openingBalance;
    return {
        bankId: values.bankId,
        type: values.type,
        accountNumber: values.accountNumber.trim(),
        description: values.description.trim(),
        openingBalanceCents: values.negativeOpening && opening !== 0 ? -opening : opening,
        overdraftLimitCents: values.overdraftLimit,
    };
}

/**
 * Corpo do `PATCH`: só os campos alterados (AC-0011-04), e nunca `bankId`, `openingBalanceCents`
 * ou `currentBalanceCents` (INV-0011-02).
 */
export function bankAccountChanges(account: BankAccount, values: Output): UpdateBankAccount {
    const body: UpdateBankAccount = {};
    const accountNumber = values.accountNumber.trim();
    const description = values.description.trim();
    if (values.type !== account.type) body.type = values.type;
    if (accountNumber !== account.accountNumber) body.accountNumber = accountNumber;
    if (description !== account.description) body.description = description;
    if (values.overdraftLimit !== account.overdraftLimitCents) {
        body.overdraftLimitCents = values.overdraftLimit;
    }
    return body;
}

/** Só os bancos ativos (INV-0011-04). */
function bankOptions(banks: readonly Bank[] | undefined): SelectOption[] {
    return sortByText(
        (banks ?? []).filter((bank) => bank.archivedAt === null),
        (bank) => bank.name,
    ).map((bank) => ({ value: bank.id, label: `${bank.febrabanCode} · ${bank.name}` }));
}

export interface BankAccountFormDialogProps {
    /** A conta a alterar; sem ela, cria uma conta. */
    account?: BankAccount;
    onClose: () => void;
}

/** Conta bancária (spec 0011, "Formulários"): `POST /bank-accounts` ou `PATCH /bank-accounts/{id}`. */
export function BankAccountFormDialog({ account, onClose }: BankAccountFormDialogProps) {
    const notify = useNotify();
    const banks = useBanks();
    const save = useSaveBankAccount();
    const editing = account !== undefined;
    const form = useForm<Values, unknown, Output>({
        resolver: zodResolver(bankAccountSchema(editing)),
        defaultValues: {
            bankId: '',
            type: account?.type ?? 'CHECKING',
            accountNumber: account?.accountNumber ?? '',
            description: account?.description ?? '',
            openingBalance: '',
            negativeOpening: false,
            overdraftLimit:
                account && account.overdraftLimitCents > 0
                    ? amountText(account.overdraftLimitCents)
                    : '',
        },
    });
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(async (values) => {
        try {
            if (account) {
                const update = bankAccountChanges(account, values);
                if (Object.keys(update).length > 0) {
                    await save.mutateAsync({ id: account.id, update });
                }
            } else {
                await save.mutateAsync({ create: createBankAccountBody(values) });
            }
        } catch (error) {
            applyApiError(error, form, FIELD_MAP);
            return;
        }
        onClose();
        notify({ tone: 'sucesso', message: 'Conta salva.' });
    });

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={editing ? 'Editar conta' : 'Nova conta'}
            footer={<FormFooter formId={FORM_ID} onCancel={onClose} pending={save.isPending} />}
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                {!editing && (
                    <SelectField
                        label="Banco"
                        placeholder="Escolha o banco"
                        options={bankOptions(banks.data)}
                        error={errors.bankId?.message}
                        {...register('bankId')}
                    />
                )}
                <SelectField
                    label="Tipo"
                    options={TYPE_OPTIONS}
                    error={errors.type?.message}
                    {...register('type')}
                />
                <Field label="Número da conta" error={errors.accountNumber?.message}>
                    {(field) => (
                        <Input
                            {...field}
                            autoComplete="off"
                            className="font-mono"
                            {...register('accountNumber')}
                        />
                    )}
                </Field>
                <Field label="Descrição" error={errors.description?.message}>
                    {(field) => <Input {...field} {...register('description')} />}
                </Field>
                {editing ? (
                    <section aria-label="Saldos" className="flex flex-col gap-2">
                        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <dt className="text-rotulo text-texto-apoio">Saldo inicial</dt>
                                <dd>
                                    <Money
                                        cents={account.openingBalanceCents}
                                        sign="auto"
                                        tone="neutral"
                                    />
                                </dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="text-rotulo text-texto-apoio">Saldo atual</dt>
                                <dd>
                                    <Money
                                        cents={account.currentBalanceCents}
                                        sign="auto"
                                        tone="neutral"
                                    />
                                </dd>
                            </div>
                        </dl>
                        <p className="text-pequeno text-texto-apoio">
                            O saldo só muda por lançamentos.
                        </p>
                    </section>
                ) : (
                    <div className="flex flex-col gap-2">
                        <Controller
                            control={control}
                            name="openingBalance"
                            render={({ field, fieldState }) => (
                                <MoneyInput
                                    label="Saldo inicial"
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-corpo text-texto">
                            <input
                                type="checkbox"
                                className="size-5 accent-acento"
                                {...register('negativeOpening')}
                            />
                            Saldo inicial negativo
                        </label>
                    </div>
                )}
                <Controller
                    control={control}
                    name="overdraftLimit"
                    render={({ field, fieldState }) => (
                        <MoneyInput
                            label="Cheque especial (opcional)"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            error={fieldState.error?.message}
                        />
                    )}
                />
            </form>
        </FormDialog>
    );
}
