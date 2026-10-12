import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { E2E_PROOF_MARKER, FormProofPage } from './-formulario-page';

function renderPage() {
    render(
        <NoticeProvider store={createNoticeStore()}>
            <FormProofPage />
        </NoticeProvider>,
    );
    return screen.getByRole('region', { name: 'Avisos' });
}

describe('/_e2e/formulario proof page (spec 0009)', () => {
    it('carries the build marker', () => {
        renderPage();
        expect(E2E_PROOF_MARKER).toBe('__E2E_FAKE_AUTH__');
        expect(screen.getByRole('main')).toHaveAttribute('data-e2e-marker', E2E_PROOF_MARKER);
    });

    it('validates the form inside the dialog, then saves, closes and notifies', async () => {
        const notices = renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Nova despesa' }));
        const dialog = screen.getByRole('dialog', { name: 'Nova despesa' });

        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
        });
        expect(within(dialog).getByLabelText('Descrição')).toHaveAccessibleDescription(
            'Informe o nome.',
        );
        expect(within(dialog).getByLabelText('Pagar com')).toHaveAttribute('aria-invalid', 'true');

        fireEvent.change(within(dialog).getByLabelText('Descrição'), {
            target: { value: 'Mercado' },
        });
        fireEvent.change(within(dialog).getByLabelText('Pagar com'), {
            target: { value: 'visa' },
        });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(within(notices).getByText('Despesa salva.')).toBeInTheDocument();
    });

    it('cancels the form dialog', () => {
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Nova despesa' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('confirms the destructive action, closes and notifies', () => {
        const notices = renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Excluir despesa' }));
        const dialog = screen.getByRole('alertdialog', { name: 'Excluir a despesa?' });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(within(notices).getByText('Despesa excluída.')).toBeInTheDocument();
    });
});
