import { clsx } from 'clsx';

import type { Badge, BadgeFamily } from './status-labels';

// `clsx` e não `cn`: o tailwind-merge trataria `text-rotulo` (tamanho) e `text-info` (cor) como conflito.

const FAMILY_CLASS: Record<BadgeFamily, { badge: string; dot: string }> = {
    positivo: { badge: 'bg-positivo-fundo text-positivo', dot: 'bg-positivo' },
    negativo: { badge: 'bg-negativo-fundo text-negativo', dot: 'bg-negativo' },
    atencao: { badge: 'bg-atencao-fundo text-atencao', dot: 'bg-atencao' },
    info: { badge: 'bg-info-fundo text-info', dot: 'bg-info' },
    neutra: { badge: 'bg-superficie-elevada text-texto-apoio', dot: 'bg-texto-apoio' },
};

export type StatusBadgeProps = {
    /** Uma linha das tabelas de `status-labels.ts` (INV-0009-04). */
    badge: Badge;
    className?: string;
};

/**
 * O selo de status do Design System: ponto, rótulo em caixa alta e fundo da família, 24px de
 * altura. O rótulo sempre aparece; a cor nunca é a única informação.
 */
export function StatusBadge({ badge, className }: StatusBadgeProps) {
    const family = FAMILY_CLASS[badge.family];
    return (
        <span
            data-family={badge.family}
            className={clsx(
                'text-rotulo inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 whitespace-nowrap uppercase',
                family.badge,
                className,
            )}
        >
            <span aria-hidden="true" className={clsx('size-1.5 rounded-full', family.dot)} />
            {badge.label}
        </span>
    );
}
