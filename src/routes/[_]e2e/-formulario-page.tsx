import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { dateSchema, optionalDateSchema } from '@/shared/dates';
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
    occurredOn: dateSchema('Informe a data.'),
    dueOn: optionalDateSchema(),
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
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (values: Values) => void;
}) {
    const notify = useNotify();
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', paidWith: '', occurredOn: '2026-10-12', dueOn: '' },
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
                onSubmit={handleSubmit((values) => {
                    onSaved(values);
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
                {/* Calendário limitado a outubro e novembro de 2026 (AC-0009-13). */}
                <DateField
                    control={control}
                    name="occurredOn"
                    label="Data"
                    help="A data em que a despesa aconteceu."
                    min="2026-10-01"
                    max="2026-11-30"
                />
                <DateField control={control} name="dueOn" label="Vencimento" help="Opcional." />
            </form>
        </FormDialog>
    );
}

export function FormProofPage() {
    const notify = useNotify();
    const [formOpen, setFormOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    // O que o último envio mandou, para o e2e conferir o valor (AC-0009-12).
    const [saved, setSaved] = useState<Values | null>(null);

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
            {formOpen && (
                <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={setSaved} />
            )}
            {saved && (
                <section aria-labelledby="ultimo-envio" className="flex flex-col gap-2">
                    <h2 id="ultimo-envio" className="text-titulo-3">
                        Último envio
                    </h2>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-corpo">
                        <dt className="text-texto-apoio">Data</dt>
                        <dd className="font-mono">{JSON.stringify(saved.occurredOn)}</dd>
                        <dt className="text-texto-apoio">Vencimento</dt>
                        <dd className="font-mono">{JSON.stringify(saved.dueOn)}</dd>
                    </dl>
                </section>
            )}
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
