import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Cents } from '@/shared/money';

import { Money, type MoneyProps } from './money';

const c = (value: number) => value as Cents;

function renderMoney(props: MoneyProps) {
    render(<Money {...props} />);
    return screen.getByText(/R\$/);
}

describe('Money', () => {
    it('renders formatBRL with tabular figures and the default money style', () => {
        const el = renderMoney({ cents: c(123456) });
        expect(el).toHaveTextContent('R$ 1.234,56');
        expect(el).toHaveClass('tabular-nums', 'text-valor', 'text-texto');
    });

    it.each([
        [1230, '+R$ 12,30', 'text-positivo'] as const,
        [-1230, '−R$ 12,30', 'text-negativo'] as const,
        [0, 'R$ 0,00', 'text-texto'] as const,
    ])('colours by sign with sign=always, cents=%i', (cents, text, colour) => {
        const el = renderMoney({ cents: c(cents), sign: 'always', tone: 'auto' });
        expect(el.textContent).toBe(text);
        expect(el).toHaveClass(colour);
    });

    it('uses the neutral colour for zero with tone auto', () => {
        const el = renderMoney({ cents: c(0), sign: 'always', tone: 'auto' });
        expect(el).toHaveClass('text-texto');
        expect(el).not.toHaveClass('text-positivo', 'text-negativo');
    });

    it('keeps the neutral colour with tone neutral even when negative', () => {
        const el = renderMoney({ cents: c(-500), tone: 'neutral' });
        expect(el).toHaveTextContent('−R$ 5,00');
        expect(el).toHaveClass('text-texto');
        expect(el).not.toHaveClass('text-negativo');
    });

    it('shows the absolute value without sign and without colour for sign=never', () => {
        const el = renderMoney({ cents: c(-500), sign: 'never' });
        expect(el).toHaveTextContent('R$ 5,00');
        expect(el).toHaveClass('text-texto');
    });

    it.each([['never', -500, 'R$ 5,00'] as const, ['auto', 500, 'R$ 5,00'] as const])(
        'INV-0008-03: tone auto with sign=%s is a type error and never colours at runtime',
        (sign, cents, text) => {
            // @ts-expect-error tone="auto" requires sign="always"
            const props: MoneyProps = { cents: c(cents), sign, tone: 'auto' };
            const el = renderMoney(props);
            expect(el).toHaveTextContent(text);
            expect(el).toHaveClass('text-texto');
            expect(el).not.toHaveClass('text-positivo', 'text-negativo');
        },
    );

    it.each(['valor', 'valor-pequeno', 'valor-destaque'] as const)(
        'applies the %s money style',
        (size) => {
            expect(renderMoney({ cents: c(100), size })).toHaveClass(`text-${size}`);
        },
    );

    it('merges a custom className', () => {
        expect(renderMoney({ cents: c(100), className: 'ml-2' })).toHaveClass('ml-2');
    });
});
