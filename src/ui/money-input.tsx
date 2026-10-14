import { useId, type FocusEvent, type Ref } from 'react';

import { formatBRL, parseBRL } from '@/shared/money';

import { cn } from './lib/utils';

export type MoneyInputProps = {
    label: string;
    /** Texto digitado (o formulário guarda o texto; o `moneySchema` o converte em centavos). */
    value: string;
    onChange: (text: string) => void;
    onBlur?: () => void;
    /** Mensagem de erro já em pt-BR. */
    error?: string;
    name?: string;
    id?: string;
    disabled?: boolean;
    ref?: Ref<HTMLInputElement>;
};

/**
 * Campo de dinheiro: prefixo visual `R$`, teclado decimal e reformatação do texto válido ao
 * perder o foco (`1234,5` → `1.234,50`). Use com `Controller` do react-hook-form e `moneySchema`.
 */
export function MoneyInput({
    label,
    value,
    onChange,
    onBlur,
    error,
    name,
    id,
    disabled,
    ref,
}: MoneyInputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    function handleBlur(event: FocusEvent<HTMLInputElement>) {
        const typed = event.currentTarget.value;
        const parsed = parseBRL(typed);
        if (parsed.ok) {
            const formatted = formatBRL(parsed.cents, { sign: 'never' }).replace(/^R\$\s*/, '');
            if (formatted !== typed) onChange(formatted);
        }
        onBlur?.();
    }

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-rotulo text-texto">
                {label}
            </label>
            <div
                className={cn(
                    'bg-superficie text-texto flex items-center gap-2 rounded-md border px-3 py-2',
                    'focus-within:ring-foco focus-within:ring-2',
                    error ? 'border-negativo' : 'border-linha-forte',
                )}
            >
                <span aria-hidden="true" className="text-texto-apoio text-corpo">
                    R$
                </span>
                <input
                    ref={ref}
                    id={inputId}
                    name={name}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={disabled}
                    value={value}
                    onChange={(event) => {
                        onChange(event.target.value);
                    }}
                    onBlur={handleBlur}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="text-corpo text-texto min-w-0 flex-1 bg-transparent tabular-nums outline-none"
                />
            </div>
            {error ? (
                <p id={errorId} className="text-pequeno text-negativo">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
