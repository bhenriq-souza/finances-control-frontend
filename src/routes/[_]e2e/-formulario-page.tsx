import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { DateField } from '@/ui/date-field';
import { Field } from '@/ui/field';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';
import { SelectField } from '@/ui/select-field';

/**
 * O marcador do gate `build` (spec 0002): exibido pela página, sobrevive ao tree-shaking do build
 * `e2e`, e o gate falha se ele chegar a `dist/` — prova de que a página ficou fora da produção.
 */
export const E2E_PROOF_MARKER = '__E2E_FAKE_AUTH__';

const FORM_ID = 'prova-formulario';

const schema = z.object({
    name: z.string().trim().min(1, 'Informe o nome.'),
    paidWith: z.string().min(1, 'Escolha a conta ou o cartão.'),
    occurredOn: z.string().min(1, 'Informe a data.'),
});

type Values = z.infer<typeof schema>;

// Dados estáticos: a página de prova não chama a API.
const PAID_WITH = [
    {
        label: 'Contas',
        options: [
            { value: 'conta-corrente', label: 'Conta corrente' },
            { value: 'poupanca', label: 'Poupança' },
        ],
    },
    { label: 'Cartões', options: [{ value: 'visa', label: 'Cartão Visa' }] },
];

function ExpenseFormDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const notify = useNotify();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', paidWith: '', occurredOn: '2026-10-12' },
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Nova despesa"
            description="Os dados ficam só nesta página de prova."
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID}>
                        Salvar
                    </Button>
                </>
            }
        >
            <form
                id={FORM_ID}
                noValidate
                className="flex flex-col gap-4"
                onSubmit={handleSubmit(() => {
                    onOpenChange(false);
                    notify({ tone: 'sucesso', message: 'Despesa salva.' });
                })}
            >
                <Field label="Descrição" error={errors.name?.message}>
                    {(control) => <Input {...control} {...register('name')} />}
                </Field>
                <SelectField
                    label="Pagar com"
                    placeholder="Escolha a conta ou o cartão"
                    options={PAID_WITH}
                    error={errors.paidWith?.message}
                    {...register('paidWith')}
                />
                <DateField
                    label="Data"
                    help="A data em que a despesa aconteceu."
                    error={errors.occurredOn?.message}
                    {...register('occurredOn')}
                />
            </form>
        </FormDialog>
    );
}

export function FormProofPage() {
    const notify = useNotify();
    const [formOpen, setFormOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    return (
        <main
            data-e2e-marker={E2E_PROOF_MARKER}
            className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 text-texto md:px-6"
        >
            <h1 className="text-titulo-1">Prova — Formulários</h1>
            <div className="flex flex-wrap gap-3">
                <Button onClick={() => setFormOpen(true)}>Nova despesa</Button>
                <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                    Excluir despesa
                </Button>
            </div>
            {/* Desmontado ao fechar: abrir de novo começa com o formulário limpo. */}
            {formOpen && <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} />}
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Excluir a despesa?"
                description="A despesa Mercado, de R$ 234,90, será excluída. Essa ação não pode ser desfeita."
                confirmLabel="Excluir"
                destructive
                onConfirm={() => {
                    setConfirmOpen(false);
                    notify({ tone: 'sucesso', message: 'Despesa excluída.' });
                }}
            />
        </main>
    );
}
