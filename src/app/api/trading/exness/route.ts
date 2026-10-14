import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import WebSocket from 'ws';

export const dynamic = 'force-dynamic';

interface ExnessTick {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: number;
}

let latestTick: ExnessTick | null = null;
let lastTickTime = 0;
let isWsConnected = false;
let globalWs: WebSocket | null = null;
let wsInitAttempted = false;

function getExnessConfig() {
  const apiKey = process.env.EXN_API_KEY;
  const privateKey = process.env.EXN_PRIVATE_KEY;
  const accountId = process.env.EXN_ACCOUNT_ID;
  const baseUrl = process.env.EXN_API_BASE_URL;

  if (!apiKey || !privateKey || !accountId || !baseUrl) {
    return null;
  }

  return { apiKey, privateKey, accountId, baseUrl };
}

function generateSignature(params: {
  privateKey: string;
  method: string;
  path: string;
  timestamp: number;
  body?: string;
}): string {
  const { privateKey, method, path, timestamp, body = '' } = params;
  const payload = `${method}\n${path}\n${timestamp}\n${body}`;

  try {
    const signer = crypto.createSign('SHA256');
    signer.update(payload);
    signer.end();
    return signer.sign(privateKey, 'base64');
  } catch {
    // If privateKey is an HMAC secret instead of PEM
    return crypto.createHmac('sha256', privateKey).update(payload).digest('base64');
  }
}

async function verifyInstrumentsAndConditions(config: {
  apiKey: string;
  privateKey: string;
  accountId: string;
  baseUrl: string;
}): Promise<{ ok: boolean; conditions?: Record<string, unknown>; error?: string }> {
  const { apiKey, privateKey, accountId, baseUrl } = config;
  const timestamp = Date.now();
  const instrumentsPath = `/v1/configuration/accounts/${accountId}/instruments`;
  const sigInstruments = generateSignature({ privateKey, method: 'GET', path: instrumentsPath, timestamp });

  try {
    const instRes = await fetch(`${baseUrl}${instrumentsPath}`, {
      headers: {
        'EXN-API-KEY': apiKey,
        'EXN-TIMESTAMP': String(timestamp),
        'EXN-SIGNATURE': sigInstruments,
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!instRes.ok) {
      return { ok: false, error: `Instruments verification HTTP ${instRes.status}` };
    }

    const conditionsPath = `/v1/configuration/accounts/${accountId}/instruments/XAUUSD/conditions`;
    const sigCond = generateSignature({ privateKey, method: 'GET', path: conditionsPath, timestamp });

    const condRes = await fetch(`${baseUrl}${conditionsPath}`, {
      headers: {
        'EXN-API-KEY': apiKey,
        'EXN-TIMESTAMP': String(timestamp),
        'EXN-SIGNATURE': sigCond,
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!condRes.ok) {
      return { ok: false, error: `XAUUSD conditions check HTTP ${condRes.status}` };
    }

    const condData = (await condRes.json()) as Record<string, unknown>;
    return { ok: true, conditions: condData };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

function initExnessWebSocket(config: {
  apiKey: string;
  privateKey: string;
  accountId: string;
  baseUrl: string;
}) {
  if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const { apiKey, privateKey, accountId, baseUrl } = config;
  const wsPath = `/v1/server-events/accounts/${accountId}/ws/ticks`;
  const wsBase = baseUrl.replace(/^http/, 'ws');
  const wsUrl = `${wsBase}${wsPath}`;
  const timestamp = Date.now();
  const signature = generateSignature({ privateKey, method: 'GET', path: wsPath, timestamp });

  try {
    const ws = new WebSocket(wsUrl, {
      headers: {
        'EXN-API-KEY': apiKey,
        'EXN-TIMESTAMP': String(timestamp),
        'EXN-SIGNATURE': signature,
      },
    });

    globalWs = ws;

    ws.on('open', () => {
      isWsConnected = true;
      // Subscribe to XAUUSD
      const subscribeMsg = JSON.stringify({
        action: 'subscribe',
        instruments: ['XAUUSD'],
      });
      ws.send(subscribeMsg);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const text = data.toString('utf8');
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          const rec = parsed as Record<string, unknown>;
          if (rec.symbol === 'XAUUSD' && typeof rec.bid === 'number' && typeof rec.ask === 'number') {
            latestTick = {
              symbol: 'XAUUSD',
              bid: rec.bid,
              ask: rec.ask,
              timestamp: typeof rec.timestamp === 'number' ? rec.timestamp : Date.now(),
            };
            lastTickTime = Date.now();
          }
        }
      } catch {
        // Drop malformed tick
      }
    });

    ws.on('close', () => {
      isWsConnected = false;
      globalWs = null;
      // Reconnect with backoff
      setTimeout(() => {
        const cfg = getExnessConfig();
        if (cfg) initExnessWebSocket(cfg);
      }, 5000);
    });

    ws.on('error', () => {
      isWsConnected = false;
      try {
        ws.close();
      } catch {
        // ignore
      }
      globalWs = null;
    });
  } catch {
    isWsConnected = false;
    globalWs = null;
  }
}

export async function GET(request: NextRequest) {
  const config = getExnessConfig();

  if (!config) {
    return NextResponse.json({
      available: false,
      reason: 'Exness XAUUSD feed unavailable',
      status: 'unavailable',
      message: 'Server-only credentials (EXN_API_KEY, EXN_PRIVATE_KEY, EXN_ACCOUNT_ID, EXN_API_BASE_URL) are not set',
    });
  }

  // Check conditions if first run
  if (!wsInitAttempted) {
    wsInitAttempted = true;
    const check = await verifyInstrumentsAndConditions(config);
    if (!check.ok) {
      return NextResponse.json({
        available: false,
        reason: 'Exness XAUUSD feed unavailable',
        status: 'unavailable',
        message: check.error || 'Failed to verify XAUUSD conditions on Exness',
      });
    }
    initExnessWebSocket(config);
  }

  // Handle SSE streaming request
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/event-stream')) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let timer: NodeJS.Timeout | null = null;
        timer = setInterval(() => {
          const now = Date.now();
          const isStale = now - lastTickTime > 15000;

          if (!latestTick || isStale) {
            const stalePayload = JSON.stringify({
              available: true,
              status: isStale ? 'stale' : 'connecting',
              reason: isStale ? 'Feed stale (>15s without tick)' : 'Awaiting ticks',
              tick: latestTick,
              timestamp: now,
            });
            controller.enqueue(encoder.encode(`data: ${stalePayload}\n\n`));
          } else {
            const livePayload = JSON.stringify({
              available: true,
              status: 'live',
              tick: latestTick,
              timestamp: now,
            });
            controller.enqueue(encoder.encode(`data: ${livePayload}\n\n`));
          }
        }, 1000);

        request.signal.addEventListener('abort', () => {
          clearInterval(timer);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // Standard JSON polling response
  const now = Date.now();
  const isStale = now - lastTickTime > 15000;

  return NextResponse.json({
    available: true,
    connected: isWsConnected,
    status: isStale ? 'stale' : 'live',
    reason: isStale ? 'Feed stale (>15s without tick)' : undefined,
    symbol: 'XAUUSD',
    tick: latestTick,
    lastTickTime,
    conditions: {
      contractSize: 100,
      minVolume: 0.01,
      maxVolume: 100,
      volumeStep: 0.01,
      tickSize: 0.01,
      digits: 2,
    },
  });
}
