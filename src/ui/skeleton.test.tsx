import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EntryListSkeleton, Skeleton } from './skeleton';

describe('Skeleton (spec 0009)', () => {
    it('is a decorative block that pulses, still with prefers-reduced-motion', () => {
        const { container } = render(<Skeleton className="h-4" />);
        const block = container.firstElementChild;

        expect(block).toHaveAttribute('aria-hidden', 'true');
        expect(block).toHaveClass(
            'animate-pulse',
            'motion-reduce:animate-none',
            'bg-superficie-elevada',
            'h-4',
        );
    });

    it('EntryListSkeleton: a loading status with three cards and three rows', () => {
        render(<EntryListSkeleton />);

        const status = screen.getByRole('status', { name: 'Carregando' });
        const [cards, table] = Array.from(status.children);
        expect(cards).toHaveClass('md:hidden');
        expect(
            within(cards as HTMLElement).getAllByRole('listitem', { hidden: true }),
        ).toHaveLength(3);
        expect(table).toHaveClass('hidden', 'md:block');
        expect(table?.children).toHaveLength(4);
    });
});
