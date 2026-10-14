import type { components } from '../../../src/api/generated/schema';

type EarningTypeResponse = components['schemas']['EarningTypeResponse'];
type ErrorBody = components['schemas']['Error'];

/** Tipos de receita de exemplo (spec 0014): dois ativos e um arquivado, fora da ordem de nome. */
export const SALARIO: EarningTypeResponse = {
    id: '6f1d2c4a-1b2e-4c3d-8e4f-000000000101',
    name: 'Salário',
    archivedAt: null,
    createdAt: '2026-01-05T12:00:00Z',
};

export const ALUGUEL_RECEBIDO: EarningTypeResponse = {
    id: '6f1d2c4a-1b2e-4c3d-8e4f-000000000102',
    name: 'Aluguel recebido',
    archivedAt: null,
    createdAt: '2026-01-05T12:00:00Z',
};

export const BONUS: EarningTypeResponse = {
    id: '6f1d2c4a-1b2e-4c3d-8e4f-000000000103',
    name: 'Bônus',
    archivedAt: '2026-09-01T12:00:00Z',
    createdAt: '2026-01-05T12:00:00Z',
};

export const EARNING_TYPES: readonly EarningTypeResponse[] = [SALARIO, BONUS, ALUGUEL_RECEBIDO];

/** Corpo `200` de `GET /earning-types?archived=true`. */
export const earningTypesList = (): { data: EarningTypeResponse[] } => ({
    data: [...EARNING_TYPES],
});

/** Corpo de sucesso de uma escrita sobre um tipo. */
export const earningTypeBody = (type: EarningTypeResponse): { data: EarningTypeResponse } => ({
    data: type,
});

/** Corpo `409` de um nome repetido. */
export const earningTypeAlreadyExists: ErrorBody = {
    error: { code: 'EARNING_TYPE_ALREADY_EXISTS', message: 'Earning type already exists' },
};
