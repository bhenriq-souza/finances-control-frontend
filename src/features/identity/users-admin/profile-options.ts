import type { Profile } from '@/api/queries/current-user';

/** Os três perfis, com a descrição de uma linha de `docs/user-profiles.md` do hub (spec 0010). */
export const PROFILE_OPTIONS: readonly { value: Profile; description: string }[] = [
    { value: 'ADMIN', description: 'Tudo, inclusive usuários, bancos, contas e cartões' },
    { value: 'BILLER', description: 'Lança e altera despesas, receitas, faturas e transferências' },
    { value: 'VIEWER', description: 'Só consulta' },
];
