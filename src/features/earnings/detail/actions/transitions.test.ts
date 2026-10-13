import { describe, expect, it } from 'vitest';

import { earning } from '../../list/test-data';

import { ACTION_TARGET, canDelete, deleteCascade, statusActions } from './transitions';

describe('earning transitions (spec 0014)', () => {
    // INV-0014-02: as ações de cada status são exatamente as da tabela.
    it.each([
        ['FORECAST', ['confirmar']],
        ['OPEN', ['receber', 'verificar']],
        ['OVERDUE', ['receber', 'verificar']],
        ['VERIFYING', ['receber', 'voltar']],
        ['RECEIVED', ['desfazer']],
    ] as const)('offers exactly the table actions for %s', (status, actions) => {
        expect(statusActions(status)).toEqual(actions);
    });

    it('maps each action to its target status', () => {
        expect(ACTION_TARGET).toEqual({
            confirmar: 'OPEN',
            receber: 'RECEIVED',
            verificar: 'VERIFYING',
            voltar: 'OPEN',
            desfazer: 'OPEN',
        });
    });

    it('only deletes an earning that is not received', () => {
        expect(canDelete({ status: 'RECEIVED' })).toBe(false);
        for (const status of ['FORECAST', 'OPEN', 'OVERDUE', 'VERIFYING'] as const) {
            expect(canDelete({ status })).toBe(true);
        }
    });

    // INV-0014-03: o texto da cascata de cada forma de receita.
    it('describes the delete cascade of single, installment and series earnings', () => {
        expect(deleteCascade(earning({ id: 'a' }))).toBe('A receita será excluída.');
        expect(
            deleteCascade(earning({ id: 'b', installment: { groupId: 'g', number: 1, total: 3 } })),
        ).toBe('Todas as parcelas não recebidas deste parcelamento serão excluídas.');
        expect(deleteCascade(earning({ id: 'c', recurrenceId: 's' }))).toBe(
            'Esta ocorrência e as seguintes ainda não recebidas serão excluídas, e a série termina.',
        );
    });
});
