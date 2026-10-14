import { afterEach, describe, expect, it, vi } from 'vitest';

import { decodeImage, drawCrop, renderAvatar } from './canvas';

function fakeContext() {
    return {
        imageSmoothingQuality: 'low',
        clearRect: vi.fn(),
        drawImage: vi.fn(),
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('canvas helpers (INV-0006-07)', () => {
    it('decodes with the EXIF orientation applied', async () => {
        const bitmap = { width: 10, height: 10 };
        const create = vi.fn().mockResolvedValue(bitmap);
        vi.stubGlobal('createImageBitmap', create);
        const file = new Blob(['x'], { type: 'image/png' });

        await expect(decodeImage(file)).resolves.toBe(bitmap);
        expect(create).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    });

    it('draws the cropped square over the whole canvas', () => {
        const context = fakeContext();
        const canvas = { width: 512, height: 512, getContext: () => context };
        const image = {} as CanvasImageSource;

        drawCrop(canvas as unknown as HTMLCanvasElement, image, { x: 200, y: 0, size: 800 });

        expect(context.clearRect).toHaveBeenCalledWith(0, 0, 512, 512);
        expect(context.drawImage).toHaveBeenCalledWith(image, 200, 0, 800, 800, 0, 0, 512, 512);
        expect(context.imageSmoothingQuality).toBe('high');
    });

    it('does nothing without a 2D context', () => {
        const canvas = { width: 1, height: 1, getContext: () => null };
        expect(() =>
            drawCrop(canvas as unknown as HTMLCanvasElement, {} as CanvasImageSource, {
                x: 0,
                y: 0,
                size: 1,
            }),
        ).not.toThrow();
    });

    it('renders a 256 × 256 canvas exported as WebP 0.85', async () => {
        const context = fakeContext();
        const created: HTMLCanvasElement[] = [];
        const realCreate = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const element = realCreate(tag);
            if (tag === 'canvas') {
                const canvas = element as HTMLCanvasElement;
                canvas.getContext = (() => context) as unknown as HTMLCanvasElement['getContext'];
                canvas.toBlob = (callback, type) => callback(new Blob(['x'], { type }));
                vi.spyOn(canvas, 'toBlob');
                created.push(canvas);
            }
            return element;
        });

        const blob = await renderAvatar({} as CanvasImageSource, { x: 0, y: 0, size: 800 });

        expect(blob.type).toBe('image/webp');
        expect(created).toHaveLength(1);
        expect(created[0]).toMatchObject({ width: 256, height: 256 });
        expect(created[0]?.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.85);
        expect(context.drawImage).toHaveBeenCalledWith(
            expect.anything(),
            0,
            0,
            800,
            800,
            0,
            0,
            256,
            256,
        );
    });
});
