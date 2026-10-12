import { useId, type ComponentProps } from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';

import { Input } from '@/ui/components/ui/input';
import { Label } from '@/ui/components/ui/label';

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
    label: string;
    registration: UseFormRegisterReturn;
    error?: FieldError;
};

/** Campo com rótulo e erro ligado por `aria-describedby` (spec 0006, acessibilidade). */
export function TextField({ label, registration, error, ...props }: TextFieldProps) {
    const id = useId();
    const errorId = `${id}-erro`;
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                {...props}
                {...registration}
            />
            {error && (
                <p id={errorId} className="text-pequeno text-negativo">
                    {error.message}
                </p>
            )}
        </div>
    );
}
