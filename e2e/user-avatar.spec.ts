import { expect, test, type Page, type Route } from '@playwright/test';

import type { components } from '../src/api/generated/schema';

import { chooseUser, signInWithEmail, userResponse } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

// Spec 0006, "Foto do usuário": AC-0006-15 a AC-0006-19, INV-0006-07, ERR-0006-08 a ERR-0006-10.

type UserResponse = components['schemas']['UserResponse'];

const FIRST_VERSION = '2026-10-14T12:00:00.000Z';
const NEW_VERSION = '2026-10-14T13:00:00.000Z';

interface AvatarRequest {
    method: string;
    query: Record<string, string>;
    authorization: string | undefined;
    contentType: string | undefined;
    body: Buffer | null;
}

interface AvatarBackend {
    /** Requisições a `/users/me/avatar`, na ordem. */
    requests: AvatarRequest[];
    /** Próxima resposta de erro do `PUT`, ex.: `413 AVATAR_TOO_LARGE`. */
    failNextPut?: { status: number; code: string };
    /** Resposta fixa de erro do `GET` da foto, ex.: `500`. */
    failGet?: { status: number; code: string };
}

/**
 * Um backend em memória para a foto: `GET /users/me` devolve `avatarUpdatedAt`; o `PUT` grava os
 * bytes e uma versão nova; o `DELETE` apaga; o `GET` da foto devolve os bytes ou `404`.
 */
async function stubAvatarBackend(
    page: Page,
    initial: { photo: Buffer; type: string } | null,
): Promise<AvatarBackend> {
    let photo = initial;
    let avatarUpdatedAt: string | null = initial ? FIRST_VERSION : null;
    const backend: AvatarBackend = { requests: [] };
    const me = (): UserResponse => ({ ...userResponse('ADMIN').data, avatarUpdatedAt });

    await page.route('**/api/users/me', (route) =>
        route.fulfill({ status: 200, json: { data: me() } }),
    );
    await page.route('**/api/users/me/avatar**', async (route: Route) => {
        const request = route.request();
        const headers = await request.allHeaders();
        backend.requests.push({
            method: request.method(),
            query: Object.fromEntries(new URL(request.url()).searchParams),
            authorization: headers.authorization,
            contentType: headers['content-type'],
            body: request.postDataBuffer(),
        });
        const error = (status: number, code: string) =>
            route.fulfill({ status, json: { error: { code, message: code } } });

        switch (request.method()) {
            case 'GET':
                if (backend.failGet) return error(backend.failGet.status, backend.failGet.code);
                if (!photo) return error(404, 'AVATAR_NOT_FOUND');
                return route.fulfill({ status: 200, contentType: photo.type, body: photo.photo });
            case 'PUT': {
                if (backend.failNextPut) {
                    const { status, code } = backend.failNextPut;
                    backend.failNextPut = undefined;
                    return error(status, code);
                }
                photo = { photo: request.postDataBuffer()!, type: headers['content-type']! };
                avatarUpdatedAt = NEW_VERSION;
                return route.fulfill({ status: 200, json: { data: me() } });
            }
            case 'DELETE':
                photo = null;
                avatarUpdatedAt = null;
                return route.fulfill({ status: 204 });
            default:
                return route.fallback();
        }
    });
    return backend;
}

/**
 * Uma imagem gerada no navegador do teste, em três faixas verticais: vermelho, verde e azul, de
 * um terço da largura cada uma.
 */
async function stripedImage(
    page: Page,
    width: number,
    height: number,
    type = 'image/png',
): Promise<Buffer> {
    const base64 = await page.evaluate(
        async ({ width, height, type }) => {
            const canvas = new OffscreenCanvas(width, height);
            const context = canvas.getContext('2d')!;
            ['#ff0000', '#00ff00', '#0000ff'].forEach((color, index) => {
                context.fillStyle = color;
                context.fillRect((index * width) / 3, 0, width / 3, height);
            });
            const bytes = new Uint8Array(
                await (await canvas.convertToBlob({ type })).arrayBuffer(),
            );
            let binary = '';
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return btoa(binary);
        },
        { width, height, type },
    );
    return Buffer.from(base64, 'base64');
}

type Channel = 'vermelho' | 'verde' | 'azul';

interface DecodedPhoto {
    width: number;
    height: number;
    /** Cor dominante nas colunas 10, 128 e 246 da linha do meio. */
    left: Channel;
    center: Channel;
    right: Channel;
    /** Alfa dos quatro cantos: 255 é imagem, sem área vazia. */
    cornerAlpha: number[];
}

/** Decodifica, no navegador do teste, a foto enviada no `PUT`. */
async function decode(page: Page, body: Buffer, type: string): Promise<DecodedPhoto> {
    return page.evaluate(
        async ({ base64, type }) => {
            const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
            const bitmap = await createImageBitmap(new Blob([bytes], { type }));
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext('2d')!;
            context.drawImage(bitmap, 0, 0);
            const pixel = (x: number, y: number) =>
                Array.from(context.getImageData(x, y, 1, 1).data);
            const channel = (x: number): Channel => {
                const [r = 0, g = 0, b = 0] = pixel(x, 128);
                if (r > g && r > b) return 'vermelho';
                return g > b ? 'verde' : 'azul';
            };
            const last = bitmap.width - 1;
            return {
                width: bitmap.width,
                height: bitmap.height,
                left: channel(10),
                center: channel(128),
                right: channel(246),
                cornerAlpha: [pixel(0, 0), pixel(last, 0), pixel(0, last), pixel(last, last)].map(
                    (rgba) => rgba[3] ?? 0,
                ),
            };
        },
        { base64: body.toString('base64'), type },
    );
}

async function signIn(
    page: Page,
    initial: { photo: Buffer; type: string } | null = null,
    failGet?: AvatarBackend['failGet'],
) {
    await stubRuntime(page);
    await chooseUser(page, 'ativo');
    const backend = await stubAvatarBackend(page, initial);
    backend.failGet = failGet;
    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    return backend;
}

const menuButton = (page: Page) => page.getByRole('button', { name: 'Menu do usuário' });
const menuPhoto = (page: Page) => menuButton(page).locator('img');
const panel = (page: Page) => page.getByRole('region', { name: 'Conta do usuário' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Foto do perfil' });
const puts = (backend: AvatarBackend) => backend.requests.filter((r) => r.method === 'PUT');
const gets = (backend: AvatarBackend) => backend.requests.filter((r) => r.method === 'GET');

/** Abre "Foto do perfil" pelo menu e escolhe o arquivo. */
async function chooseFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
    await menuButton(page).click();
    await panel(page)
        .getByRole('button', { name: /^(Adicionar|Alterar) foto$/ })
        .click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByLabel('Arquivo da foto').setInputFiles(file);
}

async function choosePng(page: Page) {
    const buffer = await stripedImage(page, 1200, 800);
    await chooseFile(page, { name: 'foto.png', mimeType: 'image/png', buffer });
    await expect(dialog(page).getByRole('slider', { name: 'Zoom' })).toBeVisible();
}

/** Salva e devolve a foto enviada, já decodificada. */
async function saveAndDecode(page: Page, backend: AvatarBackend): Promise<DecodedPhoto> {
    await dialog(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog(page)).toBeHidden();
    const put = puts(backend).at(-1)!;
    return decode(page, put.body!, put.contentType!);
}

// AC-0006-15: a foto vem de `GET /users/me/avatar?v=<avatarUpdatedAt>`, com o token.
test('shows the photo read with the token and the version in the URL', async ({ page }) => {
    const photo = await stripedImage(page, 256, 256);
    const backend = await signIn(page, { photo, type: 'image/png' });

    await expect(menuPhoto(page)).toBeVisible();
    await expect(menuPhoto(page)).toHaveAttribute('src', /^blob:/);
    await expect(menuButton(page)).not.toContainText('AS');
    expect(gets(backend)).toHaveLength(1);
    expect(gets(backend)[0]).toMatchObject({
        query: { v: FIRST_VERSION },
        authorization: expect.stringMatching(/^Bearer fake-token-/),
    });

    // O painel repete a foto, em 48px, sem pedi-la de novo.
    await menuButton(page).click();
    await expect(panel(page).locator('img')).toBeVisible();
    const box = await panel(page).locator('img').locator('..').boundingBox();
    expect(Math.round(box!.width)).toBe(48);
    const small = await menuPhoto(page).locator('..').boundingBox();
    expect(Math.round(small!.width)).toBe(32);
    expect(gets(backend)).toHaveLength(1);
});

// AC-0006-15: sem foto, as iniciais, e a foto não é pedida.
test('shows the initials and asks for no photo when avatarUpdatedAt is null', async ({ page }) => {
    const backend = await signIn(page);

    await expect(menuButton(page)).toContainText('AS');
    await expect(menuPhoto(page)).toHaveCount(0);
    expect(gets(backend)).toHaveLength(0);
});

// AC-0006-15, ERR-0006-10: a leitura da foto falha, as iniciais ficam, sem alerta.
for (const [status, code] of [
    [404, 'AVATAR_NOT_FOUND'],
    [500, 'INTERNAL_ERROR'],
] as const) {
    test(`shows the initials, without an alert, when the photo answers ${status}`, async ({
        page,
    }) => {
        const photo = await stripedImage(page, 256, 256);
        const backend = await signIn(page, { photo, type: 'image/png' }, { status, code });

        await expect.poll(() => gets(backend).length).toBe(1);
        await expect(menuButton(page)).toContainText('AS');
        await expect(menuPhoto(page)).toHaveCount(0);
        await expect(page.getByRole('alert').filter({ hasText: /foto/i })).toHaveCount(0);
    });
}

// AC-0006-16, INV-0006-07: a foto enviada é a do `canvas`, 256 × 256, WebP (ou JPEG), sem EXIF.
test('"Adicionar foto" sends the 256 × 256 canvas photo and shows it', async ({ page }) => {
    const backend = await signIn(page);
    await choosePng(page);

    const sent = await saveAndDecode(page, backend);
    const put = puts(backend)[0]!;
    expect(put.contentType).toMatch(/^image\/(webp|jpeg)$/);
    expect(put.authorization).toMatch(/^Bearer fake-token-/);
    expect(put.body!.includes('Exif')).toBe(false);
    expect(put.body!.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
        false,
    );
    expect(sent).toMatchObject({ width: 256, height: 256 });
    // Recorte inicial: o quadrado central de 800 × 800 das três faixas.
    expect(sent).toMatchObject({ left: 'vermelho', center: 'verde', right: 'azul' });

    await expect(page.getByText('Foto atualizada.')).toBeVisible();
    await expect(menuPhoto(page)).toBeVisible();
    await expect(menuButton(page)).not.toContainText('AS');
    expect(gets(backend).at(-1)?.query).toEqual({ v: NEW_VERSION });
});

// AC-0006-19: o Zoom (pelo teclado) e o arrasto mudam a área enviada.
test('the keyboard zoom changes the sent area', async ({ page }) => {
    const backend = await signIn(page);
    await choosePng(page);

    const zoom = dialog(page).getByRole('slider', { name: 'Zoom' });
    await expect(zoom).toHaveValue('1');
    await zoom.focus();
    for (let step = 0; step < 10; step += 1) await page.keyboard.press('ArrowRight');
    await expect(zoom).toHaveValue('2');
    await page.keyboard.press('ArrowLeft');
    await expect(zoom).toHaveValue('1.9');
    await page.keyboard.press('ArrowRight');

    // Zoom 2×: o quadrado de 400 × 400 do meio, todo na faixa verde.
    const sent = await saveAndDecode(page, backend);
    expect(sent).toMatchObject({ left: 'verde', center: 'verde', right: 'verde' });
});

test('dragging changes the sent area, and the minimum zoom leaves no empty area', async ({
    page,
}) => {
    const backend = await signIn(page);
    await choosePng(page);

    const area = dialog(page).getByRole('img', { name: /Recorte da foto/ });
    const box = (await area.boundingBox())!;
    const y = box.y + box.height / 2;
    // Arrasta a imagem para a esquerda além da borda: o recorte para no lado direito da imagem.
    await page.mouse.move(box.x + box.width - 4, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 4, y, { steps: 8 });
    await page.mouse.up();

    const sent = await saveAndDecode(page, backend);
    expect(sent).toMatchObject({ left: 'verde', right: 'azul' });
    expect(sent.cornerAlpha).toEqual([255, 255, 255, 255]);
});

// AC-0006-17, ERR-0006-08: arquivo que o navegador não decodifica.
test('a file the browser cannot decode shows the message and sends nothing', async ({ page }) => {
    const backend = await signIn(page);
    await chooseFile(page, {
        name: 'foto.heic',
        mimeType: 'image/heic',
        buffer: Buffer.from('isto não é uma imagem'),
    });

    await expect(dialog(page).getByRole('alert')).toHaveText(
        'Não foi possível abrir esta imagem. Use uma foto em JPEG, PNG ou WebP.',
    );
    await expect(dialog(page).getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(puts(backend)).toHaveLength(0);
});

// AC-0006-17, ERR-0006-09: `413 AVATAR_TOO_LARGE` fica no alerta, e o diálogo continua aberto.
test('413 AVATAR_TOO_LARGE keeps the dialog open with the catalog message', async ({ page }) => {
    const backend = await signIn(page);
    backend.failNextPut = { status: 413, code: 'AVATAR_TOO_LARGE' };
    await choosePng(page);

    await dialog(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog(page).getByRole('alert')).toHaveText(
        'A foto é grande demais. Escolha outra imagem e tente de novo.',
    );
    await expect(dialog(page)).toBeVisible();
    expect(puts(backend)).toHaveLength(1);

    await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(menuButton(page)).toContainText('AS');
});

// AC-0006-18: remover confirma, envia `DELETE` e as iniciais voltam.
test('"Remover foto" confirms, sends DELETE and brings the initials back', async ({ page }) => {
    const photo = await stripedImage(page, 256, 256);
    const backend = await signIn(page, { photo, type: 'image/png' });
    await expect(menuPhoto(page)).toBeVisible();

    await menuButton(page).click();
    await panel(page).getByRole('button', { name: 'Remover foto' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Remover sua foto?' });
    await expect(confirm).toContainText('As iniciais voltam a aparecer.');
    await confirm.getByRole('button', { name: 'Remover' }).click();

    await expect(confirm).toBeHidden();
    await expect(page.getByText('Foto removida.')).toBeVisible();
    expect(backend.requests.filter((r) => r.method === 'DELETE')).toHaveLength(1);
    await expect(menuButton(page)).toContainText('AS');
    await expect(menuPhoto(page)).toHaveCount(0);

    // Sem foto, "Remover foto" não aparece.
    await menuButton(page).click();
    await expect(panel(page).getByRole('button', { name: 'Adicionar foto' })).toBeVisible();
    await expect(panel(page).getByRole('button', { name: 'Remover foto' })).toHaveCount(0);
});
