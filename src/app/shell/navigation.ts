import type { LinkProps } from '@tanstack/react-router';
import {
    ArrowDown,
    ArrowLeftRight,
    ArrowUp,
    ChartColumn,
    CreditCard,
    Ellipsis,
    House,
    Landmark,
    type LucideIcon,
    Repeat,
    Users,
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
    /** Perfis que veem o item (INV-0006-03). */
    profiles: readonly Profile[];
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
    { to: '/usuarios', label: 'Usuários', icon: Users, profiles: ['ADMIN'], slot: 'mais' },
];

/** Máximo de itens de `slot: 'barra'` na barra inferior, sem contar o **Mais**. */
export const BOTTOM_BAR_LIMIT = 4;

/** O item **Mais** da barra inferior (celular e tablet). */
export const MORE_ENTRY: BottomBarEntry = { to: '/mais', label: 'Mais', icon: Ellipsis };

/** Só os itens cujo `profiles` inclui o perfil do usuário; sem perfil, nenhum (INV-0006-03). */
export function navItemsFor(
    profile: Profile | null,
    items: readonly NavItem[] = NAV_ITEMS,
): NavItem[] {
    if (!profile) return [];
    return items.filter((item) => item.profiles.includes(profile));
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
