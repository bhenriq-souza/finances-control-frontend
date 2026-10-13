import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { useAccountLookup } from '@/api/queries/lookups';
import { useCreditCards } from '@/api/queries/reference';
import { buttonVariants } from '@/ui/components/ui/button';
import { Card } from '@/ui/components/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Money } from '@/ui/money';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import { AvailableMoney, cycleText, LimitBar, usedCents } from './card-parts';
import { paymentAccountLabel } from './credit-cards-page';
import { QueryContent } from './list-parts';

function Item({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <dt className="text-rotulo text-texto-apoio">{label}</dt>
            <dd className="text-corpo text-texto">{children}</dd>
        </div>
    );
}

/**
 * `/cartoes/$cartaoId` (spec 0011): o resumo do cartão em `Card` — limite total, usado,
 * disponível, ciclo atual e conta pagadora. O cartão vem da consulta de referência (com os
 * arquivados); id ausente dela é o `nao-encontrado` (ERR-0011-03). `children` é o que a rota
 * compõe abaixo do resumo, só quando o cartão existe (o painel de faturas da spec 0013).
 */
export function CreditCardPage({ cardId, children }: { cardId: string; children?: ReactNode }) {
    const query = useCreditCards();
    const accounts = useAccountLookup();
    return (
        <div className="flex flex-col gap-6">
            <Link
                to="/cartoes"
                className={buttonVariants({ variant: 'link', className: 'self-start' })}
            >
                <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
                Cartões
            </Link>
            <QueryContent query={query}>
                {(cards) => {
                    const card = cards.find((item) => item.id === cardId);
                    if (!card) {
                        return (
                            <EmptyState
                                variant="nao-encontrado"
                                backTo="/cartoes"
                                backLabel="Voltar para os cartões"
                            />
                        );
                    }
                    return (
                        <Card className="gap-5 p-4 md:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-titulo-1">{card.name}</h1>
                                    <p className="text-corpo text-texto-apoio">{card.bank.name}</p>
                                </div>
                                {card.archivedAt ? (
                                    <StatusBadge badge={DERIVED_BADGES.arquivado} />
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-rotulo text-texto-apoio">Disponível</span>
                                <AvailableMoney
                                    cents={card.availableLimitCents}
                                    size="valor-destaque"
                                />
                                <LimitBar card={card} />
                            </div>
                            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Item label="Limite total">
                                    <Money cents={card.creditLimitCents} />
                                </Item>
                                <Item label="Usado">
                                    <Money cents={usedCents(card)} sign="never" />
                                </Item>
                                <Item label="Ciclo atual">{cycleText(card)}</Item>
                                <Item label="Conta pagadora">
                                    {paymentAccountLabel(card, accounts)}
                                </Item>
                            </dl>
                        </Card>
                    );
                }}
            </QueryContent>
            {query.data?.some((item) => item.id === cardId) ? children : null}
        </div>
    );
}
