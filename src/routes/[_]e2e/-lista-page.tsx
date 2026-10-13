import { Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { Cents } from '@/shared/money';
import { BarList } from '@/ui/charts/bar-list';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { RowMenu } from '@/ui/row-menu';
import { EntryListSkeleton } from '@/ui/skeleton';

/**
 * O marcador do gate `build` (spec 0002): exibido pela página, sobrevive ao tree-shaking do build
 * `e2e`, e o gate falha se ele chegar a `dist/` — prova de que a página ficou fora da produção.
 */
export const E2E_PROOF_MARKER = '__E2E_FAKE_AUTH__';

interface ProofEntry {
    id: string;
    description: string;
    date: string;
    status: string;
    account: string;
    cents: Cents;
}

// Dados estáticos: a página de prova não chama a API.
const ENTRIES: readonly ProofEntry[] = [
    {
        id: 'd1',
        description: 'Mercado',
        date: '15 out.',
        status: 'Pago',
        account: 'Conta corrente',
        cents: 23490 as Cents,
    },
    {
        id: 'd2',
        description: 'Aluguel',
        date: '10 out.',
        status: 'Pendente',
        account: 'Conta corrente',
        cents: 180000 as Cents,
    },
    {
        id: 'd3',
        description: 'Farmácia',
        date: '8 out.',
        status: 'Previsto',
        account: 'Cartão Visa',
        cents: 4570 as Cents,
    },
];

const COLUMNS: readonly EntryColumn<ProofEntry>[] = [
    { header: 'Descrição', cell: (entry) => entry.description },
    { header: 'Data', cell: (entry) => entry.date },
    { header: 'Status', cell: (entry) => entry.status },
    { header: 'Conta', cell: (entry) => entry.account, hideBelow: 'lg' },
    { header: 'Valor', cell: (entry) => <Money cents={entry.cents} />, align: 'end' },
];

const NONE: readonly ProofEntry[] = [];

function Card({ entry }: { entry: ProofEntry }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
                <span className="text-corpo-forte">{entry.description}</span>
                <span className="text-pequeno text-texto-apoio">
                    {entry.date} · {entry.status}
                </span>
            </div>
            <Money cents={entry.cents} />
        </div>
    );
}

export function ListProofPage() {
    const [chosen, setChosen] = useState('Nenhuma ação escolhida.');
    return (
        <main
            data-e2e-marker={E2E_PROOF_MARKER}
            className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 text-texto md:px-6"
        >
            <h1 className="text-titulo-1">Prova — EntryList</h1>
            <section aria-labelledby="com-itens" className="flex flex-col gap-3">
                <h2 id="com-itens" className="text-titulo-3">
                    Com itens
                </h2>
                <EntryList
                    items={ENTRIES}
                    getKey={(entry) => entry.id}
                    caption="Despesas de outubro"
                    columns={COLUMNS}
                    renderCard={(entry) => <Card entry={entry} />}
                    href={(entry) => `/despesas/${entry.id}`}
                    actions={(entry) => (
                        <RowMenu
                            label={`Ações de ${entry.description}`}
                            items={[
                                {
                                    label: 'Marcar como paga',
                                    icon: Check,
                                    onSelect: () => {
                                        setChosen(`Marcar como paga: ${entry.description}`);
                                    },
                                },
                                {
                                    label: 'Editar',
                                    icon: Pencil,
                                    onSelect: () => {
                                        setChosen(`Editar: ${entry.description}`);
                                    },
                                },
                                {
                                    label: 'Excluir',
                                    icon: Trash2,
                                    tone: 'negativo',
                                    onSelect: () => {
                                        setChosen(`Excluir: ${entry.description}`);
                                    },
                                },
                            ]}
                        />
                    )}
                    empty={<EmptyState variant="vazio" title="Nenhuma despesa." />}
                />
                <p role="status" data-testid="acao-escolhida" className="text-pequeno">
                    {chosen}
                </p>
            </section>
            <section aria-labelledby="sem-itens" className="flex flex-col gap-3">
                <h2 id="sem-itens" className="text-titulo-3">
                    Sem itens
                </h2>
                <EntryList
                    items={NONE}
                    getKey={(entry) => entry.id}
                    caption="Receitas de outubro"
                    columns={COLUMNS}
                    renderCard={(entry) => <Card entry={entry} />}
                    empty={
                        <EmptyState
                            variant="vazio"
                            title="Nenhuma receita neste mês."
                            description="As receitas lançadas aparecem aqui."
                        />
                    }
                />
            </section>
            <section aria-labelledby="carregando" className="flex flex-col gap-3">
                <h2 id="carregando" className="text-titulo-3">
                    Carregando
                </h2>
                <EntryListSkeleton />
            </section>
            <section aria-labelledby="por-tipo" className="flex flex-col gap-3">
                <h2 id="por-tipo" className="text-titulo-3">
                    Despesas por tipo
                </h2>
                <BarList
                    label="Despesas por tipo"
                    items={[
                        { key: 'moradia', label: 'Moradia', cents: 180000 as Cents },
                        { key: 'mercado', label: 'Mercado', cents: 90000 as Cents },
                        { key: 'saude', label: 'Saúde', cents: 4570 as Cents },
                    ]}
                />
            </section>
        </main>
    );
}
