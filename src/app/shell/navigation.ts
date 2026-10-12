import type { LinkProps } from '@tanstack/react-router';
import { House, type LucideIcon } from 'lucide-react';

import type { Profile } from '@/features/identity';

/** Item da navegação principal do shell (spec 0006, "App shell"). */
export interface NavItem {
    to: NonNullable<LinkProps['to']>;
    label: string;
    icon: LucideIcon;
    /** Perfis que veem o item (INV-0006-03). */
    profiles: readonly Profile[];
}

const ALL_PROFILES: readonly Profile[] = ['ADMIN', 'BILLER', 'VIEWER'];

/** Itens da navegação, na ordem de exibição; cada spec de tela acrescenta os seus. */
export const NAV_ITEMS: readonly NavItem[] = [
    { to: '/', label: 'Início', icon: House, profiles: ALL_PROFILES },
];

/** Só os itens cujo `profiles` inclui o perfil do usuário; sem perfil, nenhum (INV-0006-03). */
export function navItemsFor(
    profile: Profile | null,
    items: readonly NavItem[] = NAV_ITEMS,
): NavItem[] {
    if (!profile) return [];
    return items.filter((item) => item.profiles.includes(profile));
}
