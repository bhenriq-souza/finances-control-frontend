import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get, POST: mocks.post } }));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { CreditCard } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import type { Statement } from '../panel/statement-model';
import { ACCOUNTS, CARD_ID, CLOSED, CLOSED_ID, CURRENT, OLDER } from '../panel/test-data';

import { useStatementPayQuickAction, type StatementPayRequest } from './pay-quick-action';

const ok = (data: unknown) => ({
    data: { data },
    error: undefined,
    response: new Response(null, { status: 200 }),
});
const failure = (status: number, code: string) => ({
    data: undefined,
    error: { error: { code, message: 'raw' } },
    response: new Response(null, { status }),
});

const CARD = { id: CARD_ID, name: 'Nubank Roxinho', paymentBankAccountId: null } as CreditCard;

let detail: ReturnType<typeof ok> | ReturnType<typeof failure>;

async function renderHost(
    rows: readonly Statement[],
    initial: StatementPayRequest | undefined,
    profile: Profile = 'BILLER',
) {
    mocks.get.mockImplementation((route: string) => {
        if (route === '/statements/{id}') return Promise.resolve(detail);
        if (route === '/statements') return Promise.resolve(ok([CLOSED]));
        return Promise.resolve(ok([]));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(CURRENT_USER_QUERY_KEY, { profile });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, [CARD]);
    const requests: (StatementPayRequest | undefined)[] = [];

    function Harness() {
        const [request, setRequest] = useState(initial);
        const action = useStatementPayQuickAction(request, (next) => {
            requests.push(next);
            setRequest(next);
        });
        return (
            <>
                <ul>
                    {rows.map((row) => (
                        <li key={row.closesOn}>{action.rowMenu?.(row)}</li>
                    ))}
                </ul>
                {action.dialogs}
                <p>pedido: {request ? request.statementId : 'nenhum'}</p>
            </>
        );
    }

    const router = createRouter({
        routeTree: createRootRoute({ component: Harness }),
        history: createMemoryHistory(),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={client}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { requests };
}

beforeEach(() => {
    vi.resetAllMocks();
    detail = ok({ ...CLOSED, payments: [] });
});

// AC-0015-16, INV-0015-06: Pagar fatura sobre outra tela, com o mesmo diálogo do detalhe.
describe('useStatementPayQuickAction (spec 0015)', () => {
    it('offers Pagar fatura only on a closed statement with something to pay, and opens the pay dialog', async () => {
        const paid: Statement = { ...OLDER, status: 'PAID', remainingCents: 0 };
        const { requests } = await renderHost([CLOSED, CURRENT, paid], undefined);

        const triggers = screen.getAllByRole('button', { name: 'Ações da fatura Nubank Roxinho' });
        expect(triggers).toHaveLength(1);

        fireEvent.pointerDown(triggers[0]!, { button: 0, ctrlKey: false });
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Pagar fatura' }));
        expect(requests).toEqual([{ statementId: CLOSED_ID, cardId: CARD_ID }]);
        expect(await screen.findByRole('dialog', { name: 'Pagar fatura' })).toBeVisible();
        expect(mocks.get).toHaveBeenCalledWith('/statements/{id}', {
            params: { path: { id: CLOSED_ID } },
        });
    });

    it('drops an unknown statement', async () => {
        detail = failure(404, 'STATEMENT_NOT_FOUND');
        const { requests } = await renderHost([], { statementId: CLOSED_ID, cardId: CARD_ID });
        await waitFor(() => expect(requests).toEqual([undefined]));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('drops a statement of another card or one that cannot be paid from the row', async () => {
        const { requests } = await renderHost([], { statementId: CLOSED_ID, cardId: 'other' });
        await waitFor(() => expect(requests).toEqual([undefined]));

        detail = ok({ ...CLOSED, status: 'PAID', remainingCents: 0 });
        const second = await renderHost([], { statementId: CLOSED_ID, cardId: CARD_ID });
        await waitFor(() => expect(second.requests).toEqual([undefined]));
    });

    it('gives a leitor no menu and no dialog', async () => {
        await renderHost([CLOSED], { statementId: CLOSED_ID, cardId: CARD_ID }, 'VIEWER');
        expect(screen.queryByRole('button', { name: /Ações da fatura/ })).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(mocks.get).not.toHaveBeenCalledWith('/statements/{id}', expect.anything());
    });
});
