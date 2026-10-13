import { useSyncExternalStore } from 'react';

const PHONE_QUERY = '(max-width: 767.98px)';

function subscribe(onChange: () => void): () => void {
    const query = window.matchMedia?.(PHONE_QUERY);
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
}

/** Sem `matchMedia` (jsdom), vale o desktop: os botões, como antes do menu do celular. */
const isPhone = () => window.matchMedia?.(PHONE_QUERY).matches ?? false;

/** Se a tela está abaixo de `md` (768px), acompanhando o redimensionamento. */
export function useIsPhone(): boolean {
    return useSyncExternalStore(subscribe, isPhone);
}
