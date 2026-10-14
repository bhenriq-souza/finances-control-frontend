import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    put: vi.fn(),
    decodeImage: vi.fn(),
    drawCrop: vi.fn(),
    renderAvatar: vi.fn(),
}));
vi.mock('@/api/client', () => ({ api: { PUT: mocks.put } }));
vi.mock('./canvas', () => ({
    decodeImage: mocks.decodeImage,
    drawCrop: mocks.drawCrop,
    renderAvatar: mocks.renderAvatar,
}));

import { ERROR_MESSAGES } from '@/api/errors/catalog';
import { CURRENT_USER_QUERY_KEY } from '@/api/queries/current-user';

import { AvatarDialog } from './avatar-dialog';
import { MAX_SOURCE_BYTES } from './image-file';
import { currentUser, fail, ok, renderWithUser } from './test-utils';

const UPDATED = currentUser({ avatarUpdatedAt: '2026-10-14T12:00:00Z' });
const GENERATED = new Blob(['webp'], { type: 'image/webp' });

function bitmap(width = 1200, height = 800) {
    return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

function pngFile(size?: number) {
    const file = new File(['png'], 'foto.png', { type: 'image/png' });
    if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
    return file;
}

beforeAll(() => {
    // O jsdom não implementa a captura de ponteiro.
    HTMLElement.prototype.setPointerCapture = () => undefined;
});

beforeEach(() => {
    mocks.put.mockReset().mockResolvedValue(ok({ data: UPDATED }));
    mocks.decodeImage.mockReset().mockImplementation(() => Promise.resolve(bitmap()));
    mocks.drawCrop.mockReset();
    mocks.renderAvatar.mockReset().mockResolvedValue(GENERATED);
});

async function open() {
    const onClose = vi.fn();
    const result = await renderWithUser(<AvatarDialog onClose={onClose} />);
    return { onClose, ...result };
}

async function choose(file: File) {
    const input = screen.getByLabelText('Arquivo da foto');
    await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
    });
}

const save = () => screen.getByRole('button', { name: 'Salvar' });
const zoom = () => screen.getByRole('slider', { name: 'Zoom' });

describe('AvatarDialog (spec 0006)', () => {
    it('opens "Foto do perfil" with the file picker for JPEG, PNG and WebP', async () => {
        await open();
        expect(screen.getByRole('dialog', { name: 'Foto do perfil' })).toBeInTheDocument();
        expect(screen.getByLabelText('Arquivo da foto')).toHaveAttribute(
            'accept',
            'image/jpeg,image/png,image/webp',
        );
        expect(save()).toBeDisabled();
        expect(screen.queryByRole('slider')).not.toBeInTheDocument();

        const click = vi.spyOn(screen.getByLabelText('Arquivo da foto'), 'click');
        fireEvent.click(screen.getByRole('button', { name: 'Escolher imagem' }));
        expect(click).toHaveBeenCalled();
    });

    it('sends the canvas photo and replaces the current user (AC-0006-16, INV-0006-07)', async () => {
        const { onClose, queryClient } = await open();
        await choose(pngFile());

        expect(mocks.decodeImage).toHaveBeenCalledTimes(1);
        expect(mocks.drawCrop).toHaveBeenCalled();
        expect(zoom()).toHaveValue('1');

        await act(async () => {
            fireEvent.click(save());
        });

        const [, rect] = mocks.renderAvatar.mock.calls[0] as [unknown, unknown];
        expect(rect).toEqual({ x: 200, y: 0, size: 800 });
        const [path, init] = mocks.put.mock.calls[0] as [
            string,
            { bodySerializer: () => unknown; headers: Record<string, string> },
        ];
        expect(path).toBe('/users/me/avatar');
        expect(init.bodySerializer()).toBe(GENERATED);
        expect(init.headers['Content-Type']).toBe('image/webp');
        expect(queryClient.getQueryData(CURRENT_USER_QUERY_KEY)).toEqual(UPDATED);
        expect(onClose).toHaveBeenCalled();
        expect(screen.getByText('Foto atualizada.')).toBeInTheDocument();
    });

    it('sends the area chosen with the zoom and the drag (AC-0006-19)', async () => {
        await open();
        await choose(pngFile());

        fireEvent.change(zoom(), { target: { value: '2' } });
        const area = document.querySelector<HTMLElement>('[data-slot="recorte"]')!;
        area.getBoundingClientRect = () => ({ width: 200 }) as DOMRect;
        fireEvent.pointerDown(area, { pointerId: 1, clientX: 100, clientY: 100 });
        fireEvent.pointerMove(area, { pointerId: 1, clientX: 50, clientY: 100 });
        fireEvent.pointerMove(area, { pointerId: 2, clientX: 0, clientY: 0 });
        fireEvent.pointerUp(area, { pointerId: 1 });
        fireEvent.pointerMove(area, { pointerId: 1, clientX: 0, clientY: 0 });

        await act(async () => {
            fireEvent.click(save());
        });
        // Zoom 2×: 400px da imagem num quadro de 200px; arrastar 50px para a esquerda anda 100px.
        expect(mocks.renderAvatar.mock.calls[0]?.[1]).toEqual({ x: 500, y: 200, size: 400 });
    });

    it('refuses a file above 20 MB before decoding (ERR-0006-08)', async () => {
        await open();
        await choose(pngFile(MAX_SOURCE_BYTES + 1));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Esta imagem é grande demais. Escolha uma de até 20 MB.',
        );
        expect(mocks.decodeImage).not.toHaveBeenCalled();
        expect(save()).toBeDisabled();
    });

    it('shows the contract message for a file the browser cannot decode (AC-0006-17)', async () => {
        mocks.decodeImage.mockRejectedValue(new DOMException('bad', 'InvalidStateError'));
        await open();
        await choose(new File(['heic'], 'foto.heic', { type: 'image/heic' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Não foi possível abrir esta imagem. Use uma foto em JPEG, PNG ou WebP.',
        );
        expect(save()).toBeDisabled();
        expect(mocks.put).not.toHaveBeenCalled();
    });

    it.each([
        [413, 'AVATAR_TOO_LARGE'],
        [415, 'AVATAR_UNSUPPORTED_TYPE'],
    ] as const)(
        'keeps the dialog open with the catalog message on %i (ERR-0006-09)',
        async (status, code) => {
            mocks.put.mockResolvedValue(fail(status, code));
            const { onClose, queryClient } = await open();
            await choose(pngFile());
            await act(async () => {
                fireEvent.click(save());
            });

            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES[code]),
            );
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByRole('dialog', { name: 'Foto do perfil' })).toBeInTheDocument();
            expect(queryClient.getQueryData(CURRENT_USER_QUERY_KEY)).toEqual(currentUser());
        },
    );

    it('shows the generic message when the browser fails to generate the photo', async () => {
        mocks.renderAvatar.mockRejectedValue(new Error('canvas'));
        await open();
        await choose(pngFile());
        await act(async () => {
            fireEvent.click(save());
        });
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        expect(mocks.put).not.toHaveBeenCalled();
    });

    it('releases the previous image when another one is chosen, and ignores an empty pick', async () => {
        const first = bitmap();
        mocks.decodeImage.mockResolvedValueOnce(first);
        await open();
        await choose(pngFile());
        await choose(pngFile());
        expect(first.close).toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Arquivo da foto'), { target: { files: [] } });
        expect(mocks.decodeImage).toHaveBeenCalledTimes(2);
    });

    it('closes on Cancelar without sending', async () => {
        const { onClose } = await open();
        await choose(pngFile());
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onClose).toHaveBeenCalled();
        expect(mocks.put).not.toHaveBeenCalled();
    });
});
