import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { applyApiError } from '@/api/errors/form-errors';
import { Button } from '@/ui/components/ui/button';
import { DateField } from '@/ui/date-field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import { type EarningRecurrence, useEndEarningRecurrence } from './api';
import {
    defaultEndsOn,
    END_EFFECT_TEXT,
    endRecurrenceSchema,
    type EndRecurrenceValues,
} from './recurrence-model';

const FORM_ID = 'serie-receita-encerrar';

export interface EndEarningRecurrenceDialogProps {
    recurrence: EarningRecurrence;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * **Encerrar série** (spec 0017): o efeito à vista antes do envio (INV-0017-02) e
 * `PATCH /earning-recurrences/{id}` só com `{ endsOn }` (INV-0017-01). Erro de `endsOn` vai ao
 * campo; o resto, ao alerta dentro do diálogo, que continua aberto (ERR-0017-01).
 */
export function EndEarningRecurrenceDialog({
    recurrence,
    open,
    onOpenChange,
}: EndEarningRecurrenceDialogProps) {
    const notify = useNotify();
    const end = useEndEarningRecurrence(recurrence.id);
    const form = useForm<EndRecurrenceValues>({
        resolver: zodResolver(endRecurrenceSchema(recurrence.startsOn)),
        defaultValues: { endsOn: defaultEndsOn(recurrence) },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(async ({ endsOn }) => {
        try {
            await end.mutateAsync({ endsOn });
            onOpenChange(false);
            notify({ tone: 'sucesso', message: 'Série encerrada.' });
        } catch (error) {
            applyApiError(error, form, { fields: { endsOn: 'endsOn' } });
        }
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Encerrar a série?"
            description={END_EFFECT_TEXT}
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} disabled={end.isPending}>
                        Encerrar série
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <DateField
                    label="Último mês"
                    min={recurrence.startsOn}
                    error={errors.endsOn?.message}
                    {...register('endsOn')}
                />
            </form>
        </FormDialog>
    );
}
