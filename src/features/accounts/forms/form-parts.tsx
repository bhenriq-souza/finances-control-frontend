import { z } from 'zod';

import { formatBRL, type Cents } from '@/shared/money';
import { Button } from '@/ui/components/ui/button';

/** Texto obrigatório, sem os espaços das pontas. */
export const required = (message: string) => z.string().trim().min(1, message);

/** Texto do `MoneyInput` para um valor salvo: `1.234,56`, como ele mesmo formata. */
export function amountText(cents: number): string {
    return formatBRL(cents as Cents, { sign: 'never' }).replace(/^R\$\s*/, '');
}

/** **Cancelar** e **Salvar**, este ligado ao formulário pelo `id`. */
export function FormFooter({
    formId,
    onCancel,
    pending,
}: {
    formId: string;
    onCancel: () => void;
    pending: boolean;
}) {
    return (
        <>
            <Button variant="outline" onClick={onCancel}>
                Cancelar
            </Button>
            <Button type="submit" form={formId} disabled={pending}>
                Salvar
            </Button>
        </>
    );
}
