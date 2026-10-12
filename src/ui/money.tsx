import { clsx } from 'clsx';

import { formatBRL, type Cents } from '@/shared/money';

// `clsx` e não `cn`: o tailwind-merge trataria `text-valor` (tamanho) e `text-texto` (cor) como conflito.

type MoneySize = 'valor' | 'valor-pequeno' | 'valor-destaque';

type MoneyBaseProps = {
    cents: Cents;
    /** Estilo de dinheiro do tema (spec 0004). Padrão: `valor`. */
    size?: MoneySize;
    className?: string;
};

/**
 * `tone="auto"` colore pelo sinal e por isso exige um sinal visível (INV-0008-03):
 * `sign="never"` só combina com `tone="neutral"`.
 */
export type MoneyProps = MoneyBaseProps &
    ({ sign?: 'auto' | 'always'; tone?: 'auto' | 'neutral' } | { sign: 'never'; tone?: 'neutral' });

const SIZE_CLASS: Record<MoneySize, string> = {
    valor: 'text-valor',
    'valor-pequeno': 'text-valor-pequeno',
    'valor-destaque': 'text-valor-destaque',
};

function toneClass(cents: Cents): string {
    if (cents > 0) return 'text-positivo';
    if (cents < 0) return 'text-negativo';
    return 'text-texto';
}

/** Exibe dinheiro com `formatBRL`, algarismos tabulares e, opcionalmente, cor pelo sinal. */
export function Money({
    cents,
    sign = 'auto',
    tone = 'neutral',
    size = 'valor',
    className,
}: MoneyProps) {
    // Guarda de execução de INV-0008-03: sem sinal, nunca há cor.
    const colored = tone === 'auto' && sign !== 'never';

    return (
        <span
            className={clsx(
                'tabular-nums',
                SIZE_CLASS[size],
                colored ? toneClass(cents) : 'text-texto',
                className,
            )}
        >
            {formatBRL(cents, { sign })}
        </span>
    );
}
