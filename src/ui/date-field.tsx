import type { ComponentProps } from 'react';

import { Input } from './components/ui/input';
import { Field, type FieldProps } from './field';

export type DateFieldProps = FieldProps & Omit<ComponentProps<'input'>, 'id' | 'type'>;

/**
 * Data com `<input type="date">` nativo (spec 0009): o valor já é `YYYY-MM-DD`, o formato da API,
 * sem conversão. Use com `register` do react-hook-form.
 */
export function DateField({ label, help, error, id, ...props }: DateFieldProps) {
    return (
        <Field label={label} help={help} error={error} id={id}>
            {(control) => <Input {...control} {...props} type="date" />}
        </Field>
    );
}
