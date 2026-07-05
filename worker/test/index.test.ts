import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

const BASE = 'https://sj-wao-metrics.example.com';
const TOKEN = env.METRICS_TOKEN;

beforeEach(async () => {
	await env.METRICS.delete('latest');
});

function post(body: string, headers: Record<string, string> = {}) {
	return exports.default.fetch(`${BASE}/api/metrics`, {
		method: 'POST',
		body,
		headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...headers },
	});
}

describe('POST /api/metrics', () => {
	it('401s when the Authorization header is missing', async () => {
		const res = await exports.default.fetch(`${BASE}/api/metrics`, { method: 'POST', body: '{}' });
		expect(res.status).toBe(401);
	});

	it('401s when the token is wrong', async () => {
		const res = await post('{"room_temp_c":1}', { authorization: 'Bearer wrong' });
		expect(res.status).toBe(401);
	});

	it('400s on malformed JSON', async () => {
		const res = await post('{not json');
		expect(res.status).toBe(400);
	});

	it('400s when the top-level body is an array', async () => {
		const res = await post('[1,2,3]');
		expect(res.status).toBe(400);
	});

	it('400s when the top-level body is a string', async () => {
		const res = await post('"hello"');
		expect(res.status).toBe(400);
	});

	it('400s when only unknown keys are present', async () => {
		const res = await post('{"unknown_key":1}');
		expect(res.status).toBe(400);
	});

	it('keeps only known keys when unknown keys are mixed in', async () => {
		const res = await post('{"room_temp_c":26.5,"unknown_key":"x"}');
		expect(res.status).toBe(200);
		const json = await res.json<{ metrics: Record<string, number> }>();
		expect(json.metrics).toEqual({ room_temp_c: 26.5 });
	});

	it('drops non-number values for known keys', async () => {
		const res = await post('{"room_temp_c":"26.5","room_humidity_pct":55}');
		expect(res.status).toBe(200);
		const json = await res.json<{ metrics: Record<string, number> }>();
		expect(json.metrics).toEqual({ room_humidity_pct: 55 });
	});

	it('413s when the body exceeds 4KB', async () => {
		const big = JSON.stringify({ room_temp_c: 1, padding: 'x'.repeat(5000) });
		const res = await post(big);
		expect(res.status).toBe(413);
	});
});

describe('GET /api/metrics', () => {
	it('404s when no data has been posted yet', async () => {
		const res = await exports.default.fetch(`${BASE}/api/metrics`);
		expect(res.status).toBe(404);
	});

	it('returns what was posted, with Cache-Control', async () => {
		await post('{"room_temp_c":26.5,"room_humidity_pct":55}');
		const res = await exports.default.fetch(`${BASE}/api/metrics`);
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('public, max-age=300');
		const json = await res.json<{ metrics: Record<string, number>; updatedAt: string }>();
		expect(json.metrics).toEqual({ room_temp_c: 26.5, room_humidity_pct: 55 });
		expect(typeof json.updatedAt).toBe('string');
	});
});

describe('routing and CORS', () => {
	it('404s on an unknown path', async () => {
		const res = await exports.default.fetch(`${BASE}/api/unknown`);
		expect(res.status).toBe(404);
	});

	it('405s on DELETE with an Allow header', async () => {
		const res = await exports.default.fetch(`${BASE}/api/metrics`, { method: 'DELETE' });
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('GET, POST, OPTIONS');
	});

	it('responds to OPTIONS preflight with 204 and CORS headers', async () => {
		const res = await exports.default.fetch(`${BASE}/api/metrics`, {
			method: 'OPTIONS',
			headers: { origin: 'https://sj-wao.com' },
		});
		expect(res.status).toBe(204);
		expect(res.headers.get('access-control-allow-origin')).toBe('https://sj-wao.com');
		expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
		expect(res.headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type');
		expect(res.headers.get('vary')).toBe('Origin');
	});

	it('reflects Access-Control-Allow-Origin for an allowed origin', async () => {
		const res = await exports.default.fetch(`${BASE}/api/metrics`, {
			headers: { origin: 'https://sj-wao.com' },
		});
		expect(res.headers.get('access-control-allow-origin')).toBe('https://sj-wao.com');
		expect(res.headers.get('vary')).toBe('Origin');
	});

	it('does not set Access-Control-Allow-Origin for a disallowed origin', async () => {
		const res = await exports.default.fetch(`${BASE}/api/metrics`, {
			headers: { origin: 'https://evil.example.com' },
		});
		expect(res.headers.get('access-control-allow-origin')).toBeNull();
		expect(res.headers.get('vary')).toBe('Origin');
	});
});
