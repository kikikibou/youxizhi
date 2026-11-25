/**
 * 《大国小国》房间服务器的入口（线上地址 api.yxzzxy.com）。
 *
 *   POST /rooms              建房，body: { password?: string } → { code }
 *   GET  /rooms/<房间号>      房间在不在、要不要密码 → { exists, hasPassword, inGame, members }
 *   GET  /rooms/<房间号>/ws   WebSocket，消息格式见 game/shared/protocol.ts
 */

import { ROOM_CODE } from '../../shared/protocol.ts';

export { Room } from './room.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
}

function randomCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (path === '/') return new Response('dgxg ok', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

    if (path === '/rooms' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { password?: unknown };
      const password = typeof body.password === 'string' ? body.password : null;
      // 随机挑一个空着的房间号；被占用就换一个。
      for (let i = 0; i < 30; i++) {
        const code = randomCode();
        if (await env.ROOMS.getByName(code).create(code, password)) return json({ code });
      }
      return json({ error: '暂时没有空房间号，请稍后再试' }, 503);
    }

    const m = path.match(/^\/rooms\/([^/]+)(\/ws)?$/);
    if (m) {
      const [, code, ws] = m;
      if (!ROOM_CODE.test(code)) return json({ error: '房间号是 4 位数字' }, 400);
      const stub = env.ROOMS.getByName(code);
      if (ws) {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket', { status: 426 });
        return stub.fetch(request);
      }
      if (request.method === 'GET') return json(await stub.info());
    }

    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
