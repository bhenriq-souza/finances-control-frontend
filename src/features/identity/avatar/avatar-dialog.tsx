import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { CURRENT_USER_QUERY_KEY } from '@/api/queries/current-user';
import { Button } from '@/ui/components/ui/button';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { useNotify } from '@/ui/notice';

import { uploadAvatar } from './avatar-api';
import { decodeImage, drawCrop, renderAvatar } from './canvas';
import {
    cropRect,
    initialCrop,
    MAX_ZOOM,
    MIN_ZOOM,
    panCrop,
    zoomCrop,
    type CropState,
} from './crop';
import { AVATAR_ACCEPT, AVATAR_FILE_MESSAGES, rejectSourceFile } from './image-file';

const FORM_ID = 'foto-do-perfil';

/** Resolução interna da prévia; o quadro na tela tem até 256px. */
const PREVIEW_SIZE = 512;

const ZOOM_STEP = 0.1;

function messageOf(error: unknown): string {
    return error instanceof ApiError
        ? error.userMessage
        : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE;
}

/**
 * O recorte: a prévia num `canvas`, com máscara circular, que se arrasta com o ponteiro (mouse ou
 * toque). O estado vem de fora; a geometria fica em `crop.ts`.
 */
function CropArea({
    image,
    crop,
    onCropChange,
}: {
    image: ImageBitmap;
    crop: CropState;
    onCropChange: (crop: CropState) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);

    useEffect(() => {
        if (canvasRef.current) drawCrop(canvasRef.current, image, cropRect(image, crop));
    }, [image, crop]);

    function onPointerDown(event: PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    }

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const last = drag.current;
        if (last?.pointerId !== event.pointerId) return;
        const viewport = event.currentTarget.getBoundingClientRect().width || PREVIEW_SIZE;
        onCropChange(
            panCrop(image, crop, event.clientX - last.x, event.clientY - last.y, viewport),
        );
        drag.current = { ...last, x: event.clientX, y: event.clientY };
    }

    function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
    }

    return (
        <div
            data-slot="recorte"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            className="relative mx-auto aspect-square w-full max-w-64 cursor-grab touch-none overflow-hidden rounded-md border border-linha bg-superficie-elevada select-none active:cursor-grabbing"
        >
            <canvas
                ref={canvasRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                role="img"
                aria-label="Recorte da foto. Arraste para posicionar."
                className="block size-full"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_100vmax_var(--ft-veu)] ring-2 ring-superficie"
            />
        </div>
    );
}

export interface AvatarDialogProps {
    /** Fecha o diálogo: **Cancelar**, `Esc` ou depois do envio. */
    onClose: () => void;
}

/**
 * Diálogo "Foto do perfil" (spec 0006): escolher a imagem, recortá-la (arrastar e **Zoom** de 1×
 * a 3×) e enviar a foto gerada pelo `canvas` (INV-0006-07). A resposta substitui o usuário atual
 * no cache de `GET /users/me`; um erro fica no alerta do diálogo, que continua aberto.
 */
export function AvatarDialog({ onClose }: AvatarDialogProps) {
    const queryClient = useQueryClient();
    const notify = useNotify();
    const inputRef = useRef<HTMLInputElement>(null);
    const zoomId = useId();
    const [image, setImage] = useState<ImageBitmap | null>(null);
    const [crop, setCrop] = useState<CropState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [decoding, setDecoding] = useState(false);

    // O `ImageBitmap` anterior é liberado quando outro é escolhido ou o diálogo fecha.
    useEffect(() => () => image?.close(), [image]);

    const save = useMutation({
        mutationFn: async ({ bitmap, state }: { bitmap: ImageBitmap; state: CropState }) =>
            uploadAvatar(await renderAvatar(bitmap, cropRect(bitmap, state))),
        onSuccess: (user) => {
            queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
            onClose();
            notify({ tone: 'sucesso', message: 'Foto atualizada.' });
        },
        onError: (cause) => setError(messageOf(cause)),
    });

    async function choose(file: File | undefined) {
        if (!file) return;
        setError(null);
        const rejection = rejectSourceFile(file);
        if (rejection) {
            setImage(null);
            setCrop(null);
            setError(rejection);
            return;
        }
        setDecoding(true);
        try {
            const bitmap = await decodeImage(file);
            setImage(bitmap);
            setCrop(initialCrop(bitmap));
        } catch {
            setImage(null);
            setCrop(null);
            setError(AVATAR_FILE_MESSAGES.undecodable);
        } finally {
            setDecoding(false);
        }
    }

    return (
        <FormDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Foto do perfil"
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form={FORM_ID}
                        disabled={!image || !crop || decoding || save.isPending}
                    >
                        Salvar
                    </Button>
                </>
            }
        >
            <form
                id={FORM_ID}
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!image || !crop) return;
                    setError(null);
                    save.mutate({ bitmap: image, state: crop });
                }}
            >
                <FormAlert message={error} />
                <input
                    ref={inputRef}
                    type="file"
                    accept={AVATAR_ACCEPT}
                    aria-label="Arquivo da foto"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        // Limpo para que escolher o mesmo arquivo de novo dispare `change`.
                        event.currentTarget.value = '';
                        void choose(file);
                    }}
                />
                <Button
                    variant="outline"
                    className="self-start"
                    disabled={decoding}
                    onClick={() => inputRef.current?.click()}
                >
                    <ImagePlus aria-hidden="true" strokeWidth={1.75} />
                    Escolher imagem
                </Button>
                {image && crop && (
                    <>
                        <CropArea image={image} crop={crop} onCropChange={setCrop} />
                        <div className="flex flex-col gap-2">
                            <label htmlFor={zoomId} className="text-rotulo text-texto-apoio">
                                Zoom
                            </label>
                            <input
                                id={zoomId}
                                type="range"
                                min={MIN_ZOOM}
                                max={MAX_ZOOM}
                                step={ZOOM_STEP}
                                value={crop.zoom}
                                aria-valuetext={`${crop.zoom.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`}
                                onChange={(event) =>
                                    setCrop(
                                        zoomCrop(image, crop, event.currentTarget.valueAsNumber),
                                    )
                                }
                                className="min-h-11 w-full accent-acento"
                            />
                        </div>
                    </>
                )}
            </form>
        </FormDialog>
    );
}
