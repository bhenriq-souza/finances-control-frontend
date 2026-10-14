import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from './theme-provider';

function Probe() {
    const { tema, setTema } = useTheme();
    return (
        <div>
            <span data-testid="tema">{tema}</span>
            <button onClick={() => setTema('escuro')}>escuro</button>
            <button onClick={() => setTema('claro')}>claro</button>
            <button onClick={() => setTema('sistema')}>sistema</button>
        </div>
    );
}

function renderProbe() {
    return render(
        <ThemeProvider>
            <Probe />
        </ThemeProvider>,
    );
}

const root = document.documentElement;

beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-tema');
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
    it('defaults to sistema with no data-tema attribute', () => {
        renderProbe();
        expect(screen.getByTestId('tema')).toHaveTextContent('sistema');
        expect(root).not.toHaveAttribute('data-tema');
    });

    it('sets data-tema and persists for escuro and claro, and removes it for sistema', () => {
        renderProbe();

        act(() => screen.getByText('claro').click());
        expect(root).toHaveAttribute('data-tema', 'claro');
        expect(localStorage.getItem('ftech.tema')).toBe('claro');

        act(() => screen.getByText('escuro').click());
        expect(root).toHaveAttribute('data-tema', 'escuro');
        expect(localStorage.getItem('ftech.tema')).toBe('escuro');

        act(() => screen.getByText('sistema').click());
        expect(root).not.toHaveAttribute('data-tema');
        expect(localStorage.getItem('ftech.tema')).toBe('sistema');
    });

    it('restores the stored choice on mount', () => {
        localStorage.setItem('ftech.tema', 'claro');
        renderProbe();
        expect(screen.getByTestId('tema')).toHaveTextContent('claro');
        expect(root).toHaveAttribute('data-tema', 'claro');
    });

    it('falls back to sistema on an invalid stored value (ERR-0004-04)', () => {
        localStorage.setItem('ftech.tema', 'roxo');
        renderProbe();
        expect(screen.getByTestId('tema')).toHaveTextContent('sistema');
        expect(root).not.toHaveAttribute('data-tema');
    });

    it('falls back to sistema when localStorage throws, and still switches in memory (ERR-0004-04)', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        renderProbe();
        expect(screen.getByTestId('tema')).toHaveTextContent('sistema');

        act(() => screen.getByText('claro').click());
        expect(screen.getByTestId('tema')).toHaveTextContent('claro');
        expect(root).toHaveAttribute('data-tema', 'claro');
    });

    it('throws a clear error when useTheme is used outside the provider', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => render(<Probe />)).toThrow('ThemeProvider');
    });
});
