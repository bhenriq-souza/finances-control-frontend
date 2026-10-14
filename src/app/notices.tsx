import type { ReactNode } from 'react';

import { NoticeProvider, type NoticeStore } from '@/ui/notice';

/**
 * Efeito global de `AUTH_UNAVAILABLE` (spec 0005) ligado ao aviso (spec 0009, ERR-0009-07): um
 * aviso de erro com a mensagem do catálogo. A consulta continua em erro e a tela mostra o seu
 * `EmptyState` `erro`.
 */
export function authUnavailableNotice(store: NoticeStore): (userMessage: string) => void {
    return (userMessage) => store.show({ tone: 'erro', message: userMessage });
}

/** O provider de avisos da aplicação, sobre a fila criada em `createAppContext`. */
export function AppNotices({ store, children }: { store: NoticeStore; children: ReactNode }) {
    return <NoticeProvider store={store}>{children}</NoticeProvider>;
}
