import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyApiError } from '@/api/errors/form-errors';
import { isIsoDate, today } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { DateField } from '@/ui/date-field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import type { Earning } from '../../list/earning-model';
import { useChangeEarningStatus } from './api';
import { ACTION_NOTICES } from './transitions';

const FORM_ID = 'receber-receita';

const schema = z.object({
    receivedOn: z.string().refine(isIsoDate, 'Informe a data do recebimento.'),
});

type Values = z.infer<typeof schema>;

export interface ReceiveDialogProps {
    earning: Earning;
    onClose: () => void;
}

/**
 * **Receber** (spec 0014): `receivedOn` com padrão `today()` → `PATCH /earnings/{id}/status`
 * `{ status: 'RECEIVED', receivedOn }`. Um erro da API fica no alerta, com o diálogo aberto
 * (INV-0009-06), também num conflito de status, que recarrega o detalhe (`useChangeEarningStatus`).
 */
export function ReceiveDialog({ earning, onClose }: ReceiveDialogProps) {
    const notify = useNotify();
    const change = useChangeEarningStatus();
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { receivedOn: today() },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(({ receivedOn }) => {
        change.mutate(
            { id: earning.id, body: { status: 'RECEIVED', receivedOn } },
            {
                onSuccess: () => {
                    onClose();
                    notify({ tone: 'sucesso', message: ACTION_NOTICES.receber });
                },
                onError: (error) =>
                    applyApiError(error, form, { fields: { receivedOn: 'receivedOn' } }),
            },
        );
    });

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Receber receita"
            description={earning.description}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} disabled={change.isPending}>
                        Receber
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <DateField
                    label="Recebida em"
                    error={errors.receivedOn?.message}
                    {...register('receivedOn')}
                />
            </form>
        </FormDialog>
    );
}
