import { Pencil } from 'lucide-react';

import { Button } from '@/ui/components/ui/button';

import type { ArchivableKind } from './api';
import { ArchiveButton } from './archive-button';

export interface WriteActionsProps {
    kind: ArchivableKind;
    item: { id: string; archivedAt: string | null };
    /** Nome do item nos rótulos acessíveis ("Editar Conta corrente"). */
    label: string;
    onEdit: () => void;
}

/** **Editar** e **Arquivar** (ou **Desarquivar**): só renderizadas com `accounts.write` (INV-0011-01). */
export function WriteActions({ kind, item, label, onEdit }: WriteActionsProps) {
    return (
        <div className="flex flex-wrap gap-2 md:justify-end">
            <Button variant="outline" aria-label={`Editar ${label}`} onClick={onEdit}>
                <Pencil aria-hidden="true" />
                Editar
            </Button>
            <ArchiveButton kind={kind} item={item} label={label} />
        </div>
    );
}
