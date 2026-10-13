import { clsx } from 'clsx';
import type { CSSProperties } from 'react';

import { formatDate, formatMonth, type IsoMonth } from '@/shared/dates';
import { formatBRL, type Cents } from '@/shared/money';

export interface MonthColumn {
    month: IsoMonth;
    cents: Cents;
    /** Mês previsto: `info-fundo` com contorno `info`; sem isso, realizado em `acento`. */
    forecast?: boolean;
}

export interface MonthColumnsProps {
    columns: readonly MonthColumn[];
}

/** Acima disto, o gráfico rola na horizontal no celular (spec 0015, "Celular"). */
export const SCROLL_AFTER_MONTHS = 6;

// Largura mínima de cada coluna no celular quando o gráfico rola.
const MOBILE_COLUMN_PX = 56;

// Coordenadas do `viewBox`: 100 por mês na largura e 1000 de altura; o SVG estica para ocupar a
// área (`preserveAspectRatio="none"`) e os contornos não engrossam (`non-scaling-stroke`).
const SLOT = 100;
const BAR = 64;
const HEIGHT = 1000;

/** `'2026-10'` → `out.`; o ano aparece no primeiro mês e em janeiro. */
function shortMonth(month: IsoMonth): string {
    return formatDate(`${month}-01`, 'curta').split(' ')[1] ?? month;
}

function barClass(column: MonthColumn): string {
    const negative = column.cents < 0;
    if (column.forecast) {
        return negative ? 'fill-negativo-fundo stroke-negativo' : 'fill-info-fundo stroke-info';
    }
    return negative ? 'fill-negativo' : 'fill-acento';
}

/**
 * Colunas por mês em SVG próprio, sem biblioteca de gráficos (spec 0015): realizado em `acento`,
 * previsto em `info-fundo` com contorno `info`, negativo em `negativo` abaixo do eixo zero, que só
 * aparece quando há negativos. O gráfico inteiro é `aria-hidden`: a tabela ao lado, com os mesmos
 * números, é a versão acessível (INV-0015-03); o valor de cada coluna fica no `title`.
 */
export function MonthColumns({ columns }: MonthColumnsProps) {
    const max = Math.max(0, ...columns.map((column) => column.cents));
    const min = Math.min(0, ...columns.map((column) => column.cents));
    // Proporções só para a geometria; os valores exibidos continuam em centavos.
    const range = max - min || 1;
    const zeroY = (max / range) * HEIGHT;
    const scrolls = columns.length > SCROLL_AFTER_MONTHS;
    const style = scrolls
        ? ({ '--month-columns-min': `${columns.length * MOBILE_COLUMN_PX}px` } as CSSProperties)
        : undefined;

    return (
        <div
            aria-hidden="true"
            data-slot="month-columns"
            className="overflow-x-auto md:overflow-visible"
        >
            <div
                style={style}
                className={clsx(
                    'flex flex-col gap-2',
                    scrolls && 'min-w-(--month-columns-min) md:min-w-0',
                )}
            >
                <svg
                    viewBox={`0 0 ${columns.length * SLOT} ${HEIGHT}`}
                    preserveAspectRatio="none"
                    className="h-40 w-full md:h-48"
                >
                    {columns.map((column, index) => {
                        const height = (Math.abs(column.cents) / range) * HEIGHT;
                        const y = column.cents < 0 ? zeroY : zeroY - height;
                        return (
                            <rect
                                key={column.month}
                                data-month={column.month}
                                data-kind={column.forecast ? 'forecast' : 'realized'}
                                data-sign={column.cents < 0 ? 'negative' : 'positive'}
                                x={index * SLOT + (SLOT - BAR) / 2}
                                y={y}
                                width={BAR}
                                height={height}
                                strokeWidth={column.forecast ? 1.5 : 0}
                                vectorEffect="non-scaling-stroke"
                                className={barClass(column)}
                            >
                                <title>{`${formatMonth(column.month)}: ${formatBRL(column.cents)}`}</title>
                            </rect>
                        );
                    })}
                    <line
                        data-slot={min < 0 ? 'zero-axis' : 'baseline'}
                        x1={0}
                        x2={columns.length * SLOT}
                        y1={zeroY}
                        y2={zeroY}
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                        className={min < 0 ? 'stroke-linha-forte' : 'stroke-linha'}
                    />
                </svg>
                <div
                    className="grid text-center text-pequeno text-texto-apoio"
                    style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
                >
                    {columns.map((column, index) => (
                        <span key={column.month} className="flex flex-col">
                            <span>{shortMonth(column.month)}</span>
                            {(index === 0 || column.month.endsWith('-01')) && (
                                <span>{column.month.slice(0, 4)}</span>
                            )}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
