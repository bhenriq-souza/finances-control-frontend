import { describe, expect, it } from 'vitest';

import { parseEarningTypesSearch } from './search';

describe('parseEarningTypesSearch', () => {
    it('keeps the valid parameters', () => {
        expect(parseEarningTypesSearch({ arquivados: 1, novo: '1', editar: 'tipo-1' })).toEqual({
            arquivados: 1,
            novo: 1,
            editar: 'tipo-1',
        });
    });

    // ERR-0014-04: parâmetro inválido é descartado e vale o padrão.
    it('drops invalid parameters and leaves the absent ones out', () => {
        expect(parseEarningTypesSearch({})).toEqual({});
        expect(
            parseEarningTypesSearch({ arquivados: 'sim', novo: 2, editar: '  ', outro: 'x' }),
        ).toEqual({});
        expect(parseEarningTypesSearch({ editar: 42 })).toEqual({});
    });
});
