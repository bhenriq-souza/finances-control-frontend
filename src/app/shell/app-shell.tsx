import { Link, Outlet } from '@tanstack/react-router';

import { useCurrentUser } from '@/features/identity';
import { BrandSymbol } from '@/ui/brand/brand';

import {
    bottomBarEntries,
    MORE_ENTRY,
    NAV_ITEMS,
    navItemsFor,
    type BottomBarEntry,
    type NavItem,
} from './navigation';
import { UserMenu } from './user-menu';

const PRODUCT_NAME = 'FTech Finance';

/** Símbolo compacto + nome do produto. */
function BrandRow({ className }: { className: string }) {
    return (
        <div className={className}>
            <BrandSymbol className="size-6" />
            <span className="text-titulo-3 text-texto">{PRODUCT_NAME}</span>
        </div>
    );
}

const LINK_CLASS =
    'flex flex-1 flex-col items-center justify-center gap-1 text-rotulo text-texto-apoio outline-none hover:text-texto focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-inset aria-[current=page]:text-acento lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-corpo-forte lg:text-texto lg:hover:bg-superficie-elevada lg:aria-[current=page]:bg-superficie-elevada lg:aria-[current=page]:text-acento';

function NavEntry({ entry, className }: { entry: BottomBarEntry; className: string }) {
    const { to, label, icon: Icon } = entry;
    return (
        <li className={className}>
            <Link to={to} activeOptions={{ exact: to === '/' }} className={LINK_CLASS}>
                <Icon aria-hidden="true" strokeWidth={1.75} className="size-6 lg:size-5" />
                {label}
            </Link>
        </li>
    );
}

/**
 * App shell das rotas de `_app` (spec 0006): no celular e no tablet, cabeçalho com a marca e o
 * menu do usuário e barra inferior fixa; no desktop (≥ 1024px), barra lateral fixa à esquerda com
 * a marca e o menu do usuário no topo do conteúdo. A navegação é uma só, reposicionada por
 * tamanho, e mostra só os itens do perfil (INV-0006-03): a barra inferior, os itens de
 * `slot: 'barra'` (até quatro) e o **Mais**; a lateral, todos os itens e nunca o **Mais** (spec
 * 0009). Camadas: o cabeçalho (z-30, que contém o painel do menu do usuário) e a navegação
 * (z-20) ficam acima do botão flutuante das listas (z-10); diálogos e folhas (z-40 e z-50)
 * ficam acima de tudo. `items` existe para os testes; a rota usa `NAV_ITEMS`.
 */
export function AppShell({ items = NAV_ITEMS }: { items?: readonly NavItem[] }) {
    const user = useCurrentUser();
    const visible = navItemsFor(user.profile, items);
    const bottomBar = bottomBarEntries(visible);
    const hasMore = bottomBar.includes(MORE_ENTRY);

    return (
        <div className="min-h-dvh bg-fundo text-texto lg:pl-60">
            <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-linha bg-superficie lg:inset-y-0 lg:right-auto lg:w-60 lg:border-t-0 lg:border-r lg:px-3 lg:py-5">
                <BrandRow className="mb-4 hidden items-center gap-2 px-3 lg:flex" />
                <nav aria-label="Principal">
                    <ul className="flex h-16 lg:h-auto lg:flex-col lg:gap-1">
                        {visible.map((item) => (
                            <NavEntry
                                key={item.to}
                                entry={item}
                                className={
                                    bottomBar.includes(item)
                                        ? 'flex flex-1 lg:flex-none'
                                        : 'hidden lg:flex lg:flex-none'
                                }
                            />
                        ))}
                        {hasMore && (
                            <NavEntry entry={MORE_ENTRY} className="flex flex-1 lg:hidden" />
                        )}
                    </ul>
                </nav>
            </aside>
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-linha bg-superficie px-4 md:px-6 lg:justify-end lg:border-b-0 lg:bg-fundo lg:px-8">
                <BrandRow className="flex items-center gap-2 lg:hidden" />
                <UserMenu user={user} />
            </header>
            <main className="px-4 pt-4 pb-20 md:px-6 md:pt-6 md:pb-22 lg:px-8 lg:pt-8 lg:pb-8">
                <Outlet />
            </main>
        </div>
    );
}
