import { expect, test, type Page } from '@playwright/test';

import { stubRuntime } from './fixtures/runtime-config';

// Página de prova `/_e2e/formulario` (spec 0009): só existe no build `--mode e2e`, com dados
// estáticos.

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
});

async function openForm(page: Page) {
    await page.goto('/_e2e/formulario');
    const trigger = page.getByRole('button', { name: 'Nova despesa' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Nova despesa' });
    await expect(dialog).toBeVisible();
    return { trigger, dialog };
}

test('the proof page answers at the literal /_e2e/formulario URL without calling the API', async ({
    page,
}) => {
    const apiCalls: string[] = [];
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
    });

    await page.goto('/_e2e/formulario');

    await expect(
        page.getByRole('heading', { name: 'Prova — Formulários', level: 1 }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/_e2e/formulario');
    expect(apiCalls).toEqual([]);
});

// AC-0009-06: folha de tela cheia no celular, diálogo central de até 560px a partir de `md`.
test('FormDialog is a full-screen sheet on the phone and a centred dialog from tablet up', async ({
    page,
}, testInfo) => {
    const { dialog } = await openForm(page);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    if (!viewport || !box) throw new Error('no viewport or dialog box');

    const title = dialog.getByRole('heading', { name: 'Nova despesa' });
    const save = dialog.getByRole('button', { name: 'Salvar' });
    const titleBox = await title.boundingBox();
    const saveBox = await save.boundingBox();
    if (!titleBox || !saveBox) throw new Error('no title or action box');

    if (testInfo.project.name === 'celular') {
        expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
        // Título fixo no topo e ações fixas embaixo.
        expect(titleBox.y).toBeLessThan(40);
        expect(saveBox.y + saveBox.height).toBeGreaterThan(viewport.height - 40);
        return;
    }

    expect(box.width).toBeLessThanOrEqual(560);
    expect(box.height).toBeLessThan(viewport.height);
    // Centralizado, com o véu em volta.
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
    await expect(dialog).toHaveCSS('border-top-left-radius', '12px');
});

// Véu do diálogo (decisão de 2026-10-12): `fundo` do tema a 48% no claro e a 72% no escuro.
test('the dialog scrim is the theme background at 48% in light and 72% in dark', async ({
    page,
}) => {
    const scrimAlpha = async () => {
        const color = await page
            .locator('[data-slot="veu"]')
            .evaluate((element) => getComputedStyle(element).backgroundColor);
        return Number(/\/\s*([\d.]+)\)$/.exec(color)?.[1]);
    };

    await page.emulateMedia({ colorScheme: 'light' });
    await openForm(page);
    expect(await scrimAlpha()).toBeCloseTo(0.48, 2);

    await page.keyboard.press('Escape');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('button', { name: 'Nova despesa' }).click();
    expect(await scrimAlpha()).toBeCloseTo(0.72, 2);
});

// AC-0009-06: o foco fica preso no diálogo.
test('FormDialog traps the focus', async ({ page }) => {
    const { dialog } = await openForm(page);
    await expect(dialog.getByLabel('Descrição')).toBeFocused();

    const inside = async () =>
        dialog.evaluate((element) => element.contains(document.activeElement));
    for (let step = 0; step < 8; step++) {
        await page.keyboard.press('Tab');
        expect(await inside()).toBe(true);
    }
    for (let step = 0; step < 8; step++) {
        await page.keyboard.press('Shift+Tab');
        expect(await inside()).toBe(true);
    }
});

// AC-0009-06: `Esc` fecha e o foco volta ao botão que abriu.
test('FormDialog closes with Esc and gives the focus back to the button that opened it', async ({
    page,
}) => {
    const { trigger, dialog } = await openForm(page);
    await dialog.getByLabel('Descrição').fill('Mercado');

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
});

test('a valid submission closes the dialog and shows a short success notice', async ({ page }) => {
    const { trigger, dialog } = await openForm(page);
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    // Erro do campo ligado por `aria-describedby`; o diálogo continua aberto.
    await expect(dialog.getByLabel('Descrição')).toHaveAccessibleDescription('Informe o nome.');

    await dialog.getByLabel('Descrição').fill('Mercado');
    await dialog.getByLabel('Pagar com').selectOption({ label: 'Cartão Visa' });
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    const notices = page.getByRole('region', { name: 'Avisos' });
    await expect(notices).toHaveAttribute('aria-live', 'polite');
    await expect(notices.getByText('Despesa salva.')).toBeVisible();
    await notices.getByRole('button', { name: 'Fechar aviso' }).click();
    await expect(notices.getByText('Despesa salva.')).toBeHidden();
});

// AC-0009-06: `ConfirmDialog` começa com o foco em **Cancelar**.
test('ConfirmDialog starts on Cancelar, uses the negativo button and returns the focus', async ({
    page,
}) => {
    await page.goto('/_e2e/formulario');
    const trigger = page.getByRole('button', { name: 'Excluir despesa' });
    await trigger.click();

    const dialog = page.getByRole('alertdialog', { name: 'Excluir a despesa?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Excluir' })).toHaveClass(/bg-negativo/);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole('button', { name: 'Excluir' }).click();
    await expect(dialog).toBeHidden();
    await expect(
        page.getByRole('region', { name: 'Avisos' }).getByText('Despesa excluída.'),
    ).toBeVisible();
});
