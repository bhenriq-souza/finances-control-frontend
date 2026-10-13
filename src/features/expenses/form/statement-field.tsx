import { useState, type ComponentProps } from 'react';

import { Button } from '@/ui/components/ui/button';
import { DateField } from '@/ui/date-field';

/** `2026-11-03` → `03/11`. */
export function closingText(closesOn: string): string {
    const [, month, day] = closesOn.split('-');
    return `${day}/${month}`;
}

export interface StatementFieldProps {
    /** `currentCycle.closesOn` do cartão escolhido; sem ele, o texto fica só com a primeira frase. */
    closesOn: string | undefined;
    /** Já abre o campo **Fatura de** (alterar uma despesa com a fatura em outra data). */
    initiallyOpen?: boolean;
    error?: string;
    /** `register('postedOn')`. */
    field: Omit<ComponentProps<'input'>, 'id' | 'type'>;
}

/**
 * **Fatura de** recolhido (spec 0012, "Fatura do cartão"): fechado, o texto da fatura atual e o
 * link **Lançar em outra fatura**; aberto, o `DateField` opcional. Compartilhado pelo formulário e
 * por **Trocar forma de pagamento**.
 */
export function StatementField({
    closesOn,
    initiallyOpen = false,
    error,
    field,
}: StatementFieldProps) {
    // Desmontar o componente (sair do cartão) recolhe o campo de novo.
    const [open, setOpen] = useState(initiallyOpen);
    if (open) {
        return (
            <DateField
                label="Fatura de"
                help="A despesa entra na fatura que contém esta data."
                error={error}
                {...field}
            />
        );
    }
    return (
        <div className="flex flex-col items-start gap-1">
            <p className="text-pequeno text-texto-apoio">
                Entra na fatura da data da compra.
                {closesOn ? ` A fatura atual fecha em ${closingText(closesOn)}.` : ''}
            </p>
            <Button variant="link" onClick={() => setOpen(true)}>
                Lançar em outra fatura
            </Button>
        </div>
    );
}
