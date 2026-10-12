import type { Page, Route } from '@playwright/test';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Uma rota simulada da API; `path` é o caminho do contrato, sem `/api` e sem query. */
export interface StubRoute {
    method: HttpMethod;
    path: string;
    status?: number;
    body?: unknown;
}

/** Requisição recebida pelo stub, para o teste conferir corpo e query. */
export interface RecordedRequest {
    method: string;
    path: string;
    query: Record<string, string>;
    body: unknown;
}

export interface ApiStub {
    /** Todas as requisições recebidas sob `/api`, na ordem, inclusive as não declaradas. */
    readonly requests: RecordedRequest[];
}

const ROUTE_NOT_FOUND = {
    error: { code: 'ROUTE_NOT_FOUND', message: 'Route not stubbed in the e2e test' },
};

function parseBody(raw: string | null): unknown {
    if (raw === null || raw === '') return null;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return raw;
    }
}

/**
 * Simula a API (spec 0009, "E2E — usuários e stubs da API"): responde cada `{ method, path }`
 * declarado e `404 ROUTE_NOT_FOUND` a qualquer outra chamada sob `/api`. Para combinar com
 * `stubUsersMe`, chame-o **depois** de `stubApi`: no Playwright a rota registrada por último
 * tem precedência.
 */
export async function stubApi(page: Page, routes: readonly StubRoute[]): Promise<ApiStub> {
    const requests: RecordedRequest[] = [];

    await page.route('**/api/**', (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api(?=\/)/, '');
        requests.push({
            method: request.method(),
            path,
            query: Object.fromEntries(url.searchParams),
            body: parseBody(request.postData()),
        });

        const stub = routes.find((r) => r.method === request.method() && r.path === path);
        if (!stub) return route.fulfill({ status: 404, json: ROUTE_NOT_FOUND });
        if (stub.body === undefined) return route.fulfill({ status: stub.status ?? 204 });
        return route.fulfill({ status: stub.status ?? 200, json: stub.body });
    });

    return { requests };
}
