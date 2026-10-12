import type { Page } from '@playwright/test';

/** Configuração de runtime servida em `/config.js` nos testes (spec 0003). */
export const E2E_RUNTIME_CONFIG = {
    environment: 'local',
    firebase: {
        apiKey: 'e2e-api-key',
        authDomain: 'dev-financial-control.firebaseapp.com',
        projectId: 'dev-financial-control',
        appId: '1:805955182517:web:652d21a187283fa505c3fc',
    },
} as const;

/** Intercepta `/config.js` e toda a `/api/**`: o e2e não depende do backend real. */
export async function stubRuntime(page: Page, config: object = E2E_RUNTIME_CONFIG): Promise<void> {
    await page.route('**/config.js', (route) =>
        route.fulfill({
            contentType: 'text/javascript',
            body: `window.__FTECH_CONFIG__ = ${JSON.stringify(config)};`,
        }),
    );
    await page.route('**/api/**', (route) =>
        route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'not stubbed' } }),
    );
}
