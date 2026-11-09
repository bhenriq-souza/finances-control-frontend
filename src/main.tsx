// Primeiro: configura o zod antes de qualquer schema ser criado (spec 0022).
import './shared/zod-jitless';
import './index.css';

import { bootstrap } from './app/bootstrap';

bootstrap(document.getElementById('root')!);
