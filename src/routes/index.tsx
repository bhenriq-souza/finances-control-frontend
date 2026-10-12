import { createFileRoute } from '@tanstack/react-router';

import { SpikePage } from '@/features/identity';

export const Route = createFileRoute('/')({
    component: SpikePage,
});
