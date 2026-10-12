import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNoticeStore, NOTICE_TIMEOUT_MS, NoticeProvider, useNotify } from './notice';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

function NotifyButton() {
    const notify = useNotify();
    return (
        <button
            type="button"
            onClick={() => notify({ tone: 'sucesso', message: 'Despesa salva.' })}
        >
            Salvar
        </button>
    );
}

describe('Notice', () => {
    it('renders a polite live region that is there before any notice', () => {
        render(
            <NoticeProvider store={createNoticeStore()}>
                <p>tela</p>
            </NoticeProvider>,
        );

        const region = screen.getByRole('region', { name: 'Avisos' });
        expect(region).toHaveAttribute('aria-live', 'polite');
        expect(region).toBeEmptyDOMElement();
        expect(screen.getByText('tela')).toBeInTheDocument();
    });

    it('shows a notice from useNotify and hides it after 5 seconds', () => {
        render(
            <NoticeProvider store={createNoticeStore()}>
                <NotifyButton />
            </NoticeProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
        const region = screen.getByRole('region', { name: 'Avisos' });
        expect(within(region).getByText('Despesa salva.')).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(NOTICE_TIMEOUT_MS - 1));
        expect(within(region).getByText('Despesa salva.')).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1));
        expect(region).toBeEmptyDOMElement();
    });

    it('closes a notice on Fechar aviso, keeping the others, with the tone of each', () => {
        const store = createNoticeStore();
        render(
            <NoticeProvider store={store}>
                <p>tela</p>
            </NoticeProvider>,
        );

        act(() => {
            store.show({ tone: 'erro', message: 'Falhou.' });
            store.show({ tone: 'info', message: 'Para saber.' });
        });
        expect(screen.getByText('Falhou.').closest('[data-tone]')).toHaveAttribute(
            'data-tone',
            'erro',
        );
        expect(screen.getByText('Para saber.').closest('[data-tone]')).toHaveAttribute(
            'data-tone',
            'info',
        );

        fireEvent.click(screen.getAllByRole('button', { name: 'Fechar aviso' })[0]!);
        expect(screen.queryByText('Falhou.')).not.toBeInTheDocument();
        expect(screen.getByText('Para saber.')).toBeInTheDocument();

        // O tempo de um aviso já fechado não afeta os demais.
        act(() => vi.advanceTimersByTime(NOTICE_TIMEOUT_MS));
        expect(screen.queryByText('Para saber.')).not.toBeInTheDocument();
    });

    it('stops notifying a listener after it unsubscribes', () => {
        const store = createNoticeStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        store.show({ tone: 'info', message: 'a' });
        unsubscribe();
        store.show({ tone: 'info', message: 'b' });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot().map((item) => item.message)).toEqual(['a', 'b']);
    });

    it('useNotify outside the provider is a programming error', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => render(<NotifyButton />)).toThrow('useNotify fora do NoticeProvider');
    });
});
