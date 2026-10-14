import { expect, test, type Locator, type Page } from '@playwright/test';

import { stubRuntime } from './fixtures/runtime-config';

// `DateField` próprio (spec 0009, ADR 0001 local) na página de prova `/_e2e/formulario`: o campo
// **Data** começa em 12/10/2026 e o calendário dele só deixa escolher outubro e novembro de 2026;
// **Vencimento** é opcional. A página mostra o que o último envio mandou.

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
});

async function openForm(page: Page) {
    await page.goto('/_e2e/formulario');
    await page.getByRole('button', { name: 'Nova despesa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nova despesa' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Descrição').fill('Mercado');
    await dialog.getByLabel('Pagar com').selectOption({ label: 'Cartão Visa' });
    return dialog;
}

async function retype(field: Locator, digits: string) {
    await field.clear();
    await field.pressSequentially(digits);
}

const sent = (page: Page) => page.getByRole('region', { name: 'Último envio' });

// AC-0009-12: máscara, colar `aaaa-mm-dd`, datas inválidas e o opcional vazio.
test('typing 05112026 shows 05/11/2026 and sends 2026-11-05', async ({ page }) => {
    const dialog = await openForm(page);
    const date = dialog.getByLabel('Data', { exact: true });
    await expect(date).toHaveValue('12/10/2026');
    await expect(date).toHaveAttribute('inputmode', 'numeric');
    await expect(date).toHaveAttribute('placeholder', 'dd/mm/aaaa');

    await retype(date, '05112026');
    await expect(date).toHaveValue('05/11/2026');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(sent(page)).toContainText('"2026-11-05"');
    await expect(sent(page)).toContainText('Vencimento""');
});

test('pasting 2026-11-05 gives the same as typing it', async ({ page }) => {
    const dialog = await openForm(page);
    const date = dialog.getByLabel('Data', { exact: true });

    await date.fill('2026-11-05');
    await expect(date).toHaveValue('05/11/2026');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(sent(page)).toContainText('"2026-11-05"');
});

for (const [digits, shown] of [
    ['31022026', '31/02/2026'],
    ['051120', '05/11/20'],
] as const) {
    test(`${shown} shows "Data inválida." on submit and sends nothing`, async ({ page }) => {
        const dialog = await openForm(page);
        const date = dialog.getByLabel('Data', { exact: true });

        await retype(date, digits);
        await expect(date).toHaveValue(shown);
        await dialog.getByRole('button', { name: 'Salvar' }).click();

        await expect(date).toHaveAttribute('aria-invalid', 'true');
        await expect(date).toHaveAccessibleDescription(
            'A data em que a despesa aconteceu. Data inválida.',
        );
        await expect(dialog).toBeVisible();
        await expect(sent(page)).toBeHidden();
    });
}

test('clearing an optional date sends an empty string', async ({ page }) => {
    const dialog = await openForm(page);
    const due = dialog.getByLabel('Vencimento');

    await retype(due, '20102026');
    await expect(due).toHaveValue('20/10/2026');
    await due.clear();
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(sent(page)).toContainText('Vencimento""');
});

// AC-0009-13: o calendário.
async function openCalendar(page: Page, dialog: Locator) {
    const button = dialog.getByRole('button', { name: 'Escolher data' }).first();
    await expect(button).toHaveCSS('height', '44px');
    await button.click();
    const calendar = page.getByRole('dialog', { name: 'Data', exact: true });
    await expect(calendar).toBeVisible();
    return { button, calendar };
}

test('Escolher data opens a pt-BR calendar on the month of the field: a bottom sheet on the phone, a balloon from tablet up', async ({
    page,
}, testInfo) => {
    const dialog = await openForm(page);
    // Medido antes de abrir: com a folha aberta, o resto da página fica fora da árvore acessível.
    const fieldBox = await dialog.getByLabel('Data', { exact: true }).boundingBox();
    const { calendar } = await openCalendar(page, dialog);

    await expect(calendar.getByRole('grid', { name: /outubro 2026/i })).toBeVisible();
    await expect(calendar.getByText('outubro 2026', { exact: true })).toBeVisible();
    await expect(calendar.getByText('seg', { exact: true })).toBeVisible();
    const selected = calendar.getByRole('button', { name: /, 12 de outubro de 2026.*selecionado/ });
    await expect(selected).toBeFocused();
    await expect(selected).toHaveCSS('height', '44px');

    const viewport = page.viewportSize();
    const box = await calendar.boundingBox();
    if (!viewport || !box || !fieldBox) throw new Error('no viewport, calendar or field box');
    if (testInfo.project.name === 'celular') {
        // Folha presa à base, na largura da tela.
        expect(box.x).toBe(0);
        expect(box.width).toBe(viewport.width);
        expect(Math.round(box.y + box.height)).toBe(viewport.height);
    } else {
        // Balão logo abaixo do campo, alinhado ao início dele.
        expect(box.width).toBeLessThan(viewport.width / 2);
        expect(Math.abs(box.x - fieldBox.x)).toBeLessThanOrEqual(1);
        expect(box.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
        expect(box.y).toBeLessThan(fieldBox.y + fieldBox.height + 16);
    }
});

test('picking a day fills the field, closes the calendar and focuses the field', async ({
    page,
}) => {
    const dialog = await openForm(page);
    const { calendar } = await openCalendar(page, dialog);

    await calendar.getByRole('button', { name: /, 20 de outubro de 2026/ }).click();

    await expect(calendar).toBeHidden();
    const date = dialog.getByLabel('Data', { exact: true });
    await expect(date).toHaveValue('20/10/2026');
    await expect(date).toBeFocused();
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(sent(page)).toContainText('"2026-10-20"');
});

test('the keyboard moves through the grid and Enter picks the day', async ({ page }) => {
    const dialog = await openForm(page);
    const { calendar } = await openCalendar(page, dialog);
    await expect(calendar.getByRole('button', { name: /selecionado/ })).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(calendar.getByRole('button', { name: /, 20 de outubro de 2026/ })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(calendar).toBeHidden();
    await expect(dialog.getByLabel('Data', { exact: true })).toHaveValue('20/10/2026');
});

test('Esc closes the calendar without changing the value and focuses the button', async ({
    page,
}) => {
    const dialog = await openForm(page);
    const { button, calendar } = await openCalendar(page, dialog);
    await expect(calendar.getByRole('button', { name: /selecionado/ })).toBeFocused();
    await page.keyboard.press('ArrowRight');

    await page.keyboard.press('Escape');

    await expect(calendar).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Data', { exact: true })).toHaveValue('12/10/2026');
    await expect(button).toBeFocused();
});

test('days outside min and max cannot be picked', async ({ page }) => {
    const dialog = await openForm(page);
    const { calendar } = await openCalendar(page, dialog);

    const beforeMin = calendar.getByRole('button', { name: /, 30 de setembro de 2026/ });
    await expect(beforeMin).toBeDisabled();
    await beforeMin.click({ force: true });
    await expect(calendar).toBeVisible();

    await calendar.getByRole('button', { name: 'Ir para o próximo mês' }).click();
    await expect(calendar.getByRole('grid', { name: /novembro 2026/i })).toBeVisible();
    await expect(calendar.getByRole('button', { name: /, 30 de novembro de 2026/ })).toBeEnabled();
    await expect(calendar.getByRole('button', { name: /, 1 de dezembro de 2026/ })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(calendar).toBeHidden();
    await expect(dialog.getByLabel('Data', { exact: true })).toHaveValue('12/10/2026');
});

test('the calendar uses only the theme tokens, in both themes', async ({ page }) => {
    for (const scheme of ['dark', 'light'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        const dialog = await openForm(page);
        const { calendar } = await openCalendar(page, dialog);
        const selected = calendar.getByRole('button', { name: /selecionado/ });

        const colors = await selected.evaluate((element) => {
            const probe = document.createElement('div');
            probe.style.color = 'var(--ft-acento)';
            probe.style.backgroundColor = 'var(--ft-superficie)';
            document.body.append(probe);
            const tokens = getComputedStyle(probe);
            const result = {
                selected: getComputedStyle(element).backgroundColor,
                acento: tokens.color,
                surface: getComputedStyle(element.closest('[role="dialog"]')!).backgroundColor,
                superficie: tokens.backgroundColor,
            };
            probe.remove();
            return result;
        });
        expect(colors.selected).toBe(colors.acento);
        expect(colors.surface).toBe(colors.superficie);
    }
});
