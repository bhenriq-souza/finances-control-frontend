import { useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { PROFILE_LABELS, useAuthSession, type CurrentUser } from '@/features/identity';
import { Button } from '@/ui/components/ui/button';
import { useTheme, type Tema } from '@/ui/theme/theme-provider';

import { initials } from './initials';

const THEME_OPTIONS: readonly { value: Tema; label: string }[] = [
    { value: 'sistema', label: 'Sistema' },
    { value: 'escuro', label: 'Escuro' },
    { value: 'claro', label: 'Claro' },
];

/**
 * Menu do usuário (spec 0006): nome, email, perfil em pt-BR, seletor de tema e **Sair**. Um
 * botão de abrir e fechar (disclosure); fecha com Esc (devolvendo o foco) e com clique fora.
 */
export function UserMenu({ user }: { user: CurrentUser }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    const { tema, setTema } = useTheme();
    const session = useAuthSession();
    const navigate = useNavigate();

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    /** Sair limpa todo o cache de consultas (INV-0006-04) e volta a `/entrar`. */
    async function signOut() {
        await session.signOut();
        await navigate({ to: '/entrar' });
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                aria-label="Menu do usuário"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => {
                    setOpen((value) => !value);
                }}
                className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-foco"
            >
                <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full border border-linha bg-superficie-elevada text-rotulo text-texto"
                >
                    {initials(user.name, user.email)}
                </span>
            </button>
            {open && (
                <section
                    id={panelId}
                    aria-label="Conta do usuário"
                    className="absolute top-full right-0 z-30 mt-2 flex w-72 flex-col gap-4 rounded-lg border border-linha bg-superficie-elevada p-4 text-texto shadow-[var(--ft-sombra-flutuante)]"
                >
                    <div className="flex flex-col gap-1">
                        <p className="truncate text-corpo-forte">{user.name}</p>
                        <p className="truncate text-pequeno text-texto-apoio">{user.email}</p>
                        {user.profile && (
                            <p className="text-pequeno text-texto-apoio">
                                Perfil:{' '}
                                <span className="text-texto">{PROFILE_LABELS[user.profile]}</span>
                            </p>
                        )}
                    </div>
                    <div className="border-t border-linha pt-4">
                        <fieldset>
                            <legend className="mb-2 text-rotulo text-texto-apoio">Tema</legend>
                            <div className="grid grid-cols-3 gap-1 rounded-md bg-superficie p-1">
                                {THEME_OPTIONS.map(({ value, label }) => (
                                    <label
                                        key={value}
                                        className="flex min-h-11 cursor-pointer items-center justify-center rounded-sm text-pequeno text-texto-apoio has-checked:bg-superficie-elevada has-checked:text-texto has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foco"
                                    >
                                        <input
                                            type="radio"
                                            name={`${panelId}-tema`}
                                            value={value}
                                            checked={tema === value}
                                            onChange={() => {
                                                setTema(value);
                                            }}
                                            className="sr-only"
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    </div>
                    <div className="border-t border-linha pt-2">
                        <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => void signOut()}
                        >
                            <LogOut aria-hidden="true" strokeWidth={1.75} />
                            Sair
                        </Button>
                    </div>
                </section>
            )}
        </div>
    );
}
