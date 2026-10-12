import { Link } from '@tanstack/react-router';
import { CircleAlert, Inbox, Lock, SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, buttonVariants } from '@/ui/components/ui/button';

/**
 * Estado no lugar de uma lista ou de um detalhe (spec 0009):
 * - `vazio`: lista sem itens; título e texto da tela, ação opcional (ex.: **Nova despesa**);
 * - `erro`: a consulta falhou; a mensagem do catálogo (`ApiError.userMessage`) e **Tentar de
 *   novo**, que chama `refetch` (ERR-0009-01);
 * - `nao-encontrado`: detalhe com `*_NOT_FOUND` e um link de volta para a lista (ERR-0009-02);
 * - `sem-acesso`: rota que exige uma permissão que o perfil não tem (ERR-0009-05).
 */
export type EmptyStateProps =
    | {
          variant: 'vazio';
          title: string;
          description?: string;
          action?: ReactNode;
          icon?: LucideIcon;
      }
    | {
          variant: 'erro';
          /** Só `userMessage`, para que o `ui` não dependa do `api`: um `ApiError` serve. */
          error: { userMessage: string };
          onRetry: () => void;
      }
    | {
          variant: 'nao-encontrado';
          /** Rota da lista. */
          backTo: string;
          /** Padrão: "Voltar para a lista". */
          backLabel?: string;
      }
    | { variant: 'sem-acesso' };

interface Content {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}

function contentOf(props: EmptyStateProps): Content {
    switch (props.variant) {
        case 'vazio':
            return {
                icon: props.icon ?? Inbox,
                title: props.title,
                description: props.description,
                action: props.action,
            };
        case 'erro':
            return {
                icon: CircleAlert,
                title: 'Não foi possível carregar.',
                description: props.error.userMessage,
                action: (
                    <Button variant="outline" onClick={props.onRetry}>
                        Tentar de novo
                    </Button>
                ),
            };
        case 'nao-encontrado':
            return {
                icon: SearchX,
                title: 'Não encontramos este item.',
                action: (
                    <Link to={props.backTo} className={buttonVariants({ variant: 'outline' })}>
                        {props.backLabel ?? 'Voltar para a lista'}
                    </Link>
                ),
            };
        case 'sem-acesso':
            return { icon: Lock, title: 'Seu perfil não dá acesso a esta tela.' };
    }
}

export function EmptyState(props: EmptyStateProps) {
    const { icon: Icon, title, description, action } = contentOf(props);
    return (
        <section
            data-variant={props.variant}
            role={props.variant === 'erro' ? 'alert' : undefined}
            className="flex flex-col items-center gap-3 rounded-md border border-linha bg-superficie px-4 py-10 text-center text-texto"
        >
            <Icon aria-hidden="true" strokeWidth={1.75} className="size-8 text-texto-apoio" />
            <h2 className="text-titulo-3">{title}</h2>
            {description ? (
                <p className="max-w-md text-corpo text-texto-apoio">{description}</p>
            ) : null}
            {action ? <div className="mt-2">{action}</div> : null}
        </section>
    );
}
