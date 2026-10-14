import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './components/ui/button';
import { ConfirmDialog } from './confirm-dialog';
import { FormAlert } from './form-alert';

function Harness({
    onConfirm = vi.fn(),
    destructive,
    pending,
    alert,
}: {
    onConfirm?: () => void;
    destructive?: boolean;
    pending?: boolean;
    alert?: string;
}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button onClick={() => setOpen(true)}>Excluir banco</Button>
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="Excluir o banco?"
                description="O banco Nubank e as contas dele serão excluídos."
                confirmLabel="Excluir"
                destructive={destructive}
                pending={pending}
                onConfirm={onConfirm}
            >
                <FormAlert message={alert} />
            </ConfirmDialog>
        </>
    );
}

function openDialog() {
    const trigger = screen.getByRole('button', { name: 'Excluir banco' });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
}

// AC-0009-06: `ConfirmDialog` começa com o foco em **Cancelar**.
describe('ConfirmDialog', () => {
    it('is a modal alertdialog that says what will happen and starts on Cancelar', () => {
        render(<Harness />);
        openDialog();

        const dialog = screen.getByRole('alertdialog', { name: 'Excluir o banco?' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleDescription(
            'O banco Nubank e as contas dele serão excluídos.',
        );
        expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    });

    it('confirms with the action verb and does not close by itself', () => {
        const onConfirm = vi.fn();
        render(<Harness onConfirm={onConfirm} alert="Você não tem permissão para fazer isso." />);
        openDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Você não tem permissão para fazer isso.',
        );
    });

    it('uses the negativo button for a destructive action and the default one otherwise', () => {
        const { unmount } = render(<Harness destructive />);
        openDialog();
        expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('bg-negativo');
        unmount();

        render(<Harness />);
        openDialog();
        expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('bg-acento');
    });

    it('disables the confirm button while pending', () => {
        render(<Harness pending />);
        openDialog();
        expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled();
    });

    it('cancels with Cancelar or Esc and gives the focus back to the trigger', async () => {
        render(<Harness />);
        const trigger = openDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());

        openDialog();
        await act(async () => {
            fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
        });
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('does not close on a pointer down outside', () => {
        render(<Harness />);
        openDialog();
        fireEvent.pointerDown(document.body);
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
});
