import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';

import { Button } from './components/ui/button';
import { useReturnFocus } from './dialog-focus';

export interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** O que vai acontecer, inclusive as cascatas. */
    description: ReactNode;
    /** O verbo da ação: "Excluir", "Revogar". */
    confirmLabel: string;
    onConfirm: () => void;
    /** Ação destrutiva: o botão de confirmar usa a variante `negativo`. */
    destructive?: boolean;
    /** Enquanto a ação roda, o botão de confirmar fica desabilitado. */
    pending?: boolean;
    /** Conteúdo extra abaixo do texto, ex.: o `FormAlert` de um erro da API. */
    children?: ReactNode;
}

/**
 * Confirmação (spec 0009), sobre `@radix-ui/react-dialog` com `role="alertdialog"`: começa com o
 * foco em **Cancelar**, `Esc` cancela, um clique fora não fecha. Confirmar não fecha sozinho: quem
 * fecha é a tela, no sucesso (INV-0009-06).
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    onConfirm,
    destructive = false,
    pending = false,
    children,
}: ConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const focus = useReturnFocus();

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay data-slot="veu" className="fixed inset-0 z-40 bg-veu" />
                <Dialog.Content
                    role="alertdialog"
                    aria-modal="true"
                    onOpenAutoFocus={(event) => {
                        focus.remember();
                        event.preventDefault();
                        cancelRef.current?.focus();
                    }}
                    onCloseAutoFocus={focus.onCloseAutoFocus}
                    onPointerDownOutside={(event) => event.preventDefault()}
                    className="fixed inset-x-4 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-4 rounded-lg border border-linha bg-superficie p-5 text-texto shadow-[var(--ft-sombra-flutuante)] outline-none md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:p-6"
                >
                    <div className="flex flex-col gap-2">
                        <Dialog.Title className="text-titulo-2">{title}</Dialog.Title>
                        <Dialog.Description className="text-corpo text-texto-apoio">
                            {description}
                        </Dialog.Description>
                    </div>
                    {children}
                    <div className="flex gap-3 *:flex-1 md:justify-end md:*:flex-none">
                        <Button
                            ref={cancelRef}
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant={destructive ? 'negativo' : 'default'}
                            disabled={pending}
                            onClick={onConfirm}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
