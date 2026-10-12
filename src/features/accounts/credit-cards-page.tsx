import { CreditCard as CreditCardIcon } from 'lucide-react';

import { useAccountLookup, type Lookup } from '@/api/queries/lookups';
import { useCreditCards, type CreditCard } from '@/api/queries/reference';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import { AvailableMoney, cycleText, UsedWithBar } from './card-parts';
import { ArchivedToggle, QueryContent, sortByText, visibleItems } from './list-parts';

/** Rótulo da conta pagadora, ou "—" sem conta. */
export function paymentAccountLabel(card: CreditCard, accounts: Lookup): string {
    return card.paymentBankAccountId ? accounts.label(card.paymentBankAccountId) : '—';
}

const archivedBadge = (card: CreditCard) =>
    card.archivedAt ? <StatusBadge badge={DERIVED_BADGES.arquivado} /> : null;

function columnsFor(accounts: Lookup): readonly EntryColumn<CreditCard>[] {
    return [
        {
            header: 'Cartão',
            cell: (card) => (
                <span className="flex flex-col">
                    <span className="text-corpo-forte">{card.name}</span>
                    <span className="text-pequeno text-texto-apoio">{card.bank.name}</span>
                </span>
            ),
        },
        { header: 'Usado', cell: (card) => <UsedWithBar card={card} />, align: 'end' },
        {
            header: 'Disponível',
            cell: (card) => <AvailableMoney cents={card.availableLimitCents} />,
            align: 'end',
        },
        { header: 'Ciclo', cell: cycleText },
        {
            header: 'Conta pagadora',
            cell: (card) => paymentAccountLabel(card, accounts),
            hideBelow: 'lg',
        },
        { header: 'Estado', cell: archivedBadge },
    ];
}

function CreditCardCard({ card }: { card: CreditCard }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-corpo-forte">{card.name}</span>
                    <span className="text-pequeno text-texto-apoio">{card.bank.name}</span>
                    {archivedBadge(card)}
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-rotulo text-texto-apoio">Disponível</span>
                    <AvailableMoney cents={card.availableLimitCents} />
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-pequeno text-texto-apoio">
                <span>Usado</span>
                <UsedWithBar card={card} />
            </div>
            <span className="text-pequeno text-texto-apoio">{cycleText(card)}</span>
        </div>
    );
}

export interface CreditCardsPageProps {
    /** `?arquivados=1`. */
    showArchived: boolean;
    onShowArchivedChange: (showArchived: boolean) => void;
}

/** `/cartoes` (spec 0011): os cartões, em ordem de nome; cada um leva ao seu resumo. */
export function CreditCardsPage({ showArchived, onShowArchivedChange }: CreditCardsPageProps) {
    const query = useCreditCards();
    const accounts = useAccountLookup();
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-titulo-1">Cartões</h1>
            <QueryContent query={query}>
                {(cards) => (
                    <div className="flex flex-col gap-3">
                        <ArchivedToggle
                            label="Mostrar arquivados"
                            checked={showArchived}
                            onChange={onShowArchivedChange}
                        />
                        <EntryList
                            items={sortByText(
                                visibleItems(cards, showArchived),
                                (card) => card.name,
                            )}
                            getKey={(card) => card.id}
                            caption="Cartões de crédito"
                            columns={columnsFor(accounts)}
                            renderCard={(card) => <CreditCardCard card={card} />}
                            href={(card) => `/cartoes/${card.id}`}
                            empty={
                                <EmptyState
                                    variant="vazio"
                                    icon={CreditCardIcon}
                                    title="Nenhum cartão de crédito."
                                    description="Os cartões cadastrados aparecem aqui."
                                />
                            }
                        />
                    </div>
                )}
            </QueryContent>
        </div>
    );
}
