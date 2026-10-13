import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PieChart } from 'lucide-react';

import { formatMonth, type IsoMonth } from '@/shared/dates';
import { BarList } from '@/ui/charts/bar-list';
import { buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Skeleton } from '@/ui/skeleton';

import { topExpenseTypes } from './dashboard-data';
import { expensesByTypeQuery } from './dashboard-queries';
import { PANEL, QueryContent, Section } from './section';

/** O endereço da aba **Por tipo** dos relatórios, para onde leva **Ver relatório**. */
export const REPORT_HREF = '/relatorios?aba=por-tipo';

const skeleton = (
    <div className={`${PANEL} flex flex-col gap-4`}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
    </div>
);

/**
 * "Despesas por tipo" do mês, só no desktop: os três maiores tipos e "Outros", em `BarList`, e o
 * link **Ver relatório**.
 */
export function ByTypeSection({ month, className }: { month: IsoMonth; className?: string }) {
    const query = useQuery(expensesByTypeQuery(month));
    return (
        <Section
            title={`Despesas por tipo · ${formatMonth(month)}`}
            className={className}
            action={
                <Link
                    to="/relatorios"
                    search={{ aba: 'por-tipo' }}
                    className={`${buttonVariants({ variant: 'link' })} min-h-11`}
                >
                    Ver relatório
                </Link>
            }
        >
            <QueryContent query={query} skeleton={skeleton}>
                {(report) => {
                    const items = topExpenseTypes(report, month);
                    return items.length === 0 ? (
                        <EmptyState
                            variant="vazio"
                            icon={PieChart}
                            title="Nenhuma despesa no mês."
                        />
                    ) : (
                        <div className={PANEL}>
                            <BarList items={items} label="Despesas por tipo" />
                        </div>
                    );
                }}
            </QueryContent>
        </Section>
    );
}
