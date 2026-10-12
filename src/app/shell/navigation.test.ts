import { ArrowUp, House } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
    BOTTOM_BAR_LIMIT,
    bottomBarEntries,
    MORE_ENTRY,
    moreItems,
    NAV_ITEMS,
    navItemsFor,
    type NavItem,
} from './navigation';

const item = (
    label: string,
    profiles: NavItem['profiles'],
    slot: NavItem['slot'] = 'barra',
): NavItem => ({
    to: '/',
    label,
    icon: House,
    profiles,
    slot,
});

const ALL = ['ADMIN', 'BILLER', 'VIEWER'] as const;
const labels = (entries: readonly { label: string }[]) => entries.map(({ label }) => label);

// INV-0006-03: a navegação mostra só itens cujo `profiles` inclui o perfil do usuário.
describe('navItemsFor', () => {
    it('shows the spec 0009 items to every profile, in order', () => {
        const common = ['Início', 'Despesas', 'Receitas', 'Cartões', 'Contas', 'Transferências'];
        for (const profile of ['BILLER', 'VIEWER'] as const) {
            expect(labels(navItemsFor(profile))).toEqual(common);
        }
        expect(labels(navItemsFor('ADMIN'))).toEqual([...common, 'Usuários']);
        expect(NAV_ITEMS.map(({ to }) => to)).toEqual([
            '/',
            '/despesas',
            '/receitas',
            '/cartoes',
            '/contas',
            '/transferencias',
            '/usuarios',
        ]);
    });

    // INV-0010-01: só `ADMIN` vê **Usuários**, na página Mais (spec 0010).
    it('shows Usuários only to ADMIN, in the mais slot', () => {
        const users = NAV_ITEMS.find(({ to }) => to === '/usuarios');
        expect(users).toMatchObject({ label: 'Usuários', profiles: ['ADMIN'], slot: 'mais' });
        expect(labels(moreItems(navItemsFor('ADMIN')))).toContain('Usuários');
        for (const profile of ['BILLER', 'VIEWER'] as const) {
            expect(labels(navItemsFor(profile))).not.toContain('Usuários');
        }
    });

    // Spec 0014, "Rotas e navegação": Receitas na barra, para todos os perfis.
    it('declares Receitas in the bottom bar with the ArrowUp icon', () => {
        expect(NAV_ITEMS.find(({ to }) => to === '/receitas')).toEqual({
            to: '/receitas',
            label: 'Receitas',
            icon: ArrowUp,
            profiles: ALL,
            slot: 'barra',
        });
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

// AC-0009-08: barra inferior com até quatro itens de `slot: 'barra'` e o Mais quando houver itens
// visíveis de `slot: 'mais'`; a página Mais lista esses itens.
describe('navigation slots', () => {
    // AC-0011-08: Cartões na barra inferior; Contas em Mais.
    it('declares Início and Cartões in the bottom bar and Contas in Mais', () => {
        expect(NAV_ITEMS.find(({ to }) => to === '/')?.slot).toBe('barra');
        expect(NAV_ITEMS.find(({ to }) => to === '/despesas')?.slot).toBe('barra');
        expect(NAV_ITEMS.find(({ to }) => to === '/receitas')?.slot).toBe('barra');
        expect(NAV_ITEMS.find(({ to }) => to === '/cartoes')?.slot).toBe('barra');
        expect(NAV_ITEMS.find(({ to }) => to === '/contas')?.slot).toBe('mais');
        for (const profile of ['ADMIN', 'BILLER', 'VIEWER'] as const) {
            expect(labels(bottomBarEntries(navItemsFor(profile)))).toEqual([
                'Início',
                'Despesas',
                'Receitas',
                'Cartões',
                'Mais',
            ]);
        }
        // AC-0018-07: Transferências em Mais.
        expect(NAV_ITEMS.find(({ to }) => to === '/transferencias')?.slot).toBe('mais');
        expect(labels(moreItems(navItemsFor('ADMIN')))).toEqual([
            'Contas',
            'Transferências',
            'Usuários',
        ]);
        expect(labels(moreItems(navItemsFor('BILLER')))).toEqual(['Contas', 'Transferências']);
        expect(MORE_ENTRY.to).toBe('/mais');
        expect(MORE_ENTRY.label).toBe('Mais');
    });

    it('shows Mais after the bar items when a mais item is visible, and lists it', () => {
        const visible = navItemsFor('VIEWER', [item('Início', ALL), item('Contas', ALL, 'mais')]);
        expect(labels(bottomBarEntries(visible))).toEqual(['Início', 'Mais']);
        expect(labels(moreItems(visible))).toEqual(['Contas']);
    });

    it('hides Mais when no mais item is visible to the profile', () => {
        const items = [item('Início', ALL), item('Usuários', ['ADMIN'], 'mais')];
        expect(labels(bottomBarEntries(navItemsFor('ADMIN', items)))).toEqual(['Início', 'Mais']);
        expect(labels(bottomBarEntries(navItemsFor('BILLER', items)))).toEqual(['Início']);
        expect(moreItems(navItemsFor('BILLER', items))).toEqual([]);
    });

    it('keeps at most four bar items, in list order, plus Mais', () => {
        const items = [
            item('A', ALL),
            item('M1', ALL, 'mais'),
            item('B', ALL),
            item('C', ALL),
            item('D', ALL),
            item('E', ALL),
            item('M2', ALL, 'mais'),
        ];
        const bar = bottomBarEntries(navItemsFor('ADMIN', items));
        expect(BOTTOM_BAR_LIMIT).toBe(4);
        expect(labels(bar)).toEqual(['A', 'B', 'C', 'D', 'Mais']);
        expect(labels(moreItems(navItemsFor('ADMIN', items)))).toEqual(['M1', 'M2']);
    });
});
