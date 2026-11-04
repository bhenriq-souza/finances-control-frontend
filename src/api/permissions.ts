import { type CurrentUser, type Profile, useCurrentUser } from './queries/current-user';

/** Permissões de escrita (spec 0009, "Permissões", alterada pela spec 0021); leitura é de todo perfil. */
export type Permission = 'users.manage' | 'catalog.write' | 'accounts.write' | 'entries.write';

/** Permissões que dependem da marca de admin da plataforma, e não do perfil (spec 0021). */
const PLATFORM_PERMISSIONS: readonly Permission[] = ['users.manage', 'catalog.write'];

const PROFILE_PERMISSIONS: Readonly<Partial<Record<Permission, readonly Profile[]>>> = {
    'accounts.write': ['ADMIN'],
    'entries.write': ['ADMIN', 'BILLER'],
};

/** O recorte do usuário que decide permissões. */
export type PermissionSubject = Pick<CurrentUser, 'profile' | 'isPlatformAdmin'>;

/** O usuário tem a permissão; sem usuário, nunca. */
export function can(user: PermissionSubject | null | undefined, permission: Permission): boolean {
    if (!user) return false;
    if (PLATFORM_PERMISSIONS.includes(permission)) return user.isPlatformAdmin === true;
    return user.profile != null && (PROFILE_PERMISSIONS[permission] ?? []).includes(user.profile);
}

/**
 * Permissão do usuário atual, lido do cache `['users', 'me']` (garantido pela guarda de `_app`).
 * Controle sem permissão não é renderizado (INV-0009-03).
 */
export function useCan(permission: Permission): boolean {
    return can(useCurrentUser(), permission);
}
