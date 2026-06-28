import { authHandlers } from './auth';
import { planHandlers } from './plans';
import { taskHandlers } from './tasks';

export const handlers = [...authHandlers, ...planHandlers, ...taskHandlers];
