import { describe, expect, it } from 'vitest';

import { INVALID_DATE_MESSAGE } from '@/shared/dates';

import { earningFormSchema, type EarningFormValues } from './earning-schema';

const VALID: EarningFormValues = {
    kind: 'VARIABLE',
    description: 'Salário',
    earningTypeId: 't1',
    amount: '10,00',
    bankAccountId: 'a1',
    occurredOn: '2026-10-05',
    installmentTotal: '',
    recurrenceEndsOn: '',
    status: 'OPEN',
    notes: '',
    scope: 'one',
};

// Um texto inválido deixado em **Repetir até** escondido não trava o envio (spec 0009, DateField).
describe('hidden Repetir até', () => {
    it('is ignored outside Fixa and refused in Fixa', () => {
        const schema = earningFormSchema('create');
        expect(schema.safeParse({ ...VALID, recurrenceEndsOn: '31/02/2026' }).success).toBe(true);

        const shown = schema.safeParse({ ...VALID, kind: 'FIXED', recurrenceEndsOn: '31/02/2026' });
        expect(shown.success).toBe(false);
        expect(shown.error?.issues.map((issue) => issue.message)).toContain(INVALID_DATE_MESSAGE);
    });
});
