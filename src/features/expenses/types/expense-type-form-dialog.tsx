import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyApiError } from '@/api/errors/form-errors';
import type { ExpenseType } from '@/api/queries/reference';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import { useSaveExpenseType } from './mutations';

const FORM_ID = 'tipo-de-despesa';

const schema = z.object({
    name: z.string().trim().min(1, 'Informe o nome.'),
});

type Values = z.infer<typeof schema>;

export interface ExpenseTypeFormDialogProps {
    /** O tipo a renomear; sem ele, o formulário cria um tipo novo. */
    expenseType?: ExpenseType;
    onClose: () => void;
}

/**
 * Criar ou renomear um tipo de despesa (spec 0012): `FormDialog` com o nome.
 * `409 EXPENSE_TYPE_ALREADY_EXISTS` marca o campo nome; o resto vai para o alerta (ERR-0012-01).
 */
export function ExpenseTypeFormDialog({ expenseType, onClose }: ExpenseTypeFormDialogProps) {
    const notify = useNotify();
    const save = useSaveExpenseType();
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { name: expenseType?.name ?? '' },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;
    const renaming = expenseType !== undefined;

    const onSubmit = handleSubmit(async ({ name }) => {
        try {
            await save.mutateAsync({ id: expenseType?.id, name });
        } catch (error) {
            applyApiError(error, form, {
                fields: { name: 'name' },
                codes: { EXPENSE_TYPE_ALREADY_EXISTS: 'name' },
            });
            return;
        }
        onClose();
        notify({
            tone: 'sucesso',
            message: renaming ? 'Tipo de despesa renomeado.' : 'Tipo de despesa salvo.',
        });
    });

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={renaming ? 'Renomear tipo de despesa' : 'Novo tipo de despesa'}
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
