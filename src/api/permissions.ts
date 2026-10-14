import { type Profile, useCurrentUser } from './queries/current-user';

/** Permissões de escrita (spec 0009, "Permissões"); leitura é de todo perfil. */
export type Permission = 'users.manage' | 'accounts.write' | 'entries.write';

const PERMISSIONS: Readonly<Record<Permission, readonly Profile[]>> = {
    'users.manage': ['ADMIN'],
    'accounts.write': ['ADMIN'],
    'entries.write': ['ADMIN', 'BILLER'],
};

/** O perfil tem a permissão; sem perfil, nunca. */
export function can(profile: Profile | null | undefined, permission: Permission): boolean {
    return profile != null && PERMISSIONS[permission].includes(profile);
}

/**
 * Permissão do usuário atual, lido do cache `['users', 'me']` (garantido pela guarda de `_app`).
 * Controle sem permissão não é renderizado (INV-0009-03).
 */
export function useCan(permission: Permission): boolean {
    return can(useCurrentUser().profile, permission);
}
