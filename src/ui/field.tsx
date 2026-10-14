import { useId, type ReactNode } from 'react';

import { Label } from './components/ui/label';

export interface FieldProps {
    /** Rótulo visível, sempre presente (spec 0009, _Campos e erros_). */
    label: string;
    /** Texto de ajuda abaixo do controle. */
    help?: string;
    /** Mensagem de erro já em pt-BR. */
    error?: string;
    /** `id` do controle; sem ele, um gerado. */
    id?: string;
}

export interface FieldControlProps {
    id: string;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
}

/**
 * Rótulo, ajuda e erro em volta de um controle nativo: o erro e a ajuda ficam ligados ao controle
 * por `aria-describedby`, e o erro marca `aria-invalid`.
 */
export function Field({
    label,
    help,
    error,
    id,
    children,
}: FieldProps & { children: (control: FieldControlProps) => ReactNode }) {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const helpId = `${controlId}-ajuda`;
    const errorId = `${controlId}-erro`;
    const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ');

    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={controlId}>{label}</Label>
            {children({
                id: controlId,
                'aria-invalid': error ? true : undefined,
                'aria-describedby': describedBy || undefined,
            })}
            {help && (
                <p id={helpId} className="text-pequeno text-texto-apoio">
                    {help}
                </p>
            )}
            {error && (
                <p id={errorId} className="text-pequeno text-negativo">
                    {error}
                </p>
            )}
        </div>
    );
}
