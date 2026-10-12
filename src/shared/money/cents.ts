/** Inteiro de centavos, como na API (`amountCents`). Spec 0008. */
export type Cents = number;

/** Limite do banco `numeric(14,2)`: |valor| <= R$ 999.999.999.999,99. */
export const MAX_CENTS = 99_999_999_999_999;

export function isCents(value: unknown): value is Cents {
    return Number.isSafeInteger(value) && Math.abs(value as number) <= MAX_CENTS;
}
