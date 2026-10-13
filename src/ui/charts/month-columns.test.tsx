import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MonthColumns } from './month-columns';

function bars(container: HTMLElement) {
    return Array.from(container.querySelectorAll<SVGRectElement>('rect'));
}

describe('MonthColumns (spec 0015)', () => {
    it('draws one column per month, hidden from assistive tech, with the value in the title', () => {
        const { container } = render(
            <MonthColumns
                columns={[
                    { month: '2026-09', cents: 100000 },
                    { month: '2026-10', cents: 250050, forecast: true },
                ]}
            />,
        );

        const root = container.firstElementChild!;
        expect(root).toHaveAttribute('aria-hidden', 'true');
        const [september, october] = bars(container);
        expect(september).toHaveAttribute('data-month', '2026-09');
        expect(september!.querySelector('title')).toHaveTextContent(
            'setembro de 2026: R$ 1.000,00',
        );
        expect(october!.querySelector('title')).toHaveTextContent('outubro de 2026: R$ 2.500,50');
        expect(root).toHaveTextContent('set.');
        expect(root).toHaveTextContent('out.');
        expect(root).toHaveTextContent('2026');
    });

    it('fills realized columns with acento and forecast ones with info-fundo and an info outline', () => {
        const { container } = render(
            <MonthColumns
                columns={[
                    { month: '2026-09', cents: 100000 },
                    { month: '2026-10', cents: 100000, forecast: true },
                ]}
            />,
        );

        const [realized, forecast] = bars(container);
        expect(realized).toHaveAttribute('data-kind', 'realized');
        expect(realized).toHaveClass('fill-acento');
        expect(forecast).toHaveAttribute('data-kind', 'forecast');
        expect(forecast).toHaveClass('fill-info-fundo', 'stroke-info');
        // Sem negativos, só a linha de base.
        expect(container.querySelector('[data-slot="baseline"]')).not.toBeNull();
        expect(container.querySelector('[data-slot="zero-axis"]')).toBeNull();
    });

    it('puts negative columns below the zero axis, in negativo', () => {
        const { container } = render(
            <MonthColumns
                columns={[
                    { month: '2026-09', cents: 30000 },
                    { month: '2026-10', cents: -10000 },
                    { month: '2026-11', cents: -10000, forecast: true },
                ]}
            />,
        );

        const axis = container.querySelector('[data-slot="zero-axis"]')!;
        const zeroY = Number(axis.getAttribute('y1'));
        expect(zeroY).toBe(750);
        const [positive, negative, negativeForecast] = bars(container);
        expect(Number(positive!.getAttribute('y')) + Number(positive!.getAttribute('height'))).toBe(
            zeroY,
        );
        expect(negative).toHaveAttribute('data-sign', 'negative');
        expect(Number(negative!.getAttribute('y'))).toBe(zeroY);
        expect(Number(negative!.getAttribute('height'))).toBe(250);
        expect(negative).toHaveClass('fill-negativo');
        expect(negativeForecast).toHaveClass('fill-negativo-fundo', 'stroke-negativo');
    });

    it('scrolls horizontally on the phone only past six months', () => {
        const months = (n: number) =>
            Array.from({ length: n }, (_, i) => ({
                month: `2026-${String(i + 1).padStart(2, '0')}`,
                cents: 0,
            }));
        const short = render(<MonthColumns columns={months(6)} />);
        expect(short.container.querySelector('.min-w-\\(--month-columns-min\\)')).toBeNull();
        const long = render(<MonthColumns columns={months(12)} />);
        const scroller = long.container.querySelector<HTMLElement>(
            '.min-w-\\(--month-columns-min\\)',
        );
        expect(scroller).not.toBeNull();
        expect(scroller!.style.getPropertyValue('--month-columns-min')).toBe('672px');
        // Todos zero: nenhuma coluna cresce.
        expect(bars(long.container).every((bar) => bar.getAttribute('height') === '0')).toBe(true);
    });
});
