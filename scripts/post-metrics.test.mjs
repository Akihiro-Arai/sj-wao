import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { postMetrics } from './post-metrics.mjs';

const OPTS = { url: 'https://example.com/api/metrics', token: 'secret-token' };

describe('postMetrics', () => {
	it('resolves on a 2xx response', async () => {
		let capturedRequest;
		const fetchImpl = async (url, init) => {
			capturedRequest = { url, init };
			return { ok: true, status: 200 };
		};

		await postMetrics({ room_temp_c: 26.5 }, { ...OPTS, fetchImpl });

		assert.equal(capturedRequest.url, OPTS.url);
		assert.equal(capturedRequest.init.method, 'POST');
		assert.equal(capturedRequest.init.headers.Authorization, `Bearer ${OPTS.token}`);
		assert.equal(capturedRequest.init.headers['Content-Type'], 'application/json');
		assert.equal(capturedRequest.init.body, JSON.stringify({ room_temp_c: 26.5 }));
	});

	it('rejects with status and body on a non-2xx response', async () => {
		const fetchImpl = async () => ({
			ok: false,
			status: 500,
			text: async () => 'internal error',
		});

		await assert.rejects(
			() => postMetrics({ room_temp_c: 26.5 }, { ...OPTS, fetchImpl }),
			/unexpected status 500: internal error/
		);
	});

	it('rejects with a timeout message when the request times out', async () => {
		const fetchImpl = async () => {
			const err = new Error('The operation was aborted due to timeout');
			err.name = 'TimeoutError';
			throw err;
		};

		await assert.rejects(() => postMetrics({ room_temp_c: 26.5 }, { ...OPTS, fetchImpl }), /timed out after 30s/);
	});

	it('rejects with a generic message on network errors', async () => {
		const fetchImpl = async () => {
			throw new Error('getaddrinfo ENOTFOUND example.com');
		};

		await assert.rejects(() => postMetrics({ room_temp_c: 26.5 }, { ...OPTS, fetchImpl }), /request failed/);
	});
});
