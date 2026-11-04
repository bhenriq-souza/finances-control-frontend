import type { Page } from '@playwright/test';

import { stubApi } from './api';
import { stubUsersMe, type E2EUser } from './auth';
import {
    MAIN_WORKSPACE,
    SECOND_WORKSPACE,
    USERS,
    usersList,
    type UserResponse,
    type WorkspaceResponse,
} from './data/users';

export interface UsersBackend {
    /** Requisições a `/users`, `/users/{id}/profile` e `/workspaces` (sem `/users/me`). */
    requests: { method: string; path: string; body: unknown }[];
    /** Próxima resposta de erro de uma escrita, ex.: `409 LAST_WORKSPACE_ADMIN`. */
    failNextWrite?: { status: number; code: string };
}

/**
 * Um backend em memória para usuários e espaços (specs 0010 e 0021): `GET /users` e `GET
 * /workspaces` devolvem o estado atual, e as escritas o alteram — a tela só muda pela resposta do
 * backend (INV-0021-04).
 */
export async function stubUsersBackend(page: Page, user: E2EUser): Promise<UsersBackend> {
    let users: UserResponse[] = [...USERS];
    let workspaces: WorkspaceResponse[] = [{ ...MAIN_WORKSPACE }, { ...SECOND_WORKSPACE }];
    const backend: UsersBackend = { requests: [] };

    const count = (id: string) => users.filter((u) => u.workspace?.id === id).length;
    const withCounts = () => workspaces.map((w) => ({ ...w, memberCount: count(w.id) }));

    await stubApi(page, []);
    await page.route(/\/api\/(users|workspaces)(\/.*)?$/, async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^\/api/, '');
        if (path === '/users/me') return route.fallback();
        const body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : null;
        backend.requests.push({ method: request.method(), path, body });

        if (request.method() === 'GET' && path === '/users') {
            return route.fulfill({ status: 200, json: usersList(users) });
        }
        if (request.method() === 'GET' && path === '/workspaces') {
            return route.fulfill({ status: 200, json: { data: withCounts() } });
        }
        const isWrite = request.method() === 'PATCH' || request.method() === 'DELETE';
        if (isWrite && backend.failNextWrite) {
            const { status, code } = backend.failNextWrite;
            backend.failNextWrite = undefined;
            return route.fulfill({ status, json: { error: { code, message: code } } });
        }

        const workspaceMatch = /^\/workspaces\/([^/]+)$/.exec(path);
        if (workspaceMatch && request.method() === 'PATCH') {
            const id = workspaceMatch[1]!;
            const { name } = body as { name: string };
            workspaces = workspaces.map((w) => (w.id === id ? { ...w, name } : w));
            users = users.map((u) =>
                u.workspace?.id === id ? { ...u, workspace: { id, name } } : u,
            );
            return route.fulfill({
                status: 200,
                json: { data: withCounts().find((w) => w.id === id) },
            });
        }

        const profileMatch = /^\/users\/([^/]+)\/profile$/.exec(path);
        if (!profileMatch) return route.fallback();
        const id = profileMatch[1];
        if (request.method() === 'DELETE') {
            users = users.map((u) =>
                u.id === id ? { ...u, profile: null, profileGrantedAt: null, workspace: null } : u,
            );
            return route.fulfill({ status: 200, json: { data: users.find((u) => u.id === id) } });
        }
        const grant = body as {
            profile: UserResponse['profile'];
            workspaceId?: string;
            newWorkspace?: { name: string };
        };
        let target = users.find((u) => u.id === id)?.workspace ?? null;
        if (grant.newWorkspace) {
            const created: WorkspaceResponse = {
                id: `00000000-0000-4000-8000-0000000000b${workspaces.length}`,
                name: grant.newWorkspace.name,
                memberCount: 0,
                createdAt: '2026-10-12T12:00:00Z',
            };
            workspaces = [...workspaces, created];
            target = { id: created.id, name: created.name };
        } else if (grant.workspaceId) {
            const found = workspaces.find((w) => w.id === grant.workspaceId);
            target = found ? { id: found.id, name: found.name } : target;
        }
        users = users.map((u) =>
            u.id === id
                ? {
                      ...u,
                      profile: grant.profile,
                      profileGrantedAt: '2026-10-12T12:00:00Z',
                      workspace: target,
                  }
                : u,
        );
        return route.fulfill({ status: 200, json: { data: users.find((u) => u.id === id) } });
    });
    // Por último: tem precedência sobre as rotas acima.
    await stubUsersMe(page, user, (fixed) => {
        const current = workspaces.find((w) => w.id === fixed?.id);
        return current ? { id: current.id, name: current.name } : fixed;
    });
    return backend;
}
