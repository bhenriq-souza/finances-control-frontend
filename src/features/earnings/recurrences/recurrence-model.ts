import { z } from 'zod';

import { addMonths, dateSchema, monthOf, monthRange, today, type IsoDate } from '@/shared/dates';

// Regras puras das séries de receita (spec 0017): janela das ocorrências, encerrar e o texto.

/** O texto do efeito de encerrar, mostrado antes do envio (INV-0017-02). */
export const END_EFFECT_TEXT =
    'As ocorrências previstas depois desta data serão excluídas. As já confirmadas, pagas ou recebidas ficam.';

export const ENDS_BEFORE_START_MESSAGE = 'O último mês não pode ser antes do início da série.';

interface SeriesDates {
    startsOn: IsoDate;
    endsOn: IsoDate | null;
}

/** "Todo dia N". */
export const dayOfMonthText = (day: number) => `Todo dia ${day}`;

/** A série já terminou: `endsOn` passado. */
export function isEnded({ endsOn }: Pick<SeriesDates, 'endsOn'>, reference = today()): boolean {
    return endsOn !== null && endsOn < reference;
}

/**
 * O período das ocorrências (spec 0017, "Detalhe"): de `startsOn` a `endsOn` ou, sem fim, ao
 * último dia do 12º mês depois do mês de hoje (o horizonte da série no backend).
 */
export function occurrenceWindow(
    { startsOn, endsOn }: SeriesDates,
    reference = today(),
): { from: IsoDate; to: IsoDate } {
    return { from: startsOn, to: endsOn ?? monthRange(addMonths(monthOf(reference), 12)).to };
}

/** As ocorrências da série: só as com o `recurrenceId` dela (INV-0017-03), em ordem de data. */
export function occurrencesOf<T extends { recurrenceId: string | null; occurredOn: IsoDate }>(
    items: readonly T[],
    recurrenceId: string,
): T[] {
    return items
        .filter((item) => item.recurrenceId === recurrenceId)
        .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
}

/** O padrão de **Último mês**: o fim do mês corrente, ou do mês de início numa série futura. */
export function defaultEndsOn({ startsOn }: Pick<SeriesDates, 'startsOn'>, reference = today()) {
    const base = startsOn > reference ? startsOn : reference;
    return monthRange(monthOf(base)).to;
}

/** **Último mês**: obrigatório e não anterior a `startsOn`. */
export function endRecurrenceSchema(startsOn: IsoDate) {
    return z.object({
        endsOn: dateSchema('Informe o último mês.').refine(
            (value) => value >= startsOn,
            ENDS_BEFORE_START_MESSAGE,
        ),
    });
}

export type EndRecurrenceValues = z.infer<ReturnType<typeof endRecurrenceSchema>>;
