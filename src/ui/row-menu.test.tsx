import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Pencil } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { RowMenu, type RowMenuItem } from './row-menu';

// Sem `@testing-library/user-event` no projeto: o mínimo que o Radix lê do ponteiro e do teclado.
const user = {
    async click(element: Element) {
        await act(async () => {
            fireEvent.pointerDown(element, { button: 0, ctrlKey: false, pointerType: 'mouse' });
            fireEvent.pointerUp(element, { button: 0, pointerType: 'mouse' });
            fireEvent.click(element);
        });
    },
    async key(key: string) {
        await act(async () => {
            fireEvent.keyDown(document.activeElement ?? document.body, { key });
        });
    },
};

function items(onSelect = vi.fn()): RowMenuItem[] {
    return [
        { label: 'Editar', icon: Pencil, onSelect },
        { label: 'Arquivar', onSelect },
        { label: 'Excluir', tone: 'negativo', onSelect },
    ];
}

describe('RowMenu (spec 0009)', () => {
    it('renders nothing without items', () => {
        const { container } = render(<RowMenu label="Ações de Aluguel" items={[]} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('opens by click, lists the items in a menu and calls the chosen action', async () => {
        const onSelect = vi.fn();
        render(<RowMenu label="Ações de Aluguel" items={items(onSelect)} />);
        const trigger = screen.getByRole('button', { name: 'Ações de Aluguel' });
        expect(trigger).toHaveClass('size-11');

        await user.click(trigger);
        const menu = await screen.findByRole('menu');
        expect(
            within(menu)
                .getAllByRole('menuitem')
                .map((i) => i.textContent),
        ).toEqual(['Editar', 'Arquivar', 'Excluir']);

        await user.click(within(menu).getByRole('menuitem', { name: 'Arquivar' }));
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('opens by keyboard, walks the items with the arrows and Esc returns the focus', async () => {
        const onSelect = vi.fn();
        render(<RowMenu label="Ações de Aluguel" items={items(onSelect)} />);
        const trigger = screen.getByRole('button', { name: 'Ações de Aluguel' });

        trigger.focus();
        await user.key('Enter');
        await screen.findByRole('menu');
        await user.key('ArrowDown');
        expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
        await user.key('ArrowDown');
        expect(screen.getByRole('menuitem', { name: 'Arquivar' })).toHaveFocus();
        await user.key('End');
        await waitFor(() => {
            expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveFocus();
        });
        await user.key('Home');
        await waitFor(() => {
            expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
        });

        await user.key('Escape');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(trigger).toHaveFocus();
        });
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('separates the negative item from the others and tones it', async () => {
        render(<RowMenu label="Ações" items={items()} />);

        await user.click(screen.getByRole('button', { name: 'Ações' }));
        const menu = await screen.findByRole('menu');
        const separator = within(menu).getByRole('separator');
        const remove = within(menu).getByRole('menuitem', { name: 'Excluir' });

        expect(remove).toHaveClass('text-negativo', 'min-h-11');
        expect(
            separator.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(within(menu).getByRole('menuitem', { name: 'Arquivar' })).not.toHaveClass(
            'text-negativo',
        );
    });

    it('has no separator when every item is regular', async () => {
        render(<RowMenu label="Ações" items={items().slice(0, 2)} />);

        await user.click(screen.getByRole('button', { name: 'Ações' }));
        await screen.findByRole('menu');

        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('does not call a disabled item', async () => {
        const onSelect = vi.fn();
        render(<RowMenu label="Ações" items={[{ label: 'Pagar', onSelect, disabled: true }]} />);

        await user.click(screen.getByRole('button', { name: 'Ações' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Pagar' }));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('the text trigger is an outline button "Mais ações" at full width', () => {
        render(<RowMenu label="Ações de Aluguel" trigger="texto" items={items()} />);

        const trigger = screen.getByRole('button', { name: 'Mais ações' });
        expect(trigger).toHaveClass('w-full');
        expect(trigger).toHaveClass('border');
    });
});
