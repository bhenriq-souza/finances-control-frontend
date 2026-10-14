import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, THEME_STORAGE_KEY } from '@/ui/theme/theme-provider';

import { BrandLogo, BrandSymbol } from './brand';
import logoClaro from './farmtech-logo-horizontal-fundo-claro.svg';
import logoEscuro from './farmtech-logo-horizontal-fundo-escuro.svg';
import simboloClaro from './farmtech-simbolo-compacto-fundo-claro.svg';
import simboloEscuro from './farmtech-simbolo-compacto-fundo-escuro.svg';

/** `matchMedia` controlável: o jsdom não o implementa. */
function stubSystemScheme(light: boolean) {
    const listeners = new Set<() => void>();
    const query = {
        matches: light,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
    vi.stubGlobal('matchMedia', () => query);
    return {
        change(next: boolean) {
            query.matches = next;
            listeners.forEach((listener) => listener());
        },
    };
}

const src = () => screen.getByRole('img', { name: 'FarmTech' }).getAttribute('src') ?? '';

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe('FarmTech brand by theme', () => {
    it('follows the system scheme in "sistema", live', () => {
        const system = stubSystemScheme(true);
        render(
            <ThemeProvider>
                <BrandLogo />
            </ThemeProvider>,
        );
        expect(src()).toBe(logoClaro);

        act(() => system.change(false));
        expect(src()).toBe(logoEscuro);
    });

    it('uses the stored choice over the system scheme', () => {
        stubSystemScheme(true);
        localStorage.setItem(THEME_STORAGE_KEY, 'escuro');
        render(
            <ThemeProvider>
                <BrandSymbol />
            </ThemeProvider>,
        );
        expect(src()).toBe(simboloEscuro);
    });

    it('uses the light version for "claro" and the dark default without matchMedia', () => {
        vi.stubGlobal('matchMedia', undefined);
        localStorage.setItem(THEME_STORAGE_KEY, 'claro');
        const { unmount } = render(
            <ThemeProvider>
                <BrandSymbol />
            </ThemeProvider>,
        );
        expect(src()).toBe(simboloClaro);
        unmount();

        localStorage.clear();
        render(
            <ThemeProvider>
                <BrandLogo />
            </ThemeProvider>,
        );
        expect(src()).toBe(logoEscuro);
    });
});
