import { createFileRoute } from '@tanstack/react-router';

import { ProvisionalHome } from '@/app/provisional-home';

export const Route = createFileRoute('/')({
    component: ProvisionalHome,
});
