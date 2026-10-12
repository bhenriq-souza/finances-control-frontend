import type { Cents } from '@/shared/money';
import { Money } from '@/ui/money';

export interface BarListItem {
    key: string;
    label: string;
    cents: Cents;
}

export interface BarListProps {
    items: readonly BarListItem[];
    /** Nome acessível da lista (ex.: "Despesas por tipo"). */
    label: string;
}

/**
 * Barras horizontais rotuladas (spec 0009): nome, valor em `Money` e uma barra de 6px
 * proporcional ao maior valor, em `acento` sobre `superficie-elevada`. Sem biblioteca de
 * gráficos: a `<ul>` com nome e valor é o que o leitor de tela lê; a barra é decorativa.
 */
export function BarList({ items, label }: BarListProps) {
    const max = Math.max(0, ...items.map((item) => item.cents));
    return (
        <ul aria-label={label} className="flex flex-col gap-3">
            {items.map((item) => {
                // Proporção só para a largura da barra; o valor exibido continua em centavos.
                const percent = max > 0 ? (Math.max(0, item.cents) / max) * 100 : 0;
                return (
                    <li key={item.key} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-corpo text-texto">{item.label}</span>
                            <Money cents={item.cents} size="valor-pequeno" />
                        </div>
                        <div
                            aria-hidden="true"
                            className="h-1.5 overflow-hidden rounded-full bg-superficie-elevada"
                        >
                            <div
                                data-slot="bar"
                                className="h-full rounded-full bg-acento"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
