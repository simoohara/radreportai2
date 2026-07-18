import { handle } from 'hono/cloudflare-pages';
// @ts-ignore
import app from '../../worker/index';

export const onRequest = handle(app);
