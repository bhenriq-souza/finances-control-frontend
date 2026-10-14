import { clsx as cn } from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Field, type FieldProps } from './field';

export interface SelectOption {
    value: string;
    label: string;
}

/** Grupo de opções, renderizado como `<optgroup>` (ex.: "Contas" e "Cartões"). */
export interface SelectOptionGroup {
    label: string;
    options: readonly SelectOption[];
}

export type SelectFieldProps = FieldProps &
    Omit<ComponentProps<'select'>, 'id' | 'children'> & {
        options: readonly (SelectOption | SelectOptionGroup)[];
        /** Primeira opção, vazia (`value=""`), ex.: "Escolha uma conta". */
        placeholder?: string;
    };

function isGroup(option: SelectOption | SelectOptionGroup): option is SelectOptionGroup {
    return 'options' in option;
}

/**
 * Seleção com `<select>` nativo estilizado (spec 0009): no celular abre o seletor do sistema. Use
 * com `register` do react-hook-form (as props do `<select>` e o `ref` passam direto).
 */
export function SelectField({
    label,
    help,
    error,
    id,
    options,
    placeholder,
    className,
    ...props
}: SelectFieldProps) {
    return (
        <Field label={label} help={help} error={error} id={id}>
            {(control) => (
                <div className="relative">
                    <select
                        {...control}
                        {...props}
                        className={cn(
                            'flex min-h-11 w-full appearance-none rounded-md border border-linha-forte bg-superficie py-2 pr-10 pl-3 text-corpo text-texto outline-none focus-visible:ring-2 focus-visible:ring-foco disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negativo',
                            className,
                        )}
                    >
                        {placeholder !== undefined && <option value="">{placeholder}</option>}
                        {options.map((option) =>
                            isGroup(option) ? (
                                <optgroup key={option.label} label={option.label}>
                                    {option.options.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ) : (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ),
                        )}
                    </select>
                    <ChevronDown
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-texto-apoio"
                    />
                </div>
            )}
        </Field>
    );
}
