import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { applyApiError } from '@/api/errors/form-errors';
import { useBankAccounts, useCreditCards } from '@/api/queries/reference';
import { Alert } from '@/ui/components/ui/alert';
import { Button } from '@/ui/components/ui/button';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';
import { SelectField } from '@/ui/select-field';

import { StatementField } from '../../form/statement-field';

import { ActionAlert } from './action-alert';
import { paymentMethodSchema, type PaymentMethodValues } from './action-schemas';
import {
    INSTALLMENT_METHOD_NOTE,
    parsePaymentMethod,
    paymentMethodOptions,
    type PaymentMethod,
} from './expense-action-model';
import {
    type ChangePaymentMethodBody,
    useActionErrorEffects,
    useChangePaymentMethod,
} from './mutations';
import type { ActionDialogProps } from './status-dialogs';

const FORM_ID = 'despesa-forma-de-pagamento';

/** Conta ou cartão arquivado ou inexistente: campo "Pagar com". */
const METHOD_CODES = {
    BANK_ACCOUNT_ARCHIVED: 'method',
    BANK_ACCOUNT_NOT_FOUND: 'method',
    CREDIT_CARD_ARCHIVED: 'method',
    CREDIT_CARD_NOT_FOUND: 'method',
} as const;

/** Exatamente um de `bankAccountId`/`creditCardId`; `postedOn` só com cartão e se informado. */
export function paymentMethodBody(
    method: PaymentMethod,
    postedOn: string,
): ChangePaymentMethodBody {
    if (method.kind === 'conta') return { bankAccountId: method.id };
    return { creditCardId: method.id, ...(postedOn ? { postedOn } : {}) };
}

/**
 * **Trocar forma de pagamento** (não paga): "Pagar com" entre as contas e os cartões ativos, exceto
 * o atual; com cartão, a fatura opcional; numa série, **Só esta** ou **Esta e as próximas
 * previstas** → `PATCH /expenses/{id}/payment-method[?scope=following]`.
 */
export function PaymentMethodDialog({
    expense,
    open,
    onOpenChange,
    onBackToList,
}: ActionDialogProps) {
    const notify = useNotify();
    const onActionError = useActionErrorEffects(onBackToList);
    const change = useChangePaymentMethod(expense.id);
    const accounts = useBankAccounts();
    const cards = useCreditCards();
    const options = useMemo(
        () => paymentMethodOptions(expense, accounts.data ?? [], cards.data ?? []),
        [expense, accounts.data, cards.data],
    );
    const schema = useMemo(() => paymentMethodSchema(expense.occurredOn), [expense.occurredOn]);
    const form = useForm<PaymentMethodValues>({
        resolver: zodResolver(schema),
        defaultValues: { method: '', postedOn: '', scope: 'single' },
    });
    const {
        register,
        handleSubmit,
        control,
        setValue,
        formState: { errors },
    } = form;
    const chosen = parsePaymentMethod(useWatch({ control, name: 'method' }));
    const toCard = chosen?.kind === 'cartao';
    // Sem cartão de destino, a fatura recolhe e o valor digitado se perde.
    useEffect(() => {
        if (!toCard) setValue('postedOn', '');
    }, [toCard, setValue]);
    const series = expense.recurrenceId !== null;

    const onSubmit = handleSubmit(async ({ method, postedOn, scope }) => {
        const target = parsePaymentMethod(method);
        if (!target) return;
        try {
            await change.mutateAsync({
                body: paymentMethodBody(target, postedOn),
                scope: series && scope === 'following' ? 'following' : undefined,
            });
            onOpenChange(false);
            notify({ tone: 'sucesso', message: 'Forma de pagamento trocada.' });
        } catch (error) {
            if (onActionError(error)) return;
            // `STATEMENT_CLOSED` marca a fatura quando ela foi informada (campo aberto); senão,
            // vai para o alerta.
            applyApiError(error, form, {
                fields: { bankAccountId: 'method', creditCardId: 'method', postedOn: 'postedOn' },
                codes: {
                    ...METHOD_CODES,
                    ...(target.kind === 'cartao' && postedOn
                        ? { STATEMENT_CLOSED: 'postedOn' as const }
                        : {}),
                },
            });
        }
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Trocar forma de pagamento"
            description={expense.description}
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} disabled={change.isPending}>
                        Trocar
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <ActionAlert
                    message={errors.root?.api?.message}
                    code={errors.root?.api?.type}
                    cardId={expense.creditCardId}
                />
                {expense.installment && <Alert variant="info">{INSTALLMENT_METHOD_NOTE}</Alert>}
                <SelectField
                    label="Pagar com"
                    placeholder="Escolha a conta ou o cartão"
                    options={options}
                    error={errors.method?.message}
                    {...register('method')}
                />
                {toCard && (
                    <StatementField
                        closesOn={
                            cards.data?.find((item) => item.id === chosen.id)?.currentCycle.closesOn
                        }
                        error={errors.postedOn?.message}
                        field={register('postedOn')}
                    />
                )}
                {series && (
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-rotulo text-texto">Aplicar a</legend>
                        <label className="flex min-h-11 items-center gap-3 text-corpo text-texto">
                            <input
                                type="radio"
                                value="single"
                                className="size-4 accent-acento"
                                {...register('scope')}
                            />
                            Só esta
                        </label>
                        <label className="flex min-h-11 items-center gap-3 text-corpo text-texto">
                            <input
                                type="radio"
                                value="following"
                                className="size-4 accent-acento"
                                {...register('scope')}
                            />
                            Esta e as próximas previstas
                        </label>
                    </fieldset>
                )}
            </form>
        </FormDialog>
    );
}
