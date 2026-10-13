import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { useCan } from '@/api/permissions';
import { useBankAccounts, useCreditCards } from '@/api/queries/reference';
import { monthOf, today as todayOf } from '@/shared/dates';
import { buttonVariants } from '@/ui/components/ui/button';

import { BalanceCards } from './balance-cards';
import { ByTypeSection } from './by-type-section';
import { AccountsSection } from './accounts-section';
import { activeCards } from './dashboard-data';
import { DueSection } from './due-section';
import { useCardStatements } from './use-card-statements';

/**
 * `/` (spec 0015): o dashboard de saldo. Compõe consultas existentes, cada seção com o seu
 * carregamento e o seu erro (INV-0015-04), e leva às ações das outras telas só por navegação
 * (INV-0015-01).
 */
export function Dashboard() {
    const today = todayOf();
    const month = monthOf(today);
    const canWrite = useCan('entries.write');
    const accounts = useBankAccounts();
    const cards = useCreditCards();
    const statements = useCardStatements(cards.data ? activeCards(cards.data) : []);

    return (
        <div className="mx-auto flex w-full max-w-300 flex-col gap-6 lg:gap-8">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titulo-1">Início</h1>
                {canWrite && (
                    <div className="hidden items-center gap-3 md:flex">
                        <span className="hidden lg:contents">
                            <Link
                                to="/receitas"
                                search={{ novo: 1 }}
                                className={buttonVariants({ variant: 'outline' })}
                            >
                                <Plus aria-hidden="true" />
                                Nova receita
                            </Link>
                        </span>
                        <Link to="/despesas" search={{ novo: 1 }} className={buttonVariants()}>
                            <Plus aria-hidden="true" />
                            Nova despesa
                        </Link>
                    </div>
                )}
            </header>
            <div className="grid gap-6 lg:grid-cols-3">
                <BalanceCards month={month} className="lg:col-span-2" />
                <ByTypeSection month={month} className="hidden lg:flex" />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <DueSection
                    today={today}
                    cards={cards}
                    statements={statements}
                    className="lg:col-span-2"
                />
                <AccountsSection accounts={accounts} cards={cards} statements={statements} />
            </div>
        </div>
    );
}
