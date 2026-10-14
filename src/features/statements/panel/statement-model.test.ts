import { describe, expect, it } from 'vitest';

import {
    previousStatements,
    statementDetailSearchSchema,
    statementHref,
    statementsPanelSearchSchema,
    upcomingStatements,
    upcomingWindow,
} from './statement-model';
import { CARD_ID, CLOSED, CLOSED_ID, CURRENT, OLDER, OLDER_ID, UPCOMING } from './test-data';

describe('statement model (spec 0013)', () => {
    it('upcoming window: from the day after the current closing to 12 months after it', () => {
        expect(upcomingWindow('2026-11-08')).toEqual({ from: '2026-11-09', to: '2027-11-08' });
        expect(upcomingWindow('2026-12-31')).toEqual({ from: '2027-01-01', to: '2027-12-31' });
        // Dia que não existe no mês de destino: o último dia dele.
        expect(upcomingWindow('2024-02-29')).toEqual({ from: '2024-03-01', to: '2025-02-28' });
    });

    it('previous statements: only the persisted ones, newest closing first', () => {
        const previous = previousStatements([OLDER, CURRENT, CLOSED]);
        expect(previous.map((statement) => statement.id)).toEqual([CLOSED_ID, OLDER_ID]);
    });

    it('upcoming statements: oldest closing first, without touching the input', () => {
        const input = [...UPCOMING];
        expect(upcomingStatements(input).map((s) => s.closesOn)).toEqual([
            '2026-12-08',
            '2027-01-08',
        ]);
        expect(input[0]?.closesOn).toBe('2027-01-08');
    });

    it('links a persisted statement to its detail', () => {
        expect(statementHref(CARD_ID, CLOSED_ID)).toBe(`/cartoes/${CARD_ID}/faturas/${CLOSED_ID}`);
    });

    it('search params: valid ones kept, invalid ones dropped one by one', () => {
        expect(
            statementsPanelSearchSchema.parse({ pagar: 1, estorno: 1, despesa: OLDER_ID }),
        ).toEqual({ pagar: 1, estorno: 1, despesa: OLDER_ID });
        expect(
            statementsPanelSearchSchema.parse({ pagar: 'x', estorno: 1, despesa: 'nope' }),
        ).toEqual({ estorno: 1 });
        expect(statementDetailSearchSchema.parse({ pagar: 1, minimo: 2, estorno: 1 })).toEqual({
            pagar: 1,
            estorno: 1,
        });
    });
});
