import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './components/ui/button';
import { FormDialog } from './form-dialog';

function Harness({
    description,
    onOpenChange,
}: {
    description?: string;
    onOpenChange?: (open: boolean) => void;
}) {
    const [open, setOpen] = useState(false);
    function change(next: boolean) {
        onOpenChange?.(next);
        setOpen(next);
    }
    return (
        <>
            <Button onClick={() => setOpen(true)}>Novo banco</Button>
            <FormDialog
                open={open}
                onOpenChange={change}
                title="Novo banco"
                description={description}
                footer={
                    <>
                        <Button variant="outline" onClick={() => change(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="f">
                            Salvar
                        </Button>
                    </>
                }
            >
                <form id="f">
                    <label htmlFor="nome">Nome</label>
                    <input id="nome" defaultValue="Nubank" />
                </form>
            </FormDialog>
        </>
    );
}

function openDialog() {
    const trigger = screen.getByRole('button', { name: 'Novo banco' });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
}

// AC-0009-06 (a parte que o jsdom prova; o tamanho de tela fica no e2e).
describe('FormDialog', () => {
    it('is a labelled, described, modal dialog with the form and the footer actions', () => {
        render(<Harness description="Cadastre o banco." />);
        openDialog();

        const dialog = screen.getByRole('dialog', { name: 'Novo banco' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleDescription('Cadastre o banco.');
        expect(screen.getByLabelText('Nome')).toHaveValue('Nubank');
        expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('form', 'f');
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    });

    it('has no description when none is given', () => {
        render(<Harness />);
        openDialog();
        expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    });

    it('moves the focus inside on open, closes with Esc and gives the focus back to the trigger', async () => {
        const onOpenChange = vi.fn();
        render(<Harness onOpenChange={onOpenChange} />);
        const trigger = openDialog();

        const dialog = screen.getByRole('dialog');
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        expect(screen.getByLabelText('Nome')).toHaveFocus();

        await act(async () => {
            fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
        });

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('closes from the footer Cancel action', () => {
        render(<Harness />);
        openDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
