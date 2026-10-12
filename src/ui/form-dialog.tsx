import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { useReturnFocus } from './dialog-focus';

export interface FormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    /** O formulário. O botão de enviar fica no `footer` e aponta para ele por `form="<id>"`. */
    children: ReactNode;
    /** As ações (ex.: **Cancelar** e **Salvar**), fixas embaixo. */
    footer: ReactNode;
}

/**
 * Formulário em diálogo (spec 0009), sobre `@radix-ui/react-dialog`: foco preso, `Esc` fecha e o
 * foco volta a quem abriu. Abaixo de `md` é uma folha de tela cheia, com o título fixo no topo e as
 * ações fixas embaixo; a partir de `md`, um diálogo central de até 560px sobre o véu.
 *
 * O diálogo não fecha sozinho num erro: quem fecha é a tela, no sucesso (INV-0009-06).
 */
export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
}: FormDialogProps) {
    const focus = useReturnFocus();
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay data-slot="veu" className="fixed inset-0 z-40 bg-veu" />
                <Dialog.Content
                    aria-modal="true"
                    onOpenAutoFocus={focus.remember}
                    onCloseAutoFocus={focus.onCloseAutoFocus}
                    className="fixed inset-0 z-50 flex flex-col bg-superficie text-texto outline-none md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-4rem)] md:w-[calc(100%-3rem)] md:max-w-140 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:border-linha md:shadow-[var(--ft-sombra-flutuante)]"
                >
                    <header className="flex shrink-0 flex-col gap-1 border-b border-linha px-4 py-4 md:px-6">
                        <Dialog.Title className="text-titulo-2">{title}</Dialog.Title>
                        {description && (
                            <Dialog.Description className="text-corpo text-texto-apoio">
                                {description}
                            </Dialog.Description>
                        )}
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
                        {children}
                    </div>
                    <footer className="flex shrink-0 gap-3 border-t border-linha px-4 py-3 *:flex-1 md:justify-end md:px-6 md:*:flex-none">
                        {footer}
                    </footer>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
