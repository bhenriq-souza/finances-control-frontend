import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Users } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { can, useCan } from '@/api/permissions';
import { PROFILE_LABELS, useCurrentUser, type Profile } from '@/api/queries/current-user';
import { BUSINESS_TIME_ZONE, formatDate, type IsoDate } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { EntryListSkeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES, type Badge } from '@/ui/status-labels';

import { ProfileDialog } from './profile-dialog';
import { sortUsers, usersListQuery, type PlatformUser } from './users-api';

/** Filtro da lista, na URL como `?filtro=aguardando` (spec 0010). */
export type UsersFilter = 'todos' | 'aguardando';

const EMAIL_NOT_VERIFIED: Badge = { label: 'Email não verificado', family: 'atencao' };

// `en-CA` só pela forma `YYYY-MM-DD`; o dia é o do fuso de negócio.
const businessDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** O dia de negócio de um instante da API (`date-time`). */
function businessDateOf(instant: string): IsoDate {
    return businessDay.format(new Date(instant));
}

/** O `beforeLoad` de `/usuarios` confere a permissão (spec 0010). */
export function canManageUsers(profile: Profile | null): boolean {
    return can(profile, 'users.manage');
}

export interface UsersPageProps {
    filter: UsersFilter;
    /** `?perfil=<userId>`: o diálogo de perfil daquele usuário. */
    profileUserId?: string;
    onFilterChange: (filter: UsersFilter) => void;
    onProfileUserChange: (userId: string | undefined) => void;
}

/**
 * `/usuarios` (spec 0010). Sem `users.manage`, o estado sem acesso e nenhuma chamada a
 * `GET /users` (INV-0010-01); a permissão é lida do usuário atual a cada render, então um perfil
 * trocado durante a sessão (ERR-0010-04) redesenha a tela.
 */
export function UsersPage(props: UsersPageProps) {
    const allowed = useCan('users.manage');
    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-titulo-1">Usuários</h1>
            {allowed ? <UsersAdmin {...props} /> : <EmptyState variant="sem-acesso" />}
        </div>
    );
}

function UsersAdmin({
    filter,
    profileUserId,
    onFilterChange,
    onProfileUserChange,
}: UsersPageProps) {
    const me = useCurrentUser();
    const { data, error, refetch } = useQuery(usersListQuery);
    // Usuário que a API disse não existir (ERR-0010-03): o diálogo continua aberto com o alerta,
    // mesmo que a lista recarregada já não o traga.
    const [missing, setMissing] = useState<PlatformUser | null>(null);

    if (error) {
        return (
            <EmptyState
                variant="erro"
                error={
                    error instanceof ApiError
                        ? error
                        : { userMessage: CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE }
                }
                onRetry={() => void refetch()}
            />
        );
    }
    if (!data) return <EntryListSkeleton />;

    const sorted = sortUsers(data);
    const pending = sorted.filter((user) => user.profile === null);
    const items = filter === 'aguardando' ? pending : sorted;
    // A própria linha não abre diálogo (INV-0010-02).
    const selected =
        data.find((user) => user.id === profileUserId && user.id !== me.id) ??
        (missing?.id === profileUserId ? missing : undefined);

    const isMe = (user: PlatformUser) => user.id === me.id;

    function action(user: PlatformUser, className?: string) {
        if (isMe(user)) return null;
        const label = user.profile ? 'Alterar perfil' : 'Liberar acesso';
        return (
            <Button
                variant="outline"
                className={className}
                aria-label={`${label} de ${user.name}`}
                onClick={() => onProfileUserChange(user.id)}
            >
                {label}
            </Button>
        );
    }

    const profileCell = (user: PlatformUser) =>
        user.profile ? (
            PROFILE_LABELS[user.profile]
        ) : (
            <StatusBadge badge={DERIVED_BADGES.aguardando} />
        );

    const nameCell = (user: PlatformUser) => (
        <span className="flex flex-col">
            <span className="text-corpo-forte">{user.name}</span>
            {isMe(user) && <span className="text-corpo text-texto-apoio">Você</span>}
        </span>
    );

    const emailCell = (user: PlatformUser) => (
        <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            {!user.emailVerified && <StatusBadge badge={EMAIL_NOT_VERIFIED} />}
        </span>
    );

    const columns: EntryColumn<PlatformUser>[] = [
        { header: 'Nome', cell: nameCell },
        { header: 'Email', cell: emailCell },
        { header: 'Perfil', cell: profileCell },
        {
            header: 'Desde',
            cell: (user) => formatDate(businessDateOf(user.createdAt), 'curta'),
            hideBelow: 'lg',
        },
        { header: 'Ações', cell: (user) => action(user), align: 'end' },
    ];

    const segments: { value: UsersFilter; label: string }[] = [
        { value: 'todos', label: 'Todos' },
        { value: 'aguardando', label: `Aguardando aprovação (${pending.length})` },
    ];

    return (
        <>
            <div
                role="group"
                aria-label="Filtro"
                className="flex w-full gap-1 rounded-md border border-linha bg-superficie p-1 md:w-auto md:self-start"
            >
                {segments.map((segment) => (
                    <button
                        key={segment.value}
                        type="button"
                        aria-pressed={filter === segment.value}
                        onClick={() => onFilterChange(segment.value)}
                        className={clsx(
                            'min-h-11 flex-1 rounded-sm px-3 text-corpo-forte whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-foco md:flex-none',
                            filter === segment.value
                                ? 'bg-superficie-elevada text-texto'
                                : 'text-texto-apoio hover:text-texto',
                        )}
                    >
                        {segment.label}
                    </button>
                ))}
            </div>
            <EntryList
                items={items}
                getKey={(user) => user.id}
                caption="Usuários da plataforma"
                columns={columns}
                renderCard={(user) => (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                            {nameCell(user)}
                            <span className="text-corpo">{profileCell(user)}</span>
                        </div>
                        <div className="text-corpo text-texto-apoio">{emailCell(user)}</div>
                        {action(user, 'w-full')}
                    </div>
                )}
                empty={
                    <EmptyState
                        variant="vazio"
                        icon={Users}
                        title={
                            filter === 'aguardando'
                                ? 'Ninguém aguardando aprovação.'
                                : 'Nenhum usuário.'
                        }
                    />
                }
            />
            {selected && (
                <ProfileDialog
                    key={selected.id}
                    user={selected}
                    onClose={() => onProfileUserChange(undefined)}
                    onStale={() => {
                        setMissing(selected);
                        void refetch();
                    }}
                />
            )}
        </>
    );
}
