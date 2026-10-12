import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// O jsdom não implementa a rolagem que o roteador restaura a cada navegação.
window.scrollTo = () => {};

afterEach(() => {
    cleanup();
});
