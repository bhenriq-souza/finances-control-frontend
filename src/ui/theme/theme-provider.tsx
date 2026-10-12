import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Tema = 'sistema' | 'escuro' | 'claro';

export const THEME_STORAGE_KEY = 'ftech.tema';

function isTema(value: unknown): value is Tema {
    return value === 'sistema' || value === 'escuro' || value === 'claro';
}

/** Lê a escolha guardada; indisponível ou inválida vira `sistema` (ERR-0004-04). */
function readStoredTema(): Tema {
    try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        return isTema(value) ? value : 'sistema';
    } catch {
        return 'sistema';
    }
}

function storeTema(tema: Tema): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, tema);
    } catch {
        // Sem armazenamento a escolha vale só nesta sessão, sem erro visível.
    }
}

/** `escuro` e `claro` fixam `data-tema`; `sistema` o remove e deixa o prefers-color-scheme decidir. */
function applyTema(tema: Tema): void {
    const root = document.documentElement;
    if (tema === 'sistema') root.removeAttribute('data-tema');
    else root.setAttribute('data-tema', tema);
}

interface ThemeContextValue {
    tema: Tema;
    setTema: (tema: Tema) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Guarda a escolha de tema e a reflete em `<html data-tema>`. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [tema, setTemaState] = useState<Tema>(readStoredTema);

    useEffect(() => {
        applyTema(tema);
    }, [tema]);

    const setTema = useCallback((next: Tema) => {
        setTemaState(next);
        storeTema(next);
    }, []);

    const value = useMemo(() => ({ tema, setTema }), [tema, setTema]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used inside ThemeProvider');
    return context;
}
