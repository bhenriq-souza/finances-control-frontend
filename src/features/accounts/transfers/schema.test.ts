import { describe, expect, it } from 'vitest';

import { INVALID_DATE_MESSAGE } from '@/shared/dates';

import { transferSchema, type TransferValues } from './schema';

const VALID: TransferValues = {
    description: 'Reserva',
    notes: '',
    fromBankAccountId: 'a1',
    toBankAccountId: 'a2',
    amount: '10,00',
    occurredOn: '2026-10-05',
    status: 'SCHEDULED',
    completedOn: '',
};

// Um texto inválido deixado na data de conclusão escondida não trava o envio (spec 0009, DateField).
describe('hidden completedOn', () => {
    it('is ignored for a scheduled transfer and refused for a completed one', () => {
        expect(transferSchema.safeParse({ ...VALID, completedOn: '05/1' }).success).toBe(true);

        const shown = transferSchema.safeParse({
            ...VALID,
            status: 'COMPLETED',
            completedOn: '05/1',
        });
        expect(shown.success).toBe(false);
        expect(shown.error?.issues.map((issue) => issue.message)).toContain(INVALID_DATE_MESSAGE);
    });
});
