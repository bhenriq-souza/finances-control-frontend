import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), PATCH: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import type { ExpenseRecurrence } from './api';
import { ExpenseRecurrenceDetailPage } from './expense-recurrence-detail';
import {
    defaultEndsOn,
    END_EFFECT_TEXT,
    ENDS_BEFORE_START_MESSAGE,
    endRecurrenceSchema,
} from './recurrence-model';
import { fail, ok, recurrence, renderWithSearch, SERIES_ID } from './test-utils';

// AC-0017-03, INV-0017-01, INV-0017-02: **Encerrar série** mostra o efeito antes e envia só
// `{ endsOn }`.

const SERIES = recurrence();

async function renderDetail(data: ExpenseRecurrence = SERIES) {
    mocks.GET.mockImplementation(async (path: string) =>
        path === '/expense-recurrences/{id}' ? ok(data) : ok([]),
    );
    await renderWithSearch({}, (current, onSearchChange) => (
        <ExpenseRecurrenceDetailPage
            recurrenceId={data.id}
            search={current}
            onSearchChange={onSearchChange}
        />
    ));
    await screen.findByRole('heading', { name: data.description, level: 1 });
}

async function openDialog() {
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar série' }));
    return screen.findByRole('dialog', { name: 'Encerrar a série?' });
}

async function submit(dialog: HTMLElement) {
    await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Encerrar série' }));
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: new Date('2026-10-13T15:00:00Z'), toFake: ['Date'] });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('EndExpenseRecurrenceDialog (spec 0017)', () => {
    // INV-0017-02: o efeito está no diálogo antes do envio.
    it('shows the effect and defaults Último mês to the end of the current month', async () => {
        await renderDetail();
        const dialog = await openDialog();

        expect(within(dialog).getByText(END_EFFECT_TEXT)).toBeInTheDocument();
        expect(within(dialog).getByLabelText('Último mês')).toHaveValue('31/10/2026');
        expect(mocks.PATCH).not.toHaveBeenCalled();
    });

    // AC-0017-03, INV-0017-01.
    it('sends PATCH with only { endsOn } and closes with a notice', async () => {
        mocks.PATCH.mockResolvedValue(ok({ ...SERIES, endsOn: '2026-11-30' }));
        await renderDetail();
        const dialog = await openDialog();

        fireEvent.change(within(dialog).getByLabelText('Último mês'), {
            target: { value: '2026-11-30' },
        });
        await submit(dialog);

        expect(mocks.PATCH).toHaveBeenCalledTimes(1);
        expect(mocks.PATCH).toHaveBeenCalledWith('/expense-recurrences/{id}', {
            params: { path: { id: SERIES_ID } },
            body: { endsOn: '2026-11-30' },
        });
        const [, options] = mocks.PATCH.mock.calls[0] as [string, { body: object }];
        expect(Object.keys(options.body)).toEqual(['endsOn']);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(await screen.findByText('Série encerrada.')).toBeInTheDocument();
    });

    it('never sends an endsOn before startsOn', async () => {
        await renderDetail();
        const dialog = await openDialog();

        fireEvent.change(within(dialog).getByLabelText('Último mês'), {
            target: { value: '2026-07-31' },
        });
        await submit(dialog);

        expect(await within(dialog).findByText(ENDS_BEFORE_START_MESSAGE)).toBeInTheDocument();
        expect(mocks.PATCH).not.toHaveBeenCalled();
    });

    // ERR-0017-01: `VALIDATION_ERROR` em `endsOn` vai ao campo.
    it('puts a VALIDATION_ERROR on endsOn in the Último mês field', async () => {
        mocks.PATCH.mockResolvedValue(fail(400, 'VALIDATION_ERROR', [{ path: ['endsOn'] }]));
        await renderDetail();
        const dialog = await openDialog();
        await submit(dialog);

        const field = within(dialog).getByLabelText('Último mês');
        await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
        expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    });

    // ERR-0017-01: o não encontrado vai ao alerta, dentro do diálogo, que continua aberto.
    it('shows EXPENSE_RECURRENCE_NOT_FOUND in an alert and keeps the dialog open', async () => {
        mocks.PATCH.mockResolvedValue(fail(404, 'EXPENSE_RECURRENCE_NOT_FOUND'));
        await renderDetail();
        const dialog = await openDialog();
        await submit(dialog);

        const alert = await within(dialog).findByRole('alert');
        expect(alert.textContent).not.toContain('raw message');
        expect(alert.textContent).not.toBe('');
        expect(screen.getByRole('dialog', { name: 'Encerrar a série?' })).toBeInTheDocument();
    });
});

describe('recurrence-model', () => {
    it('defaults to the end of the start month for a series that has not started', () => {
        expect(defaultEndsOn({ startsOn: '2026-12-10' }, '2026-10-13')).toBe('2026-12-31');
        expect(defaultEndsOn({ startsOn: '2026-08-05' }, '2026-10-13')).toBe('2026-10-31');
    });

    it('requires an endsOn not before startsOn', () => {
        const schema = endRecurrenceSchema('2026-08-05');
        expect(schema.safeParse({ endsOn: '2026-08-05' }).success).toBe(true);
        expect(schema.safeParse({ endsOn: '2026-08-04' }).success).toBe(false);
        expect(schema.safeParse({ endsOn: '' }).success).toBe(false);
    });
});
