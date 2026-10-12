import { House } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, navItemsFor, type NavItem } from './navigation';

const item = (label: string, profiles: NavItem['profiles']): NavItem => ({
    to: '/',
    label,
    icon: House,
    profiles,
});

// INV-0006-03: a navegação mostra só itens cujo `profiles` inclui o perfil do usuário.
describe('navItemsFor', () => {
    it('shows Início to every profile', () => {
        for (const profile of ['ADMIN', 'BILLER', 'VIEWER'] as const) {
            expect(navItemsFor(profile).map(({ label }) => label)).toEqual(['Início']);
        }
        expect(NAV_ITEMS[0]?.to).toBe('/');
    });

    it('keeps only the items whose profiles include the user profile, in order', () => {
        const items = [
            item('Todos', ['ADMIN', 'BILLER', 'VIEWER']),
            item('Só admin', ['ADMIN']),
            item('Lançamentos', ['ADMIN', 'BILLER']),
        ];
        expect(navItemsFor('ADMIN', items).map(({ label }) => label)).toEqual([
            'Todos',
            'Só admin',
            'Lançamentos',
        ]);
        expect(navItemsFor('BILLER', items).map(({ label }) => label)).toEqual([
            'Todos',
            'Lançamentos',
        ]);
        expect(navItemsFor('VIEWER', items).map(({ label }) => label)).toEqual(['Todos']);
    });

    it('shows nothing without a profile', () => {
        expect(navItemsFor(null)).toEqual([]);
    });
});
