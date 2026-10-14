import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { avatarQueryOptions } from './avatar-api';

const SIZES = {
    /** 32px: o botão do menu do usuário. */
    sm: 'size-8 text-rotulo',
    /** 48px: o painel do menu, ao lado do nome. */
    lg: 'size-12 text-corpo-forte',
} as const;

export interface UserAvatarProps {
    /** `avatarUpdatedAt` do usuário atual; nulo (ou ausente) é sem foto. */
    avatarUpdatedAt: string | null | undefined;
    /** As iniciais, mostradas sem foto, enquanto ela carrega ou se a leitura falhar. */
    fallback: string;
    size: keyof typeof SIZES;
}

/**
 * A foto exibida por `URL.createObjectURL`. A URL é criada e revogada pelo mesmo efeito: revogada
 * quando a foto muda ou o componente sai. Até a imagem carregar, ou se ela não carregar, as
 * iniciais continuam.
 */
function AvatarImage({
    photo,
    visible,
    onLoad,
}: {
    photo: Blob;
    visible: boolean;
    onLoad: (loaded: boolean) => void;
}) {
    const ref = useRef<HTMLImageElement>(null);
    useEffect(() => {
        const url = URL.createObjectURL(photo);
        if (ref.current) ref.current.src = url;
        return () => URL.revokeObjectURL(url);
    }, [photo]);
    return (
        <img
            ref={ref}
            alt=""
            data-slot="foto"
            onLoad={() => onLoad(true)}
            onError={() => onLoad(false)}
            className={clsx(
                'absolute inset-0 size-full rounded-full object-cover',
                !visible && 'invisible',
            )}
        />
    );
}

/**
 * Avatar do usuário atual (spec 0006): a foto de `GET /users/me/avatar` em círculo quando
 * `avatarUpdatedAt` não é nulo; sem foto, enquanto ela carrega ou se a leitura falhar
 * (ERR-0006-10), as iniciais, sem alerta. Decorativo: quem o contém dá o nome acessível.
 */
export function UserAvatar({ avatarUpdatedAt, fallback, size }: UserAvatarProps) {
    const { data: photo } = useQuery({
        ...avatarQueryOptions(avatarUpdatedAt ?? ''),
        enabled: Boolean(avatarUpdatedAt),
    });
    const [loaded, setLoaded] = useState<{ photo: Blob; ok: boolean } | null>(null);
    const showPhoto = photo !== undefined && Boolean(avatarUpdatedAt);
    const visible = showPhoto && loaded?.photo === photo && loaded.ok;

    return (
        <span
            aria-hidden="true"
            className={clsx(
                'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-linha bg-superficie-elevada text-texto',
                SIZES[size],
            )}
        >
            {!visible && fallback}
            {showPhoto && (
                <AvatarImage
                    key={avatarUpdatedAt}
                    photo={photo}
                    visible={visible}
                    onLoad={(ok) => setLoaded({ photo, ok })}
                />
            )}
        </span>
    );
}
