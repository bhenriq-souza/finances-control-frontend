import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Route as E2eLayout } from '../[_]e2e';

import { E2E_PROOF_MARKER, ListProofPage } from './-lista-page';

type BeforeLoad = () => void;
const beforeLoad = E2eLayout.options.beforeLoad as unknown as BeforeLoad;

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('/_e2e proof routes (spec 0009)', () => {
    it('answer "not found" outside the e2e build', () => {
        vi.stubEnv('MODE', 'production');
        expect(beforeLoad).toThrow();
        try {
            beforeLoad();
        } catch (error) {
            expect(error).toMatchObject({ isNotFound: true });
        }
    });

    it('are open in the e2e build', () => {
        vi.stubEnv('MODE', 'e2e');
        expect(beforeLoad).not.toThrow();
    });

    it('the list proof page carries the build marker and renders static data', async () => {
        const root = createRootRoute();
        const page = createRoute({
            getParentRoute: () => root,
            path: '/',
            component: ListProofPage,
        });
        const router = createRouter({
            routeTree: root.addChildren([page]),
            history: createMemoryHistory({ initialEntries: ['/'] }),
        });
        await router.load();
        await act(async () => {
            render(<RouterProvider router={router} />);
        });

        expect(E2E_PROOF_MARKER).toBe('__E2E_FAKE_AUTH__');
        expect(screen.getByRole('main')).toHaveAttribute('data-e2e-marker', E2E_PROOF_MARKER);
        expect(screen.getByRole('table', { name: 'Despesas de outubro' })).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Nenhuma receita neste mês.' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Despesas por tipo' })).toBeInTheDocument();
    });
});
