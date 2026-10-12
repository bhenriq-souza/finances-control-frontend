import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { queryKeys } from '@/api/queries/keys';

import type { BankTransfer } from './api';
import {
    ANTIGA,
    CORRENTE,
    fail,
    getByPath,
    ok,
    POUPANCA,
    renderWithSearch,
    transfer,
} from './test-utils';
import { accountFieldOf } from './transfer-errors';
import { TransferFormDialog } from './transfer-form';

const onOpenChange = vi.fn();

async function renderForm(existing?: BankTransfer) {
    const result = await renderWithSearch({}, () => (
        <TransferFormDialog open onOpenChange={onOpenChange} transfer={existing} />
    ));
    return { ...result, dialog: screen.getByRole('dialog') };
}

function fill(dialog: HTMLElement, values: Record<string, string>) {
    for (const [label, value] of Object.entries(values)) {
        fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
}

async function save(dialog: HTMLElement) {
    await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    });
}

const optionsOf = (select: HTMLElement) =>
    within(select)
        .getAllByRole('option')
        .map((option) => option.textContent);

beforeEach(() => {
    vi.resetAllMocks();
    mocks.GET.mockImplementation(async (path: string) => getByPath({})(path));
    mocks.POST.mockResolvedValue(ok(transfer(), 201));
    mocks.PATCH.mockResolvedValue(ok(transfer()));
});

describe('TransferFormDialog — create (spec 0018)', () => {
    // AC-0018-02: a concluída envia `status: 'COMPLETED'`.
    it('creates a completed transfer by default', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-12T15:00:00Z'), toFake: ['Date'] });
        const { dialog, queryClient } = await renderForm();
        vi.useRealTimers();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

        expect(within(dialog).getByRole('heading', { name: 'Nova transferência' })).toBeVisible();
        expect(within(dialog).getByLabelText('Data')).toHaveValue('2026-10-12');
        expect(within(dialog).getByLabelText('Concluída agora')).toBeChecked();
        expect(within(dialog).getByText('Vazio usa a data da transferência.')).toBeInTheDocument();
        // Só as contas ativas.
        expect(optionsOf(within(dialog).getByLabelText('De'))).toEqual([
            'Escolha a conta',
            'Conta corrente',
            'Poupança',
        ]);

        fill(dialog, {
            De: CORRENTE,
            Para: POUPANCA,
            Valor: '1.234,56',
            Descrição: ' Reserva ',
            Observações: 'Mês de outubro',
        });
        await save(dialog);

        expect(mocks.POST).toHaveBeenCalledWith('/bank-transfers', {
            body: {
                fromBankAccountId: CORRENTE,
                toBankAccountId: POUPANCA,
                amountCents: 123456,
                occurredOn: '2026-10-12',
                status: 'COMPLETED',
                description: 'Reserva',
                notes: 'Mês de outubro',
            },
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(await screen.findByText('Transferência salva.')).toBeInTheDocument();
        // INV-0009-02: invalidação pela matriz, domínio `transfer`.
        expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
            ['bank-transfers'],
            ['bank-accounts'],
            ['reports'],
        ]);
    });

    it('sends completedOn only when it was given', async () => {
        const { dialog } = await renderForm();
        fill(dialog, {
            De: CORRENTE,
            Para: POUPANCA,
            Valor: '10',
            Data: '2026-10-01',
            'Concluída em': '2026-10-03',
            Descrição: 'Reserva',
        });
        await save(dialog);

        expect(mocks.POST.mock.calls[0]?.[1]).toEqual({
            body: expect.objectContaining({ status: 'COMPLETED', completedOn: '2026-10-03' }),
        });
    });

    // AC-0018-02: a agendada envia `status: 'SCHEDULED'` sem `completedOn`.
    it('creates a scheduled transfer without completedOn', async () => {
        const { dialog } = await renderForm();
        fill(dialog, { 'Concluída em': '2026-10-03' });
        fireEvent.click(within(dialog).getByLabelText('Agendar'));
        expect(within(dialog).queryByLabelText('Concluída em')).not.toBeInTheDocument();

        fill(dialog, {
            De: CORRENTE,
            Para: POUPANCA,
            Valor: '10',
            Data: '2026-11-01',
            Descrição: 'Reserva',
        });
        await save(dialog);

        const body = (mocks.POST.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
        expect(body).toEqual({
            fromBankAccountId: CORRENTE,
            toBankAccountId: POUPANCA,
            amountCents: 1000,
            occurredOn: '2026-11-01',
            status: 'SCHEDULED',
            description: 'Reserva',
        });
        expect(body).not.toHaveProperty('completedOn');
    });

    // AC-0018-03, INV-0018-03: a mesma conta em De e Para mostra o erro do schema e não envia.
    it('blocks the same account in De and Para', async () => {
        const { dialog } = await renderForm();
        fill(dialog, { Para: CORRENTE });
        // Para não oferece a de origem, mas a escolhida continua visível para o erro aparecer.
        fill(dialog, { De: POUPANCA });
        expect(optionsOf(within(dialog).getByLabelText('Para'))).toEqual([
            'Escolha a conta',
            'Conta corrente',
        ]);
        fill(dialog, { De: CORRENTE, Valor: '10', Descrição: 'Reserva' });
        expect(optionsOf(within(dialog).getByLabelText('Para'))).toEqual([
            'Escolha a conta',
            'Conta corrente',
            'Poupança',
        ]);
        expect(within(dialog).getByLabelText('Para')).toHaveValue(CORRENTE);
        await save(dialog);

        expect(within(dialog).getByLabelText('Para')).toHaveAccessibleDescription(
            'Escolha contas diferentes.',
        );
        expect(mocks.POST).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('requires the fields', async () => {
        const { dialog } = await renderForm();
        fill(dialog, { Data: '' });
        await save(dialog);

        expect(within(dialog).getByLabelText('De')).toHaveAccessibleDescription(
            'Escolha a conta de origem.',
        );
        expect(within(dialog).getByLabelText('Para')).toHaveAccessibleDescription(
            'Escolha a conta de destino.',
        );
        expect(within(dialog).getByLabelText('Valor')).toHaveAccessibleDescription(
            'Informe o valor.',
        );
        expect(within(dialog).getByLabelText('Data')).toHaveAccessibleDescription(
            'Informe a data.',
        );
        expect(within(dialog).getByLabelText('Descrição')).toHaveAccessibleDescription(
            'Informe a descrição.',
        );
        expect(mocks.POST).not.toHaveBeenCalled();
    });

    // ERR-0018-01: conta arquivada no campo pelo `details`, ou no alerta.
    it('puts an account error on De or Para by the details, or in the alert', async () => {
        const { dialog } = await renderForm();
        fill(dialog, { De: CORRENTE, Para: POUPANCA, Valor: '10', Descrição: 'Reserva' });

        mocks.POST.mockResolvedValueOnce(
            fail(409, 'BANK_ACCOUNT_ARCHIVED', { bankAccountId: POUPANCA }),
        );
        await save(dialog);
        expect(within(dialog).getByLabelText('Para')).toHaveAccessibleDescription(
            'Essa conta está arquivada. Reative a conta ou escolha outra.',
        );

        mocks.POST.mockResolvedValueOnce(fail(404, 'BANK_ACCOUNT_NOT_FOUND'));
        await save(dialog);
        expect(within(dialog).getByRole('alert')).toHaveTextContent(
            'Não encontramos essa conta. Atualize a página e tente de novo.',
        );
        // INV-0009-06: o formulário continua aberto e com os valores.
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Reserva');
    });

    // ERR-0018-03 / ERR-0009-04.
    it('maps a VALIDATION_ERROR to the fields', async () => {
        const { dialog } = await renderForm();
        fill(dialog, { De: CORRENTE, Para: POUPANCA, Valor: '10', Descrição: 'Reserva' });
        mocks.POST.mockResolvedValueOnce(
            fail(400, 'VALIDATION_ERROR', [
                { path: ['amountCents'], code: 'too_big', message: 'x' },
            ]),
        );
        await save(dialog);

        expect(within(dialog).getByLabelText('Valor')).toHaveAccessibleDescription(
            'Alguns dados são inválidos. Corrija os campos indicados e tente de novo.',
        );
    });
});

describe('TransferFormDialog — edit (spec 0018)', () => {
    const scheduled = transfer({
        status: 'SCHEDULED',
        completedOn: null,
        occurredOn: '2026-10-20',
        notes: 'Antes',
    });

    // INV-0018-02: na agendada, conta, valor e data são editáveis; o PATCH leva só o que mudou.
    it('patches only the changed fields of a scheduled transfer', async () => {
        const { dialog } = await renderForm(scheduled);

        expect(within(dialog).getByRole('heading', { name: 'Editar transferência' })).toBeVisible();
        expect(within(dialog).getByLabelText('Valor')).toHaveValue('500,00');
        expect(within(dialog).queryByLabelText('Concluída agora')).not.toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Concluída em')).not.toBeInTheDocument();

        fill(dialog, { Valor: '600', Data: '2026-10-21', Observações: '' });
        await save(dialog);

        expect(mocks.PATCH).toHaveBeenCalledWith('/bank-transfers/{id}', {
            params: { path: { id: scheduled.id } },
            body: { amountCents: 60000, occurredOn: '2026-10-21', notes: null },
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('patches the accounts and the description when they change', async () => {
        const archived = { ...scheduled, toBankAccountId: ANTIGA };
        const { dialog } = await renderForm(archived);
        // A conta arquivada já escolhida continua listada.
        expect(within(dialog).getByLabelText('Para')).toHaveValue(ANTIGA);

        fill(dialog, { De: POUPANCA, Para: CORRENTE, Descrição: 'Outra' });
        await save(dialog);

        expect(mocks.PATCH.mock.calls[0]?.[1]).toEqual({
            params: { path: { id: scheduled.id } },
            body: { fromBankAccountId: POUPANCA, toBankAccountId: CORRENTE, description: 'Outra' },
        });
    });

    it('closes without a request when nothing changed', async () => {
        const { dialog } = await renderForm(scheduled);
        await save(dialog);

        expect(mocks.PATCH).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // AC-0018-05: na concluída, só descrição e observações.
    it('shows only description and notes for a completed transfer', async () => {
        const completed = transfer({ notes: null });
        const { dialog } = await renderForm(completed);

        for (const label of ['De', 'Para', 'Valor', 'Data', 'Concluída agora', 'Concluída em']) {
            expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument();
        }
        fill(dialog, { Descrição: 'Nova descrição', Observações: 'Nota' });
        await save(dialog);

        expect(mocks.PATCH).toHaveBeenCalledWith('/bank-transfers/{id}', {
            params: { path: { id: completed.id } },
            body: { description: 'Nova descrição', notes: 'Nota' },
        });
    });

    // Mapa de erros: `BANK_TRANSFER_ALREADY_COMPLETED` vai para o alerta e recarrega o detalhe.
    it('shows a conflict in the alert and reloads the transfer', async () => {
        const { dialog, queryClient } = await renderForm(scheduled);
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        mocks.PATCH.mockResolvedValueOnce(fail(409, 'BANK_TRANSFER_ALREADY_COMPLETED'));
        fill(dialog, { Valor: '600' });
        await save(dialog);

        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.bankTransfers.all }),
        );
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('maps a completed-edit error to its alert', async () => {
        const { dialog } = await renderForm(transfer());
        mocks.PATCH.mockResolvedValueOnce(fail(404, 'BANK_TRANSFER_NOT_FOUND'));
        fill(dialog, { Descrição: 'Outra' });
        await save(dialog);

        expect(within(dialog).getByRole('alert')).not.toHaveTextContent('raw message');
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});

describe('accountFieldOf', () => {
    const sent = { fromBankAccountId: CORRENTE, toBankAccountId: POUPANCA };

    it('finds the field by name or by the account id, and nothing otherwise', () => {
        expect(accountFieldOf({ field: 'fromBankAccountId' }, sent)).toBe('fromBankAccountId');
        expect(accountFieldOf({ bankAccountId: CORRENTE }, sent)).toBe('fromBankAccountId');
        expect(accountFieldOf({ bankAccountId: POUPANCA }, sent)).toBe('toBankAccountId');
        expect(accountFieldOf({ bankAccountId: ANTIGA }, sent)).toBeNull();
        expect(accountFieldOf(undefined, sent)).toBeNull();
    });
});
