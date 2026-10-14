import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
    clampCrop,
    cropRect,
    cropSize,
    initialCrop,
    MAX_ZOOM,
    MIN_ZOOM,
    panCrop,
    zoomCrop,
    type CropRect,
    type ImageSize,
} from './crop';

const LANDSCAPE: ImageSize = { width: 1200, height: 800 };
const PORTRAIT: ImageSize = { width: 600, height: 900 };

/** O quadrado está inteiro dentro da imagem: o recorte nunca deixa área vazia. */
function inside(image: ImageSize, rect: CropRect): boolean {
    const eps = 1e-9;
    return (
        rect.x >= -eps &&
        rect.y >= -eps &&
        rect.x + rect.size <= image.width + eps &&
        rect.y + rect.size <= image.height + eps
    );
}

describe('crop geometry (spec 0006, AC-0006-19)', () => {
    it('starts centered at the minimum zoom, covering the whole square with the shorter side', () => {
        const state = initialCrop(LANDSCAPE);
        expect(state.zoom).toBe(MIN_ZOOM);
        expect(cropRect(LANDSCAPE, state)).toEqual({ x: 200, y: 0, size: 800 });
        expect(cropRect(PORTRAIT, initialCrop(PORTRAIT))).toEqual({ x: 0, y: 150, size: 600 });
    });

    it('divides the shorter side by the zoom, kept between 1× and 3×', () => {
        expect(cropSize(LANDSCAPE, 2)).toBe(400);
        expect(cropSize(LANDSCAPE, 3)).toBeCloseTo(800 / 3);
        expect(cropSize(LANDSCAPE, 10)).toBeCloseTo(800 / MAX_ZOOM);
        expect(cropSize(LANDSCAPE, 0.2)).toBe(800);
    });

    it('zooms around the center and changes the sent area', () => {
        const zoomed = zoomCrop(LANDSCAPE, initialCrop(LANDSCAPE), 2);
        expect(zoomed.zoom).toBe(2);
        expect(cropRect(LANDSCAPE, zoomed)).toEqual({ x: 400, y: 200, size: 400 });
        expect(zoomCrop(LANDSCAPE, zoomed, 9).zoom).toBe(MAX_ZOOM);
        expect(zoomCrop(LANDSCAPE, zoomed, 0).zoom).toBe(MIN_ZOOM);
    });

    it('moves the area against the drag, in image pixels per screen pixel', () => {
        // Quadro de 200px mostrando 800px da imagem: 4px da imagem por pixel da tela.
        const moved = panCrop(LANDSCAPE, initialCrop(LANDSCAPE), -25, 0, 200);
        expect(cropRect(LANDSCAPE, moved)).toEqual({ x: 300, y: 0, size: 800 });
    });

    it('stops dragging at the image edges', () => {
        const left = panCrop(LANDSCAPE, initialCrop(LANDSCAPE), 10_000, 10_000, 200);
        expect(cropRect(LANDSCAPE, left)).toEqual({ x: 0, y: 0, size: 800 });
        const right = panCrop(LANDSCAPE, initialCrop(LANDSCAPE), -10_000, -10_000, 200);
        expect(cropRect(LANDSCAPE, right)).toEqual({ x: 400, y: 0, size: 800 });
    });

    it('zooming out near an edge pulls the center back inside', () => {
        const atCorner = clampCrop(LANDSCAPE, { centerX: 0, centerY: 0, zoom: 3 });
        const back = zoomCrop(LANDSCAPE, atCorner, 1);
        expect(cropRect(LANDSCAPE, back)).toEqual({ x: 0, y: 0, size: 800 });
    });

    it('never leaves an empty area, whatever the drag and zoom', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5000 }),
                fc.integer({ min: 1, max: 5000 }),
                fc.array(
                    fc.oneof(
                        fc.record({
                            dx: fc.double({ min: -5000, max: 5000, noNaN: true }),
                            dy: fc.double({ min: -5000, max: 5000, noNaN: true }),
                        }),
                        fc.double({ min: 0, max: 5, noNaN: true }),
                    ),
                    { maxLength: 20 },
                ),
                (width, height, steps) => {
                    const image = { width, height };
                    let state = initialCrop(image);
                    for (const step of steps) {
                        state =
                            typeof step === 'number'
                                ? zoomCrop(image, state, step)
                                : panCrop(image, state, step.dx, step.dy, 256);
                        expect(inside(image, cropRect(image, state))).toBe(true);
                        expect(state.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
                        expect(state.zoom).toBeLessThanOrEqual(MAX_ZOOM);
                    }
                },
            ),
        );
    });
});
