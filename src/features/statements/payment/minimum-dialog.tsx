import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { applyApiError } from '@/api/errors/form-errors';
import { formatBRL } from '@/shared/money';
import { Button } from '@/ui/components/ui/button';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { MoneyInput } from '@/ui/money-input';
import { useNotify } from '@/ui/notice';

import type { Statement } from '../panel/statement-model';

import { useUpdateMinimum } from './payment-api';
import { minimumSchema, type MinimumOutput, type MinimumValues } from './payment-model';

const FORM_ID = 'informar-minimo';

export const MINIMUM_HELP =
    'O valor mínimo que o banco cobra. O sistema não calcula o mínimo; ele só decide quando a fatura fica vencida.';

export const MINIMUM_NOTICE = 'Mínimo informado.';

export interface MinimumDialogProps {
    statement: Statement & { id: string };
    onClose: () => void;
}

/** Texto do `MoneyInput` para um valor salvo: `1.234,56`, como ele mesmo formata. */
function amountText(cents: number): string {
    return formatBRL(cents, { sign: 'never' }).replace(/^R\$\s*/, '');
}

/**
 * **Informar mínimo** (spec 0013, "Mínimo"): `MoneyInput` com `moneySchema({ min: 'nonnegative' })`
 * → `PATCH /statements/{id}` `{ minimumPaymentCents }`. Sem **Remover mínimo** (lacuna do contrato).
 */
export function MinimumDialog({ statement, onClose }: MinimumDialogProps) {
    const notify = useNotify();
    const update = useUpdateMinimum(statement.id);
    const form = useForm<MinimumValues, unknown, MinimumOutput>({
        resolver: zodResolver(minimumSchema),
        defaultValues: {
            minimum:
                statement.minimumPaymentCents === null
                    ? ''
                    : amountText(statement.minimumPaymentCents),
        },
    });
    const {
        control,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(({ minimum }) => {
        update.mutate(minimum, {
            onSuccess: () => {
                onClose();
                notify({ tone: 'sucesso', message: MINIMUM_NOTICE });
            },
            onError: (error) =>
                applyApiError(error, form, { fields: { minimumPaymentCents: 'minimum' } }),
        });
    });

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Informar mínimo"
            description={MINIMUM_HELP}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} disabled={update.isPending}>
                        Salvar
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <Controller
                    control={control}
                    name="minimum"
                    render={({ field, fieldState }) => (
                        <MoneyInput
                            label="Mínimo"
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
