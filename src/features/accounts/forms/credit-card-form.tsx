import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import {
    type Bank,
    type BankAccount,
    type CreditCard,
    useBankAccounts,
    useBanks,
} from '@/api/queries/reference';
import { moneySchema } from '@/shared/money';
import { Input } from '@/ui/components/ui/input';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { MoneyInput } from '@/ui/money-input';
import { useNotify } from '@/ui/notice';
import { SelectField, type SelectOption } from '@/ui/select-field';

import { sortByText } from '../list-parts';

import { type CreateCreditCard, type UpdateCreditCard, useSaveCreditCard } from './api';
import { amountText, FormFooter, required } from './form-parts';

const FORM_ID = 'cartao-formulario';

export const DAY_MESSAGE = 'Use um dia de 1 a 31.';

/** Dia do mês, de 1 a 31, digitado como texto. */
const day = z
    .string()
    .trim()
    .regex(/^[0-9]{1,2}$/, DAY_MESSAGE)
    .transform(Number)
    .refine((value) => value >= 1 && value <= 31, DAY_MESSAGE);

/** Criar: banco, nome, limite (> 0), dias de fechamento e vencimento e conta pagadora opcional. */
export function creditCardSchema(editing: boolean) {
    return z.object({
        bankId: editing ? z.string() : required('Escolha o banco.'),
        name: required('Informe o nome.'),
        creditLimit: moneySchema(),
        closingDay: day,
        dueDay: day,
        paymentBankAccountId: z.string(),
    });
}

type Values = z.input<ReturnType<typeof creditCardSchema>>;
type Output = z.output<ReturnType<typeof creditCardSchema>>;

const FIELD_MAP: ApiFieldMap<Values> = {
    fields: {
        bankId: 'bankId',
        name: 'name',
        creditLimitCents: 'creditLimit',
        closingDay: 'closingDay',
        dueDay: 'dueDay',
        paymentBankAccountId: 'paymentBankAccountId',
    },
    codes: {
        CREDIT_CARD_ALREADY_EXISTS: 'name',
        BANK_ARCHIVED: 'bankId',
        BANK_NOT_FOUND: 'bankId',
        // Fora dos `409` documentados no `PATCH` do contrato `v1.1.0`, tratado pelo `code` (spec 0011).
        BANK_ACCOUNT_ARCHIVED: 'paymentBankAccountId',
        BANK_ACCOUNT_NOT_FOUND: 'paymentBankAccountId',
    },
};

/** Corpo do `POST`: a conta pagadora só quando escolhida. */
export function createCreditCardBody(values: Output): CreateCreditCard {
    return {
        bankId: values.bankId,
        name: values.name.trim(),
        creditLimitCents: values.creditLimit,
        closingDay: values.closingDay,
        dueDay: values.dueDay,
        ...(values.paymentBankAccountId
            ? { paymentBankAccountId: values.paymentBankAccountId }
            : {}),
    };
}

/** Corpo do `PATCH`: só os campos alterados, nunca `bankId` (INV-0011-02); conta vazia é `null`. */
export function creditCardChanges(card: CreditCard, values: Output): UpdateCreditCard {
    const body: UpdateCreditCard = {};
    const name = values.name.trim();
    const payment = values.paymentBankAccountId || null;
    if (name !== card.name) body.name = name;
    if (values.creditLimit !== card.creditLimitCents) body.creditLimitCents = values.creditLimit;
    if (values.closingDay !== card.closingDay) body.closingDay = values.closingDay;
    if (values.dueDay !== card.dueDay) body.dueDay = values.dueDay;
    if (payment !== card.paymentBankAccountId) body.paymentBankAccountId = payment;
    return body;
}

/** Só os bancos ativos (INV-0011-04). */
function bankOptions(banks: readonly Bank[] | undefined): SelectOption[] {
    return sortByText(
        (banks ?? []).filter((bank) => bank.archivedAt === null),
        (bank) => bank.name,
    ).map((bank) => ({ value: bank.id, label: `${bank.febrabanCode} · ${bank.name}` }));
}

/**
 * Só as contas ativas (INV-0011-04). A conta pagadora atual, se arquivada, continua na lista para
 * o select mostrar o valor salvo — sem ela o formulário trocaria a conta por "nenhuma" sem a
 * pessoa pedir.
 */
function accountOptions(
    accounts: readonly BankAccount[] | undefined,
    current: string | null,
): SelectOption[] {
    return sortByText(
        (accounts ?? []).filter((account) => account.archivedAt === null || account.id === current),
        (account) => account.description,
    ).map((account) => ({
        value: account.id,
        label:
            account.archivedAt === null
                ? account.description
                : `${account.description} (arquivada)`,
    }));
}

export interface CreditCardFormDialogProps {
    /** O cartão a alterar; sem ele, cria um cartão. */
    card?: CreditCard;
    onClose: () => void;
}

/** Cartão de crédito (spec 0011, "Formulários"): `POST /credit-cards` ou `PATCH /credit-cards/{id}`. */
export function CreditCardFormDialog({ card, onClose }: CreditCardFormDialogProps) {
    const notify = useNotify();
    const banks = useBanks();
    const accounts = useBankAccounts();
    const save = useSaveCreditCard();
    const editing = card !== undefined;
    const form = useForm<Values, unknown, Output>({
        resolver: zodResolver(creditCardSchema(editing)),
        defaultValues: {
            bankId: '',
            name: card?.name ?? '',
            creditLimit: card ? amountText(card.creditLimitCents) : '',
            closingDay: card ? String(card.closingDay) : '',
            dueDay: card ? String(card.dueDay) : '',
            paymentBankAccountId: card?.paymentBankAccountId ?? '',
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
            if (card) {
                const update = creditCardChanges(card, values);
                if (Object.keys(update).length > 0) {
                    await save.mutateAsync({ id: card.id, update });
                }
            } else {
                await save.mutateAsync({ create: createCreditCardBody(values) });
            }
        } catch (error) {
            applyApiError(error, form, FIELD_MAP);
            return;
        }
        onClose();
        notify({ tone: 'sucesso', message: 'Cartão salvo.' });
    });

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={editing ? 'Editar cartão' : 'Novo cartão'}
            description={
                editing
                    ? 'Mudar o limite muda o disponível na mesma diferença. Mudar os dias vale só para ciclos ainda não fechados.'
                    : undefined
            }
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
                <Field label="Nome" error={errors.name?.message}>
                    {(field) => <Input {...field} autoComplete="off" {...register('name')} />}
                </Field>
                <Controller
                    control={control}
                    name="creditLimit"
                    render={({ field, fieldState }) => (
                        <MoneyInput
                            label="Limite"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            error={fieldState.error?.message}
                        />
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Dia de fechamento" error={errors.closingDay?.message}>
                        {(field) => (
                            <Input
                                {...field}
                                inputMode="numeric"
                                maxLength={2}
                                autoComplete="off"
                                {...register('closingDay')}
                            />
                        )}
                    </Field>
                    <Field label="Dia de vencimento" error={errors.dueDay?.message}>
                        {(field) => (
                            <Input
                                {...field}
                                inputMode="numeric"
                                maxLength={2}
                                autoComplete="off"
                                {...register('dueDay')}
                            />
                        )}
                    </Field>
                </div>
                <SelectField
                    label="Conta pagadora (opcional)"
                    placeholder="Nenhuma"
                    options={accountOptions(accounts.data, card?.paymentBankAccountId ?? null)}
                    error={errors.paymentBankAccountId?.message}
                    {...register('paymentBankAccountId')}
                />
            </form>
        </FormDialog>
    );
}
