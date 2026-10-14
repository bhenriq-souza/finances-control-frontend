import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { canManageUsers, UsersPage } from '@/features/identity';
import { EmptyState } from '@/ui/empty-state';

/** Parâmetros de `/usuarios` (spec 0010); parâmetro inválido é descartado (spec 0009). */
const searchSchema = z.object({
    filtro: z.literal('aguardando').optional().catch(undefined),
    perfil: z.string().min(1).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/usuarios')({
    validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
    // Sem `users.manage`, o estado sem acesso, sem chamar a API (INV-0010-01).
    beforeLoad: ({ context }) => ({
        canManageUsers: canManageUsers(context.currentUser.profile),
    }),
    component: Users,
});

function Users() {
    const { canManageUsers: allowed } = Route.useRouteContext();
    const { filtro, perfil } = Route.useSearch();
    const navigate = Route.useNavigate();

    if (!allowed) {
        return (
            <div className="flex flex-col gap-4">
                <h1 className="text-titulo-1">Usuários</h1>
                <EmptyState variant="sem-acesso" />
            </div>
        );
    }
    return (
        <UsersPage
            filter={filtro === 'aguardando' ? 'aguardando' : 'todos'}
            profileUserId={perfil}
            onFilterChange={(filter) =>
                void navigate({
                    search: (prev) => ({
                        ...prev,
                        filtro: filter === 'aguardando' ? 'aguardando' : undefined,
                    }),
                    replace: true,
                })
            }
            onProfileUserChange={(userId) =>
                void navigate({ search: (prev) => ({ ...prev, perfil: userId }) })
            }
        />
    );
}
