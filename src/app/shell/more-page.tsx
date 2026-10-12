import { Link, Navigate } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';

import { useCurrentUser } from '@/features/identity';

import { moreItems, NAV_ITEMS, navItemsFor, type NavItem } from './navigation';

/** O desktop do shell (spec 0006): a partir de `lg` (1024px), a lateral mostra todos os itens. */
const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribe(onChange: () => void): () => void {
    const query = window.matchMedia?.(DESKTOP_QUERY);
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
}

/** Sem `matchMedia` (jsdom), vale o mobile-first: não é desktop. */
const isDesktop = () => window.matchMedia?.(DESKTOP_QUERY).matches ?? false;

/** Se a tela é de desktop, acompanhando o redimensionamento. */
export function useIsDesktop(): boolean {
    return useSyncExternalStore(subscribe, isDesktop);
}

/**
 * Página **Mais** (`/mais`, spec 0009): links grandes para os itens visíveis de `slot: 'mais'`,
 * na ordem da lista. No desktop a lateral já lista todos, então a rota redireciona para `/`.
 * `items` existe para os testes; a rota usa `NAV_ITEMS`.
 */
export function MorePage({ items = NAV_ITEMS }: { items?: readonly NavItem[] }) {
    const user = useCurrentUser();
    const desktop = useIsDesktop();
    if (desktop) return <Navigate to="/" replace />;

    const entries = moreItems(navItemsFor(user.profile, items));
    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-titulo-1">Mais</h1>
            {entries.length === 0 ? (
                // Provisório: trocar pelo `EmptyState` de `src/ui/` (T-0009-03) quando existir.
                <p className="text-corpo text-texto-apoio">Não há outras seções para mostrar.</p>
            ) : (
                <nav aria-label="Mais">
                    <ul className="flex flex-col gap-2">
                        {entries.map(({ to, label, icon: Icon }) => (
                            <li key={to}>
                                <Link
                                    to={to}
                                    className="flex min-h-14 items-center gap-3 rounded-md border border-linha bg-superficie px-4 text-corpo-forte text-texto outline-none hover:bg-superficie-elevada focus-visible:ring-2 focus-visible:ring-foco"
                                >
                                    <Icon
                                        aria-hidden="true"
                                        strokeWidth={1.75}
                                        className="size-6 text-texto-apoio"
                                    />
                                    {label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </div>
    );
}
