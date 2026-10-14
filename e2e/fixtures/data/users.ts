import type { components } from '../../../src/api/generated/schema';

export type UserResponse = components['schemas']['UserResponse'];

// Usuários da plataforma para `GET /users` (spec 0010), na ordem da API (`createdAt`). O primeiro
// é o usuário `ativo` do fake de autenticação (o próprio ADMIN).

export const ADMIN_SELF: UserResponse = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ativo@example.com',
    emailVerified: true,
    name: 'Ana Souza',
    profile: 'ADMIN',
    profileGrantedAt: '2026-09-01T12:00:00Z',
    avatarUpdatedAt: null,
    createdAt: '2026-09-01T12:00:00Z',
};

export const BILLER_USER: UserResponse = {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'lancador@example.com',
    emailVerified: true,
    name: 'Lucas Martins',
    profile: 'BILLER',
    profileGrantedAt: '2026-09-05T12:00:00Z',
    avatarUpdatedAt: null,
    createdAt: '2026-09-05T12:00:00Z',
};

export const PENDING_USER: UserResponse = {
    id: '00000000-0000-4000-8000-000000000010',
    email: 'paula@example.com',
    emailVerified: true,
    name: 'Paula Nunes',
    profile: null,
    profileGrantedAt: null,
    avatarUpdatedAt: null,
    createdAt: '2026-10-10T12:00:00Z',
};

export const UNVERIFIED_USER: UserResponse = {
    id: '00000000-0000-4000-8000-000000000011',
    email: 'rafael@example.com',
    emailVerified: false,
    name: 'Rafael Costa',
    profile: null,
    profileGrantedAt: null,
    avatarUpdatedAt: null,
    createdAt: '2026-10-11T12:00:00Z',
};

export const USERS: readonly UserResponse[] = [
    ADMIN_SELF,
    BILLER_USER,
    PENDING_USER,
    UNVERIFIED_USER,
];

/** Corpo `200` de `GET /users`. */
export function usersList(users: readonly UserResponse[] = USERS) {
    return { data: [...users] };
}
