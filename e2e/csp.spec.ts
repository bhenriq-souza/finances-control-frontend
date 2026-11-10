import { expect, test, type Page } from '@playwright/test';

import { chooseUser, signInWithEmail, stubUsersMe } from './fixtures/auth';
import { stubApi } from './fixtures/api';
import { stubDashboard } from './fixtures/data/reports';
import { stubRuntime } from './fixtures/runtime-config';

// CSP imposta pelo plugin do preview (spec 0022): nenhuma violação nas rotas principais.

type Collected = { violations: string[]; consoleErrors: string[] };

/** Registra `securitypolicyviolation` (antes de qualquer script da página) e erros de console. */
async function collect(page: Page): Promise<Collected> {
    const collected: Collected = { violations: [], consoleErrors: [] };
    await page.exposeFunction('__reportCspViolation', (text: string) => {
        collected.violations.push(text);
    });
    await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
            void (
                window as unknown as { __reportCspViolation: (t: string) => void }
            ).__reportCspViolation(
                `${event.violatedDirective} ${event.blockedURI} ${event.sample}`.trim(),
            );
        });
    });
    page.on('console', (message) => {
        if (message.type() === 'error' && /content security policy|csp/i.test(message.text())) {
            collected.consoleErrors.push(message.text());
        }
    });
    return collected;
}

function expectClean({ violations, consoleErrors }: Collected) {
    expect(violations).toEqual([]);
    expect(consoleErrors).toEqual([]);
}

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
});

// AC-0022-05, INV-0022-05: a página de entrada.
test('the sign-in route raises no CSP violation', async ({ page }) => {
    const collected = await collect(page);
    await page.goto('/entrar');
    await expect(page.getByRole('heading', { name: 'Entrar no FTech Finance' })).toBeVisible();
    expectClean(collected);
});

// AC-0022-05, INV-0022-05: dashboard e listas, com sessão ativa.
test('the dashboard and the lists raise no CSP violation', async ({ page }) => {
    const collected = await collect(page);
    await chooseUser(page, 'ativo');
    await stubDashboard(page, {});
    await stubApi(page, [
        { method: 'GET', path: '/bank-accounts', body: { data: [] } },
        { method: 'GET', path: '/credit-cards', body: { data: [] } },
        { method: 'GET', path: '/expense-types', body: { data: [] } },
        { method: 'GET', path: '/expenses', body: { data: [] } },
    ]);
    await stubUsersMe(page, 'ativo');
    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();

    for (const [path, heading] of [
        ['/despesas', 'Despesas'],
        ['/receitas', 'Receitas'],
        ['/cartoes', 'Cartões'],
    ] as const) {
        await page.getByRole('link', { name: heading, exact: true }).first().click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
    expectClean(collected);
});

// AC-0022-05, INV-0022-05: o diálogo modal do Radix injeta uma tag `style` (scroll-lock), que só
// passa com o nonce da requisição.
test('opening a modal dialog raises no CSP violation', async ({ page }) => {
    const collected = await collect(page);
    await page.goto('/_e2e/formulario');
    await page.getByRole('button', { name: 'Nova despesa' }).click();
    await expect(page.getByRole('dialog', { name: 'Nova despesa' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expectClean(collected);
});

// AC-0022-08: o nonce muda a cada requisição e o cabeçalho bate com a meta do index.html.
test('the nonce changes on every request and matches the csp-nonce meta', async ({ request }) => {
    const nonces: string[] = [];
    for (let i = 0; i < 2; i += 1) {
        const response = await request.get('/entrar');
        const header = response.headers()['content-security-policy'] ?? '';
        const fromHeader = /style-src-elem 'self' 'nonce-([^']+)'/.exec(header)?.[1];
        const fromMeta = /<meta name="csp-nonce" content="([^"]+)"/.exec(
            await response.text(),
        )?.[1];
        expect(fromHeader).toBeTruthy();
        expect(fromMeta).toBe(fromHeader);
        expect(header).not.toMatch(/unsafe-inline/);
        nonces.push(fromHeader!);
    }
    expect(nonces[0]).not.toEqual(nonces[1]);
});
