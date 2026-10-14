import type { Earning, EarningStatus } from '../../list/earning-model';

/** Uma ação de status do detalhe (spec 0014, "Detalhe e ações"). */
export type EarningAction = 'confirmar' | 'receber' | 'verificar' | 'voltar' | 'desfazer';

/** O status que cada ação pede em `PATCH /earnings/{id}/status`. */
export const ACTION_TARGET: Readonly<Record<EarningAction, EarningStatus>> = {
    confirmar: 'OPEN',
    receber: 'RECEIVED',
    verificar: 'VERIFYING',
    voltar: 'OPEN',
    desfazer: 'OPEN',
};

export const ACTION_LABELS: Readonly<Record<EarningAction, string>> = {
    confirmar: 'Confirmar',
    receber: 'Receber',
    verificar: 'Marcar para verificar',
    voltar: 'Voltar para pendente',
    desfazer: 'Desfazer recebimento',
};

/** Aviso de sucesso de cada ação. */
export const ACTION_NOTICES: Readonly<Record<EarningAction, string>> = {
    confirmar: 'Receita confirmada.',
    receber: 'Receita recebida.',
    verificar: 'Receita marcada para verificar.',
    voltar: 'Receita voltou para pendente.',
    desfazer: 'Recebimento desfeito.',
};

const TRANSITIONS: Readonly<Record<EarningStatus, readonly EarningAction[]>> = {
    FORECAST: ['confirmar'],
    OPEN: ['receber', 'verificar'],
    OVERDUE: ['receber', 'verificar'],
    VERIFYING: ['receber', 'voltar'],
    RECEIVED: ['desfazer'],
};

/** As ações de status oferecidas num status: exatamente as da tabela de transições (INV-0014-02). */
export function statusActions(status: EarningStatus): readonly EarningAction[] {
    return TRANSITIONS[status];
}

/** Só a receita não recebida pode ser excluída. */
export function canDelete(earning: Pick<Earning, 'status'>): boolean {
    return earning.status !== 'RECEIVED';
}

/**
 * O efeito da exclusão, mostrado antes de enviar (INV-0014-03): avulsa, parcela (as não recebidas
 * do parcelamento) ou ocorrência de série (esta e as seguintes, e a série termina).
 */
export function deleteCascade(earning: Pick<Earning, 'installment' | 'recurrenceId'>): string {
    if (earning.installment) {
        return 'Todas as parcelas não recebidas deste parcelamento serão excluídas.';
    }
    if (earning.recurrenceId) {
        return 'Esta ocorrência e as seguintes ainda não recebidas serão excluídas, e a série termina.';
    }
    return 'A receita será excluída.';
}

/** Uma ação do menu da linha e do "Mais ações" do celular: as de status, **Editar** e **Excluir**. */
export type MenuAction = EarningAction | 'editar' | 'excluir';

export const MENU_LABELS: Readonly<Record<MenuAction, string>> = {
    ...ACTION_LABELS,
    editar: 'Editar',
    excluir: 'Excluir',
};

/**
 * As ações do menu da linha para um status (INV-0014-05): as transições da tabela, **Editar** e,
 * se não recebida, **Excluir**. O detalhe oferece as mesmas.
 */
export function menuActions(earning: Pick<Earning, 'status'>): readonly MenuAction[] {
    return [
        ...statusActions(earning.status),
        'editar',
        ...(canDelete(earning) ? (['excluir'] as const) : []),
    ];
}
