import type { Page, Route } from '@playwright/test';

/**
 * Usuários fixos do fake de autenticação (spec 0006, "Fake de autenticação no e2e"); `lancador`
 * e `leitor` são da spec 0009.
 */
export type E2EUser =
    | 'ativo'
    | 'lancador'
    | 'leitor'
    | 'admin-sem-espaco'
    | 'admin-de-espaco'
    | 'sem-perfil'
    | 'email-nao-verificado'
    | 'nenhum';

type Person = { id: string; email: string; name: string };

type Workspace = { id: string; name: string } | null;

/** O espaço `Principal`, em que ficam os usuários com perfil (spec 0021). */
export const MAIN_WORKSPACE = { id: '00000000-0000-4000-8000-0000000000a1', name: 'Principal' };

/** Perfil e pessoa que `GET /users/me` devolve para cada usuário que tem conta no backend. */
const BACKEND_USERS = {
    ativo: {
        profile: 'ADMIN',
        workspace: MAIN_WORKSPACE,
        isPlatformAdmin: true,
        person: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'ativo@example.com',
            name: 'Ana Souza',
        },
    },
    lancador: {
        profile: 'BILLER',
        workspace: MAIN_WORKSPACE,
        isPlatformAdmin: false,
        person: {
            id: '00000000-0000-4000-8000-000000000003',
            email: 'lancador@example.com',
            name: 'Lucas Martins',
        },
    },
    leitor: {
        profile: 'VIEWER',
        workspace: MAIN_WORKSPACE,
        isPlatformAdmin: false,
        person: {
            id: '00000000-0000-4000-8000-000000000004',
            email: 'leitor@example.com',
            name: 'Lívia Rocha',
        },
    },
    'admin-sem-espaco': {
        profile: null,
        workspace: null,
        isPlatformAdmin: true,
        person: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'admin-sem-espaco@example.com',
            name: 'Ana Souza',
        },
    },
    'admin-de-espaco': {
        profile: 'ADMIN',
        workspace: MAIN_WORKSPACE,
        isPlatformAdmin: false,
        person: {
            id: '00000000-0000-4000-8000-000000000005',
            email: 'admin-de-espaco@example.com',
            name: 'Daniel Alves',
        },
    },
    'sem-perfil': {
        profile: null,
        workspace: null,
        isPlatformAdmin: false,
        person: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'ativo@example.com',
            name: 'Ana Souza',
        },
    },
} as const satisfies Record<
    string,
    {
        profile: 'ADMIN' | 'BILLER' | 'VIEWER' | null;
        workspace: Workspace;
        isPlatformAdmin: boolean;
        person: Person;
    }
>;

/** Escolhe o usuário do fake antes do carregamento; `extra` grava outras chaves do e2e. */
export async function chooseUser(
    page: Page,
    user: E2EUser,
    extra: Record<string, string> = {},
): Promise<void> {
    await page.addInitScript(
        ({ user, extra }) => {
            localStorage.setItem('ftech.e2e.usuario', user);
            for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
        },
        { user, extra },
    );
}

/** Outra pessoa, para conferir que nada do usuário anterior sobra depois de sair (AC-0006-06). */
export const OTHER_PERSON = {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'bruno@example.com',
    name: 'Bruno Lima',
} as const;

/** Corpo `200` de `GET /users/me` (schema `UserResponse` do contrato). */
export function userResponse(
    profile: 'ADMIN' | 'BILLER' | 'VIEWER' | null,
    person: Person = BACKEND_USERS.ativo.person,
    space: { workspace: Workspace; isPlatformAdmin: boolean } = {
        workspace: profile ? MAIN_WORKSPACE : null,
        isPlatformAdmin: false,
    },
) {
    return {
        data: {
            ...person,
            emailVerified: true,
            profile,
            profileGrantedAt: profile ? '2026-10-01T12:00:00Z' : null,
            workspace: space.workspace,
            isPlatformAdmin: space.isPlatformAdmin,
            avatarUpdatedAt: null,
            createdAt: '2026-10-01T12:00:00Z',
        },
    };
}

export const emailNotVerified = {
    error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' },
};

/** Simula `GET /api/users/me` coerente com o usuário escolhido. */
export async function stubUsersMe(
    page: Page,
    user: E2EUser,
    /** Dá o espaço atual do usuário (ex.: depois de renomeado); o padrão é o fixo. */
    currentWorkspace: (fixed: Workspace) => Workspace = (fixed) => fixed,
): Promise<void> {
    await page.route('**/api/users/me', (route: Route) => {
        if (user === 'email-nao-verificado') {
            return route.fulfill({ status: 403, json: emailNotVerified });
        }
        if (user === 'nenhum') {
            return route.fulfill({
                status: 401,
                json: { error: { code: 'UNAUTHENTICATED', message: 'no token' } },
            });
        }
        const { profile, person, workspace, isPlatformAdmin } = BACKEND_USERS[user];
        return route.fulfill({
            status: 200,
            json: userResponse(profile, person, {
                workspace: currentWorkspace(workspace),
                isPlatformAdmin,
            }),
        });
    });
}

/** Entra pelo formulário de email e senha de `/entrar`. */
export async function signInWithEmail(page: Page): Promise<void> {
    await page.getByLabel('Email').fill('qualquer@example.com');
    await page.getByLabel('Senha').fill('qualquer-senha');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}
