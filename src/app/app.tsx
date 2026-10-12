import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';

import { createAppRouter } from './router';

/** Providers da aplicação: estado de servidor e roteador. */
export function App() {
    const [queryClient] = useState(() => new QueryClient());
    const [router] = useState(createAppRouter);
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );
}
