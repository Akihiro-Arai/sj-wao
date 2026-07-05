export interface Env {
	METRICS: KVNamespace;
	METRICS_TOKEN: string;
}

const ALLOWED_METRICS = ['room_temp_c', 'room_humidity_pct'] as const;
const ALLOWED_ORIGINS = new Set(['https://sj-wao.com', 'http://localhost:4321']);
const MAX_BODY_BYTES = 4 * 1024;
const KV_KEY = 'latest';

function corsHeaders(origin: string | null): Headers {
	const headers = new Headers();
	headers.set('Vary', 'Origin');
	if (origin && ALLOWED_ORIGINS.has(origin)) {
		headers.set('Access-Control-Allow-Origin', origin);
	}
	return headers;
}

function jsonResponse(body: unknown, status: number, origin: string | null, extraHeaders?: HeadersInit): Response {
	const headers = corsHeaders(origin);
	headers.set('content-type', 'application/json; charset=UTF-8');
	if (extraHeaders) {
		for (const [key, value] of new Headers(extraHeaders)) {
			headers.set(key, value);
		}
	}
	return new Response(JSON.stringify(body), { status, headers });
}

function preflightResponse(origin: string | null): Response {
	const headers = corsHeaders(origin);
	headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
	return new Response(null, { status: 204, headers });
}

function methodNotAllowed(origin: string | null): Response {
	return jsonResponse({ error: 'method not allowed' }, 405, origin, { Allow: 'GET, POST, OPTIONS' });
}

/**
 * Reads the body incrementally, bailing out as soon as more than `limit` bytes
 * have arrived, so an oversized or lying Content-Length can't force the whole
 * payload into memory before we reject it.
 */
async function readBodyWithLimit(request: Request, limit: number): Promise<string | null> {
	const contentLength = request.headers.get('content-length');
	if (contentLength && Number(contentLength) > limit) {
		return null;
	}

	const reader = request.body?.getReader();
	if (!reader) return '';

	const chunks: Uint8Array[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		if (received > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}

	const combined = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(combined);
}

async function handlePost(request: Request, env: Env, origin: string | null): Promise<Response> {
	const authHeader = request.headers.get('authorization') ?? '';
	const expected = `Bearer ${env.METRICS_TOKEN}`;
	if (!env.METRICS_TOKEN || authHeader !== expected) {
		return jsonResponse({ error: 'unauthorized' }, 401, origin);
	}

	const rawBody = await readBodyWithLimit(request, MAX_BODY_BYTES);
	if (rawBody === null) {
		return jsonResponse({ error: 'payload too large' }, 413, origin);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawBody);
	} catch {
		return jsonResponse({ error: 'invalid json' }, 400, origin);
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return jsonResponse({ error: 'body must be a JSON object' }, 400, origin);
	}

	const input = parsed as Record<string, unknown>;
	const metrics: Record<string, number> = {};
	for (const key of ALLOWED_METRICS) {
		const value = input[key];
		if (typeof value === 'number' && Number.isFinite(value)) {
			metrics[key] = value;
		}
	}

	if (Object.keys(metrics).length === 0) {
		return jsonResponse({ error: 'no known metrics in body' }, 400, origin);
	}

	const record = { updatedAt: new Date().toISOString(), metrics };
	await env.METRICS.put(KV_KEY, JSON.stringify(record));

	return jsonResponse(record, 200, origin);
}

async function handleGet(env: Env, origin: string | null): Promise<Response> {
	const stored = await env.METRICS.get(KV_KEY);
	if (stored === null) {
		return jsonResponse({ error: 'no data' }, 404, origin);
	}
	return jsonResponse(JSON.parse(stored), 200, origin, { 'Cache-Control': 'public, max-age=300' });
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('origin');

		if (url.pathname !== '/api/metrics') {
			return jsonResponse({ error: 'not found' }, 404, origin);
		}

		switch (request.method) {
			case 'OPTIONS':
				return preflightResponse(origin);
			case 'POST':
				return handlePost(request, env, origin);
			case 'GET':
				return handleGet(env, origin);
			default:
				return methodNotAllowed(origin);
		}
	},
} satisfies ExportedHandler<Env>;
