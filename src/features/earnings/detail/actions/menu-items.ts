import { Pencil, Trash2 } from 'lucide-react';

import type { RowMenuItem } from '@/ui/row-menu';

import { MENU_LABELS, type MenuAction } from './transitions';

/**
 * Os itens de `RowMenu` para as ações dadas, na ordem recebida: a mesma construção na lista e no
 * "Mais ações" do detalhe (INV-0014-05). **Excluir** leva o tom `negativo`.
 */
export function menuItems(
    actions: readonly MenuAction[],
    run: (action: MenuAction) => void,
    disabled = false,
): RowMenuItem[] {
    return actions.map((action) => ({
        label: MENU_LABELS[action],
        icon: action === 'editar' ? Pencil : action === 'excluir' ? Trash2 : undefined,
        tone: action === 'excluir' ? 'negativo' : undefined,
        disabled,
        onSelect: () => run(action),
    }));
}
