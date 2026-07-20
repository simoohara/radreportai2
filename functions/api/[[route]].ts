import { handle } from 'hono/cloudflare-pages';
// @ts-ignore
import { honoApp } from '../../worker/index';

export const onRequest = handle(honoApp);
