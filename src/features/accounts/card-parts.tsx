import type { CreditCard } from '@/api/queries/reference';
import { formatDate } from '@/shared/dates';
import type { Cents } from '@/shared/money';
import { Money } from '@/ui/money';

/** Limite usado: `creditLimitCents − availableLimitCents`, a única subtração do cliente (INV-0011-03). */
export function usedCents(card: CreditCard): Cents {
    return card.creditLimitCents - card.availableLimitCents;
}

/** "Fecha em 15 out. · vence em 22 out." — o ciclo atual do cartão. */
export function cycleText(card: CreditCard): string {
    const { closesOn, dueOn } = card.currentCycle;
    return `Fecha em ${formatDate(closesOn, 'curta')} · vence em ${formatDate(dueOn, 'curta')}`;
}

/** Disponível: neutro; negativo (limite estourado) com `−` e o tom `negativo`. */
export function AvailableMoney({
    cents,
    size,
}: {
    cents: Cents;
    size?: 'valor' | 'valor-pequeno' | 'valor-destaque';
}) {
    return cents < 0 ? (
        <Money cents={cents} sign="always" tone="auto" size={size} />
    ) : (
        <Money cents={cents} size={size} />
    );
}

/**
 * Barra de uso do limite, no desenho da `BarList` (6px, `acento` sobre `superficie-elevada`), mas
 * proporcional ao limite total do cartão: a `BarList` escala pelo maior item, e com um item só a
 * barra ficaria sempre cheia. Decorativa: o valor usado está no texto ao lado.
 */
export function LimitBar({ card }: { card: CreditCard }) {
    const used = usedCents(card);
    // Proporção só para a largura da barra; o valor exibido continua em centavos.
    const percent =
        card.creditLimitCents > 0
            ? Math.min(100, Math.max(0, (used / card.creditLimitCents) * 100))
            : 0;
    return (
        <div
            aria-hidden="true"
            className="h-1.5 w-full overflow-hidden rounded-full bg-superficie-elevada"
        >
            <div
                data-slot="bar"
                className="h-full rounded-full bg-acento"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

/** Usado em `Money` sem sinal, com a barra de uso embaixo. */
export function UsedWithBar({ card }: { card: CreditCard }) {
    return (
        <span className="flex min-w-24 flex-col items-end gap-1.5">
            <Money cents={usedCents(card)} sign="never" size="valor-pequeno" />
            <LimitBar card={card} />
        </span>
    );
}
