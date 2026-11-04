import type { LinkProps } from '@tanstack/react-router';
import {
    ArrowDown,
    ArrowLeftRight,
    ArrowUp,
    Building2,
    ChartColumn,
    CreditCard,
    Ellipsis,
    House,
    Landmark,
    type LucideIcon,
    Repeat,
    Tag,
    Tags,
    Users,
    Wallet,
} from 'lucide-react';

import type { Profile } from '@/features/identity';

/**
 * Onde o item aparece no celular e no tablet (spec 0009, "Navegação — campo `slot` e a página
 * Mais"): na barra inferior ou na página **Mais**. No desktop a lateral mostra todos.
 */
export type NavSlot = 'barra' | 'mais';

/** Item da navegação principal do shell (spec 0006, "App shell"). */
export interface NavItem {
    to: NonNullable<LinkProps['to']>;
    label: string;
    icon: LucideIcon;
    /** Perfis que veem o item (INV-0006-03); ignorado quando `platformAdmin` está marcado. */
    profiles: readonly Profile[];
    /** Item só do admin da plataforma (spec 0021); `profiles` não vale para ele. */
    platformAdmin?: true;
    /** Com `platformAdmin`: só aparece para quem ainda não tem espaço (atalho para os catálogos). */
    withoutWorkspace?: true;
    slot: NavSlot;
}

/** Entrada da barra inferior: um item de `slot: 'barra'` ou o próprio **Mais**. */
export type BottomBarEntry = Pick<NavItem, 'to' | 'label' | 'icon'>;

const ALL_PROFILES: readonly Profile[] = ['ADMIN', 'BILLER', 'VIEWER'];

/** Itens da navegação, na ordem de exibição; cada spec de tela acrescenta os seus. */
export const NAV_ITEMS: readonly NavItem[] = [
    { to: '/', label: 'Início', icon: House, profiles: ALL_PROFILES, slot: 'barra' },
    { to: '/despesas', label: 'Despesas', icon: ArrowDown, profiles: ALL_PROFILES, slot: 'barra' },
    { to: '/receitas', label: 'Receitas', icon: ArrowUp, profiles: ALL_PROFILES, slot: 'barra' },
    { to: '/cartoes', label: 'Cartões', icon: CreditCard, profiles: ALL_PROFILES, slot: 'barra' },
    {
        to: '/fluxo-de-caixa',
        label: 'Fluxo de caixa',
        icon: Wallet,
        profiles: ALL_PROFILES,
        slot: 'mais',
    },
    { to: '/contas', label: 'Contas', icon: Landmark, profiles: ALL_PROFILES, slot: 'mais' },
    {
        to: '/transferencias',
        label: 'Transferências',
        icon: ArrowLeftRight,
        profiles: ALL_PROFILES,
        slot: 'mais',
    },
    { to: '/series', label: 'Séries fixas', icon: Repeat, profiles: ALL_PROFILES, slot: 'mais' },
    {
        to: '/relatorios',
        label: 'Relatórios',
        icon: ChartColumn,
        profiles: ALL_PROFILES,
        slot: 'mais',
    },
    {
        to: '/usuarios',
        label: 'Usuários',
        icon: Users,
        profiles: [],
        platformAdmin: true,
        slot: 'mais',
    },
    {
        to: '/contas/bancos',
        label: 'Bancos',
        icon: Building2,
        profiles: [],
        platformAdmin: true,
        withoutWorkspace: true,
        slot: 'mais',
    },
    {
        to: '/despesas/tipos',
        label: 'Tipos de despesa',
        icon: Tags,
        profiles: [],
        platformAdmin: true,
        withoutWorkspace: true,
        slot: 'mais',
    },
    {
        to: '/receitas/tipos',
        label: 'Tipos de receita',
        icon: Tag,
        profiles: [],
        platformAdmin: true,
        withoutWorkspace: true,
        slot: 'mais',
    },
];

/** Máximo de itens de `slot: 'barra'` na barra inferior, sem contar o **Mais**. */
export const BOTTOM_BAR_LIMIT = 4;

/** O item **Mais** da barra inferior (celular e tablet). */
export const MORE_ENTRY: BottomBarEntry = { to: '/mais', label: 'Mais', icon: Ellipsis };

/** O recorte do usuário que decide a navegação. */
export interface NavSubject {
    profile: Profile | null;
    isPlatformAdmin?: boolean;
}

/**
 * Os itens do usuário (INV-0006-03, spec 0021): item com `platformAdmin` só para o admin da
 * plataforma (e os de `withoutWorkspace`, só sem espaço); os demais, só quando `profiles` inclui
 * o perfil. Sem perfil (admin da plataforma sem espaço), só os itens marcados.
 */
export function navItemsFor(
    user: NavSubject | Profile | null,
    items: readonly NavItem[] = NAV_ITEMS,
): NavItem[] {
    if (!user) return [];
    const { profile, isPlatformAdmin } =
        typeof user === 'string' ? { profile: user, isPlatformAdmin: false } : user;
    return items.filter((item) => {
        if (!item.platformAdmin) return profile !== null && item.profiles.includes(profile);
        if (item.withoutWorkspace && profile !== null) return false;
        return isPlatformAdmin === true;
    });
}

/** Rotas que o admin da plataforma sem espaço alcança (spec 0021). */
export function reachableWithoutWorkspace(pathname: string): boolean {
    return (
        pathname === '/usuarios' ||
        pathname === '/mais' ||
        pathname === '/contas/bancos' ||
        pathname === '/despesas/tipos' ||
        pathname === '/receitas/tipos'
    );
}

/** Os itens visíveis de `slot: 'mais'`, na ordem da lista: o conteúdo da página `/mais`. */
export function moreItems(visible: readonly NavItem[]): NavItem[] {
    return visible.filter((item) => item.slot === 'mais');
}

/**
 * A barra inferior: os itens visíveis de `slot: 'barra'`, no máximo quatro, e o **Mais** quando
 * houver algum item visível de `slot: 'mais'`.
 */
export function bottomBarEntries(visible: readonly NavItem[]): BottomBarEntry[] {
    const bar: BottomBarEntry[] = visible
        .filter((item) => item.slot === 'barra')
        .slice(0, BOTTOM_BAR_LIMIT);
    return moreItems(visible).length > 0 ? [...bar, MORE_ENTRY] : bar;
}
