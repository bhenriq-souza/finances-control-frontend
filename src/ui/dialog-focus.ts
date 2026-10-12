import { useRef } from 'react';

/**
 * Devolve o foco a quem abriu o diálogo. O Radix só o devolve ao seu `Dialog.Trigger`, e os
 * diálogos daqui são controlados (`open`), abertos por qualquer botão ou pela URL: o elemento com
 * foco na abertura é guardado e volta a ter o foco no fechamento.
 */
export function useReturnFocus() {
    const returnTo = useRef<HTMLElement | null>(null);
    return {
        /** Chamar no `onOpenAutoFocus`, antes de o foco entrar no diálogo. */
        remember() {
            const active = document.activeElement;
            returnTo.current = active instanceof HTMLElement ? active : null;
        },
        /** O `onCloseAutoFocus` do `Dialog.Content`. */
        onCloseAutoFocus(event: Event) {
            event.preventDefault();
            const target = returnTo.current;
            returnTo.current = null;
            if (target?.isConnected) target.focus();
        },
    };
}
