import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import type { Bank } from '@/api/queries/reference';
import { Input } from '@/ui/components/ui/input';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import { useSaveBank, type UpdateBank } from './api';
import { FormFooter, required } from './form-parts';

const FORM_ID = 'banco-formulario';

/** Criar: código FEBRABAN e nome. Alterar: só o nome (o código é a identidade do banco). */
export function bankSchema(editing: boolean) {
    return z.object({
        febrabanCode: editing
            ? z.string()
            : z
                  .string()
                  .trim()
                  .regex(/^[0-9]{3}$/, 'Use os três dígitos do código FEBRABAN.'),
        name: required('Informe o nome.'),
    });
}

type Values = z.input<ReturnType<typeof bankSchema>>;

const FIELD_MAP: ApiFieldMap<Values> = {
    fields: { febrabanCode: 'febrabanCode', name: 'name' },
    codes: { BANK_ALREADY_EXISTS: 'febrabanCode' },
};

export interface BankFormDialogProps {
    /** O banco a alterar; sem ele, cria um banco. */
    bank?: Bank;
    onClose: () => void;
}

/** Banco (spec 0011, "Formulários"): `POST /banks` ou `PATCH /banks/{id}` só com o nome. */
export function BankFormDialog({ bank, onClose }: BankFormDialogProps) {
    const notify = useNotify();
    const save = useSaveBank();
    const editing = bank !== undefined;
    const form = useForm<Values>({
        resolver: zodResolver(bankSchema(editing)),
        defaultValues: { febrabanCode: bank?.febrabanCode ?? '', name: bank?.name ?? '' },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(async (values) => {
        const name = values.name.trim();
        try {
            if (bank) {
                const update: UpdateBank = { name };
                if (name !== bank.name) await save.mutateAsync({ id: bank.id, update });
            } else {
                await save.mutateAsync({
                    create: { febrabanCode: values.febrabanCode.trim(), name },
                });
            }
        } catch (error) {
            applyApiError(error, form, FIELD_MAP);
            return;
        }
        onClose();
        notify({ tone: 'sucesso', message: 'Banco salvo.' });
    });

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={editing ? 'Editar banco' : 'Novo banco'}
            description={editing ? `Código FEBRABAN ${bank.febrabanCode}.` : undefined}
            footer={<FormFooter formId={FORM_ID} onCancel={onClose} pending={save.isPending} />}
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                {!editing && (
                    <Field
                        label="Código FEBRABAN"
                        help="Três dígitos, ex.: 341."
                        error={errors.febrabanCode?.message}
                    >
                        {(control) => (
                            <Input
                                {...control}
                                inputMode="numeric"
                                maxLength={3}
                                autoComplete="off"
                                className="font-mono"
                                {...register('febrabanCode')}
                            />
                        )}
                    </Field>
                )}
                <Field label="Nome" error={errors.name?.message}>
                    {(control) => <Input {...control} autoComplete="off" {...register('name')} />}
                </Field>
            </form>
        </FormDialog>
    );
}
