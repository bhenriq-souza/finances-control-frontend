import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyApiError } from '@/api/errors/form-errors';
import type { EarningType } from '@/api/queries/reference';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import { useSaveEarningType } from './api';

const FORM_ID = 'tipo-de-receita';

const schema = z.object({
    name: z.string().trim().min(1, 'Informe o nome.'),
});

type Values = z.infer<typeof schema>;

export interface EarningTypeFormDialogProps {
    /** Sem tipo, cria; com tipo, renomeia. */
    earningType?: EarningType;
    onClose: () => void;
}

/**
 * Criar ou renomear um tipo de receita (spec 0014, padrão de **cadastro** da spec 0009). O nome é
 * o único campo; `EARNING_TYPE_ALREADY_EXISTS` marca o nome (AC-0014-08). Um erro da API mantém o
 * diálogo aberto com o que foi digitado (INV-0009-06).
 */
export function EarningTypeFormDialog({ earningType, onClose }: EarningTypeFormDialogProps) {
    const notify = useNotify();
    const save = useSaveEarningType();
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { name: earningType?.name ?? '' },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(({ name }) => {
        if (earningType && name === earningType.name) {
            onClose();
            return;
        }
        save.mutate(
            { id: earningType?.id, name },
            {
                onSuccess: () => {
                    onClose();
                    notify({
                        tone: 'sucesso',
                        message: earningType
                            ? 'Tipo de receita renomeado.'
                            : 'Tipo de receita criado.',
                    });
                },
                onError: (error) =>
                    applyApiError(error, form, {
                        fields: { name: 'name' },
                        codes: { EARNING_TYPE_ALREADY_EXISTS: 'name' },
                    }),
            },
        );
    });

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={earningType ? 'Renomear tipo de receita' : 'Novo tipo de receita'}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} disabled={save.isPending}>
                        Salvar
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <Field label="Nome" error={errors.name?.message}>
                    {(control) => <Input {...control} autoComplete="off" {...register('name')} />}
                </Field>
            </form>
        </FormDialog>
    );
}
