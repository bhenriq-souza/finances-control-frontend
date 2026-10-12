import { createFileRoute } from '@tanstack/react-router';

import { HomePage } from '@/features/identity';

export const Route = createFileRoute('/_app/')({
    component: HomePage,
});
