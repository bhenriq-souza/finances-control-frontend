import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

export type NoticeTone = 'sucesso' | 'erro' | 'info';

export interface NoticeInput {
    tone: NoticeTone;
    /** Texto curto em pt-BR; para erro, a mensagem do catálogo. */
    message: string;
}

export interface NoticeItem extends NoticeInput {
    id: number;
}

/** Tempo de vida de um aviso (spec 0009). */
export const NOTICE_TIMEOUT_MS = 5000;

/**
 * Fila de avisos fora do React: o `app` a cria junto do cache de consultas, para que os efeitos
 * globais (ex.: `onAuthUnavailable`) mostrem avisos sem estar numa tela.
 */
export interface NoticeStore {
    show: (notice: NoticeInput) => void;
    dismiss: (id: number) => void;
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => readonly NoticeItem[];
}

export function createNoticeStore(): NoticeStore {
    let items: readonly NoticeItem[] = [];
    let nextId = 1;
    const listeners = new Set<() => void>();

    function emit() {
        for (const listener of listeners) listener();
    }

    function dismiss(id: number) {
        if (!items.some((item) => item.id === id)) return;
        items = items.filter((item) => item.id !== id);
        emit();
    }

    return {
        show(notice) {
            const id = nextId++;
            items = [...items, { ...notice, id }];
            emit();
            setTimeout(() => dismiss(id), NOTICE_TIMEOUT_MS);
        },
        dismiss,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getSnapshot: () => items,
    };
}

const NoticeContext = createContext<NoticeStore | null>(null);

/** Mostra um aviso global: `notify({ tone: 'sucesso', message: 'Despesa salva.' })`. */
export function useNotify(): NoticeStore['show'] {
    const store = useContext(NoticeContext);
    if (!store) throw new Error('useNotify fora do NoticeProvider');
    return store.show;
}

const TONES = {
    sucesso: { icon: CircleCheck, className: 'text-positivo' },
    erro: { icon: CircleAlert, className: 'text-negativo' },
    info: { icon: Info, className: 'text-info' },
} as const;

/** Um aviso: ícone do tom, mensagem e **Fechar**. */
export function Notice({ tone, message, onClose }: NoticeInput & { onClose: () => void }) {
    const { icon: Icon, className } = TONES[tone];
    return (
        <div
            data-tone={tone}
            className="pointer-events-auto flex items-start gap-3 rounded-md border border-linha bg-superficie-elevada py-3 pr-2 pl-4 text-corpo text-texto shadow-[var(--ft-sombra-flutuante)]"
        >
            <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${className}`} />
            <p className="flex-1 py-0.5">{message}</p>
            <button
                type="button"
                aria-label="Fechar aviso"
                onClick={onClose}
                className="-my-1 flex size-8 shrink-0 items-center justify-center rounded-md text-texto-apoio outline-none hover:bg-superficie hover:text-texto focus-visible:ring-2 focus-visible:ring-foco"
            >
                <X aria-hidden="true" className="size-4" />
            </button>
        </div>
    );
}

/**
 * Região dos avisos (spec 0009): `aria-live="polite"` no canto inferior, acima da barra inferior
 * abaixo de `lg`. A região existe sempre, para que o leitor de tela anuncie o que entrar nela.
 */
function NoticeRegion({ store }: { store: NoticeStore }) {
    const items = useSyncExternalStore(store.subscribe, store.getSnapshot);
    return (
        <section
            aria-label="Avisos"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-4 bottom-20 z-60 flex flex-col gap-2 md:right-6 md:left-auto md:w-96 lg:bottom-6"
        >
            {items.map((item) => (
                <Notice
                    key={item.id}
                    tone={item.tone}
                    message={item.message}
                    onClose={() => store.dismiss(item.id)}
                />
            ))}
        </section>
    );
}

/** Dá `useNotify` às telas e desenha a região dos avisos. */
export function NoticeProvider({ store, children }: { store: NoticeStore; children: ReactNode }) {
    return (
        <NoticeContext.Provider value={store}>
            {children}
            <NoticeRegion store={store} />
        </NoticeContext.Provider>
    );
}
