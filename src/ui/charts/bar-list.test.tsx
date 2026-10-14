import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Cents } from '@/shared/money';

import { BarList } from './bar-list';

const c = (value: number) => value as Cents;

function bars(container: HTMLElement) {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="bar"]'));
}

describe('BarList (spec 0009)', () => {
    it('is a labelled list with name and Money for each item', () => {
        render(
            <BarList
                label="Despesas por tipo"
                items={[
                    { key: 'a', label: 'Moradia', cents: c(180000) },
                    { key: 'b', label: 'Mercado', cents: c(90000) },
                ]}
            />,
        );

        const list = screen.getByRole('list', { name: 'Despesas por tipo' });
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('Moradia');
        expect(within(items[0]!).getByText('R$ 1.800,00')).toHaveClass('tabular-nums');
        expect(items[1]).toHaveTextContent('MercadoR$ 900,00');
    });

    it('sizes each bar against the largest value, in acento over superficie-elevada', () => {
        const { container } = render(
            <BarList
                label="x"
                items={[
                    { key: 'a', label: 'A', cents: c(5000) },
                    { key: 'b', label: 'B', cents: c(20000) },
                    { key: 'c', label: 'C', cents: c(0) },
                ]}
            />,
        );

        const [a, b, zero] = bars(container);
        expect(a).toHaveStyle({ width: '25%' });
        expect(b).toHaveStyle({ width: '100%' });
        expect(zero).toHaveStyle({ width: '0%' });
        expect(b).toHaveClass('bg-acento');
        expect(b?.parentElement).toHaveClass('h-1.5', 'bg-superficie-elevada');
        expect(b?.parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('with every value zero, no bar grows', () => {
        const { container } = render(
            <BarList label="x" items={[{ key: 'a', label: 'A', cents: c(0) }]} />,
        );

        expect(bars(container)[0]).toHaveStyle({ width: '0%' });
    });
});
