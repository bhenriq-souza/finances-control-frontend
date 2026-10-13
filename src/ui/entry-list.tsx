import { Link, useNavigate } from '@tanstack/react-router';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

// `clsx` e não `cn`: o tailwind-merge trataria `text-rotulo` (tamanho) e `text-texto-apoio` (cor)
// como conflito.

export interface EntryColumn<T> {
    header: string;
    cell: (item: T) => ReactNode;
    /** `end` para valores. Padrão: `start`. */
    align?: 'start' | 'end';
    /** Coluna que só aparece no desktop. */
    hideBelow?: 'lg';
}

export interface EntryListProps<T> {
    items: readonly T[];
    getKey: (item: T) => string;
    /** Título acessível da tabela (visualmente oculto). */
    caption: string;
    /** Tabela, a partir de `md`. */
    columns: readonly EntryColumn<T>[];
    /** Cartão, abaixo de `md`. */
    renderCard: (item: T) => ReactNode;
    /** Linha/cartão navegável. */
    href?: (item: T) => string;
    /** Menu da linha, fora do link (normalmente um `RowMenu`). */
    actions?: (item: T) => ReactNode;
    /** Mostrado no lugar da lista sem itens; normalmente um `EmptyState`. */
    empty: ReactNode;
}

const LINK_FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-foco';

function columnClass<T>(column: EntryColumn<T>): string {
    return clsx(
        column.align === 'end' ? 'text-end' : 'text-start',
        column.hideBelow === 'lg' && 'hidden lg:table-cell',
    );
}

/**
 * Lista que vira tabela no tablet (spec 0009): cartões abaixo de `md`, `<table>` a partir de `md`.
 * As duas formas ficam no DOM e o CSS mostra uma só (`display: none` também as tira da árvore
 * de acessibilidade). Sem ordenação, paginação nem seleção: a tela ordena antes de passar `items`.
 */
export function EntryList<T>({
    items,
    getKey,
    caption,
    columns,
    renderCard,
    href,
    actions,
    empty,
}: EntryListProps<T>) {
    const navigate = useNavigate();

    if (items.length === 0) return <>{empty}</>;

    // Com `href`, a primeira coluna de texto (não alinhada ao fim) leva o link da linha.
    const linkColumn = href ? columns.findIndex((column) => column.align !== 'end') : -1;

    return (
        <>
            <ul aria-label={caption} className="flex flex-col gap-3 md:hidden">
                {items.map((item) => {
                    const key = getKey(item);
                    const cardClass = clsx(
                        'block min-h-11 rounded-md border border-linha bg-superficie p-4 text-texto',
                        actions && 'pe-14',
                    );
                    return (
                        <li key={key} className={actions ? 'relative' : undefined}>
                            {href ? (
                                <Link
                                    to={href(item)}
                                    className={clsx(
                                        cardClass,
                                        LINK_FOCUS,
                                        'hover:bg-superficie-elevada',
                                    )}
                                >
                                    {renderCard(item)}
                                </Link>
                            ) : (
                                <div className={cardClass}>{renderCard(item)}</div>
                            )}
                            {actions && (
                                <div className="absolute end-1 top-1 flex">{actions(item)}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
            <table className="hidden w-full border-collapse overflow-hidden rounded-md border border-linha bg-superficie text-corpo text-texto md:table">
                <caption className="sr-only">{caption}</caption>
                <thead className="bg-superficie-elevada">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.header}
                                scope="col"
                                className={clsx(
                                    'px-4 py-3 text-rotulo text-texto-apoio',
                                    columnClass(column),
                                )}
                            >
                                {column.header}
                            </th>
                        ))}
                        {actions && (
                            <th scope="col" className="px-4 py-3">
                                <span className="sr-only">Ações</span>
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => {
                        const to = href?.(item);
                        return (
                            <tr
                                key={getKey(item)}
                                // O clique na linha repete o link; o teclado usa o link da célula.
                                onClick={
                                    to
                                        ? (event) => {
                                              if ((event.target as Element).closest('a')) return;
                                              void navigate({ to });
                                          }
                                        : undefined
                                }
                                className={clsx(
                                    'border-t border-linha',
                                    to && 'cursor-pointer hover:bg-superficie-elevada',
                                )}
                            >
                                {columns.map((column, index) => (
                                    <td
                                        key={column.header}
                                        className={clsx('px-4 py-3', columnClass(column))}
                                    >
                                        {to && index === linkColumn ? (
                                            <Link
                                                to={to}
                                                className={clsx(
                                                    'rounded-sm hover:underline',
                                                    LINK_FOCUS,
                                                )}
                                            >
                                                {column.cell(item)}
                                            </Link>
                                        ) : (
                                            column.cell(item)
                                        )}
                                    </td>
                                ))}
                                {actions && (
                                    // O painel do menu fica num portal, mas os eventos do React sobem
                                    // por ele: parar aqui impede o clique de repetir o link da linha.
                                    <td
                                        className="w-px px-2 py-1 text-end"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                        }}
                                    >
                                        {actions(item)}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </>
    );
}
