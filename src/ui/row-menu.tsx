import * as Menu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

import { Button } from './components/ui/button';

export interface RowMenuItem {
    label: string;
    icon?: LucideIcon;
    onSelect: () => void;
    /** Ação destrutiva (Excluir), separada das demais por uma linha. */
    tone?: 'negativo';
    disabled?: boolean;
}

export interface RowMenuProps {
    /** Rótulo acessível do gatilho, ex.: "Ações de Aluguel". */
    label: string;
    /** `icone` (padrão): botão `ghost` 44×44; `texto`: botão `outline` "Mais ações" na largura toda. */
    trigger?: 'icone' | 'texto';
    items: readonly RowMenuItem[];
}

const ITEM_CLASS =
    'flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-corpo outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-superficie [&_svg]:size-4 [&_svg]:shrink-0';

/**
 * Menu da linha (spec 0009), o padrão DropdownMenu do shadcn/ui sobre
 * `@radix-ui/react-dropdown-menu`: `role="menu"`, setas, `Home`/`End`, letra inicial, `Esc` com
 * retorno do foco ao gatilho. O painel fica acima do cabeçalho (z-30) e abaixo dos diálogos
 * (z-40/z-50). Sem itens, não renderiza nada.
 */
export function RowMenu({ label, trigger = 'icone', items }: RowMenuProps) {
    if (items.length === 0) return null;

    const regular = items.filter((item) => item.tone !== 'negativo');
    const destructive = items.filter((item) => item.tone === 'negativo');

    return (
        <Menu.Root>
            <Menu.Trigger asChild>
                {trigger === 'texto' ? (
                    <Button variant="outline" className="w-full">
                        Mais ações
                    </Button>
                ) : (
                    <Button variant="ghost" aria-label={label} className="size-11 px-0">
                        <MoreHorizontal aria-hidden="true" strokeWidth={1.75} />
                    </Button>
                )}
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Content
                    align="end"
                    sideOffset={4}
                    aria-label={label}
                    className="z-35 min-w-48 rounded-lg border border-linha bg-superficie-elevada p-1 text-texto shadow-[var(--ft-sombra-flutuante)]"
                >
                    {regular.map((item) => (
                        <RowMenuEntry key={item.label} item={item} />
                    ))}
                    {destructive.length > 0 && regular.length > 0 && (
                        <Menu.Separator className="my-1 h-px bg-linha" />
                    )}
                    {destructive.map((item) => (
                        <RowMenuEntry key={item.label} item={item} />
                    ))}
                </Menu.Content>
            </Menu.Portal>
        </Menu.Root>
    );
}

function RowMenuEntry({ item }: { item: RowMenuItem }) {
    const Icon = item.icon;
    return (
        <Menu.Item
            disabled={item.disabled}
            onSelect={item.onSelect}
            className={clsx(ITEM_CLASS, item.tone === 'negativo' && 'text-negativo')}
        >
            {Icon && <Icon aria-hidden="true" strokeWidth={1.75} />}
            {item.label}
        </Menu.Item>
    );
}
