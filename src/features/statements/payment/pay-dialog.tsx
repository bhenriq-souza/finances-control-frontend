import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';

import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import { useBankAccounts, useCreditCards } from '@/api/queries/reference';
import { formatMonth, monthOf, today } from '@/shared/dates';
import { formatBRL } from '@/shared/money';
import { Alert } from '@/ui/components/ui/alert';
import { Button } from '@/ui/components/ui/button';
import { DateField } from '@/ui/date-field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { MoneyInput } from '@/ui/money-input';
import { useNotify } from '@/ui/notice';
import { SelectField } from '@/ui/select-field';
import { Skeleton } from '@/ui/skeleton';

import { statementHref, statementsListQuery, type Statement } from '../panel/statement-model';

import { usePayStatement } from './payment-api';
import {
    minimumDueCents,
    paidOnWindow,
    paymentSchema,
    pendingStatement,
    type PaymentOutput,
    type PaymentValues,
} from './payment-model';

const FORM_ID = 'pagar-fatura';

export const PAYMENT_NOTICE = 'Pagamento registrado.';

const FIELD_MAP: ApiFieldMap<PaymentValues> = {
    fields: { amountCents: 'choice', bankAccountId: 'bankAccountId', paidOn: 'paidOn' },
    codes: {
        STATEMENT_PAYMENT_EXCEEDS_REMAINING: 'choice',
        BANK_ACCOUNT_ARCHIVED: 'bankAccountId',
        BANK_ACCOUNT_NOT_FOUND: 'bankAccountId',
    },
};

export interface PayDialogProps {
    statement: Statement;
    onClose: () => void;
}

/**
 * **Pagar fatura** (spec 0013, "Pagar"): valor (total restante, mínimo ou outro), conta (padrão a
 * pagadora do cartão) e data. O erro da API fica no campo ou no alerta, com o diálogo aberto.
 */
export function PayDialog({ statement, onClose }: PayDialogProps) {
    const accounts = useBankAccounts();
    const cards = useCreditCards();
    const ready = accounts.data !== undefined && cards.data !== undefined;

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Pagar fatura"
            description={`Fatura de ${formatMonth(monthOf(statement.closesOn))}`}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} disabled={!ready}>
                        Pagar
                    </Button>
                </>
            }
        >
            {ready ? (
                <PayForm
                    statement={statement}
                    onClose={onClose}
                    accountOptions={accounts.data
                        .filter((account) => account.archivedAt === null)
                        .map((account) => ({ value: account.id, label: account.description }))}
                    payingAccountId={
                        cards.data.find((card) => card.id === statement.creditCardId)
                            ?.paymentBankAccountId ?? null
                    }
                />
            ) : (
                <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-11 w-full" />
                </div>
            )}
        </FormDialog>
    );
}

function PayForm({
    statement,
    onClose,
    accountOptions,
    payingAccountId,
}: PayDialogProps & {
    accountOptions: { value: string; label: string }[];
    payingAccountId: string | null;
}) {
    const notify = useNotify();
    const pay = usePayStatement(statement);
    // A lista sem janela, para achar a fatura pendente de `STATEMENT_PREVIOUS_UNPAID`.
    const list = useQuery(statementsListQuery(statement.creditCardId));
    const day = today();
    const schema = useMemo(() => paymentSchema(statement, day), [statement, day]);
    const window = paidOnWindow(statement, day);
    const minimum = minimumDueCents(statement);
    // Só a conta pagadora ativa é padrão (INV-0011-04: o select só tem as ativas).
    const defaultAccount = accountOptions.some((option) => option.value === payingAccountId)
        ? (payingAccountId ?? '')
        : '';

    const form = useForm<PaymentValues, unknown, PaymentOutput>({
        resolver: zodResolver(schema),
        defaultValues: { choice: 'total', other: '', bankAccountId: defaultAccount, paidOn: day },
    });
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = form;
    const choice = useWatch({ control, name: 'choice' });

    const onSubmit = handleSubmit((payment) => {
        pay.mutate(payment, {
            onSuccess: () => {
                onClose();
                notify({ tone: 'sucesso', message: PAYMENT_NOTICE });
            },
            onError: (error) => applyApiError(error, form, FIELD_MAP),
        });
    });

    const alert = errors.root?.api;
    const pending =
        alert?.type === 'STATEMENT_PREVIOUS_UNPAID' ? pendingStatement(list.data) : undefined;

    return (
        <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
            {pending ? (
                <Alert role="alert" variant="negativo" className="flex flex-col gap-1">
                    <span>{alert?.message}</span>
                    <Link
                        to={statementHref(statement.creditCardId, pending.id)}
                        className="self-start rounded-sm text-acento underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-foco"
                    >
                        Ver a fatura de {formatMonth(monthOf(pending.closesOn))}
                    </Link>
                </Alert>
            ) : (
                <FormAlert message={alert?.message} />
            )}
            <fieldset
                className="flex flex-col gap-2"
                aria-describedby={errors.choice ? 'pagar-valor-erro' : undefined}
            >
                <legend className="mb-2 text-rotulo text-texto">Valor</legend>
                <RadioOption value="total" register={register('choice')}>
                    Total restante · {formatBRL(statement.remainingCents)}
                </RadioOption>
                {minimum !== null && (
                    <RadioOption value="minimo" register={register('choice')}>
                        Mínimo · {formatBRL(minimum)}
                    </RadioOption>
                )}
                <RadioOption value="outro" register={register('choice')}>
                    Outro valor
                </RadioOption>
                {errors.choice?.message && (
                    <p id="pagar-valor-erro" className="text-pequeno text-negativo">
                        {errors.choice.message}
                    </p>
                )}
            </fieldset>
            {choice === 'outro' && (
                <Controller
                    control={control}
                    name="other"
                    render={({ field, fieldState }) => (
                        <MoneyInput
                            label="Outro valor"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            error={fieldState.error?.message}
                        />
                    )}
                />
            )}
            <SelectField
                label="Conta"
                placeholder="Escolha a conta"
                options={accountOptions}
                error={errors.bankAccountId?.message}
                {...register('bankAccountId')}
            />
            <DateField
                label="Pago em"
                min={window.min}
                max={window.max}
                control={form.control}
                name="paidOn"
            />
        </form>
    );
}

function RadioOption({
    value,
    register,
    children,
}: {
    value: PaymentValues['choice'];
    register: UseFormRegisterReturn;
    children: ReactNode;
}) {
    return (
        <label className="flex min-h-11 items-center gap-2 text-corpo text-texto">
            <input type="radio" value={value} className="size-4 accent-acento" {...register} />
            {children}
        </label>
    );
}
