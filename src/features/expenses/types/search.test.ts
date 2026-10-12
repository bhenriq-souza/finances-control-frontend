import { describe, expect, it } from 'vitest';

import { parseExpenseTypesSearch } from './search';

describe('parseExpenseTypesSearch', () => {
    it('keeps the valid parameters', () => {
        expect(parseExpenseTypesSearch({ arquivados: 1, novo: '1', editar: 'abc' })).toEqual({
            arquivados: 1,
            novo: 1,
            editar: 'abc',
        });
    });

    // ERR-0012-04: parâmetro inválido é descartado.
    it('drops invalid parameters', () => {
        expect(
            parseExpenseTypesSearch({ arquivados: 'sim', novo: 2, editar: '  ', outro: 'x' }),
        ).toEqual({});
        expect(parseExpenseTypesSearch({ editar: 42 })).toEqual({});
    });
});
