import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { csrfOriginCheck, isTrustedOrigin } from '../csrf.mjs';

const HOST = '100.64.1.2:4322';

describe('isTrustedOrigin', () => {
	it('trusts a matching Origin', () => {
		assert.equal(isTrustedOrigin({ host: HOST, origin: `http://${HOST}` }), true);
	});

	it('rejects a mismatched Origin', () => {
		assert.equal(isTrustedOrigin({ host: HOST, origin: 'https://evil.example' }), false);
	});

	it('falls back to Referer when Origin is absent', () => {
		assert.equal(isTrustedOrigin({ host: HOST, referer: `http://${HOST}/edit/hello` }), true);
	});

	it('rejects a mismatched Referer', () => {
		assert.equal(isTrustedOrigin({ host: HOST, referer: 'https://evil.example/steal' }), false);
	});

	it('rejects when both Origin and Referer are absent', () => {
		assert.equal(isTrustedOrigin({ host: HOST }), false);
	});

	it('rejects an unparseable Origin', () => {
		assert.equal(isTrustedOrigin({ host: HOST, origin: 'not-a-url' }), false);
	});

	it('prefers Origin over Referer when both are present', () => {
		assert.equal(
			isTrustedOrigin({ host: HOST, origin: `http://${HOST}`, referer: 'https://evil.example' }),
			true
		);
	});
});

describe('isTrustedOrigin with ALLOWED_HOSTS (DNS rebinding hardening)', () => {
	const REBIND_HOST = 'attacker.example';

	it('rejects a request whose Host is not in ALLOWED_HOSTS, even with a matching Origin', () => {
		process.env.ALLOWED_HOSTS = HOST;
		try {
			// Simulates DNS rebinding: attacker.example resolves to this server,
			// so Origin/Referer legitimately match Host, but Host itself is untrusted.
			assert.equal(
				isTrustedOrigin({ host: REBIND_HOST, origin: `http://${REBIND_HOST}` }),
				false
			);
		} finally {
			delete process.env.ALLOWED_HOSTS;
		}
	});

	it('allows a request whose Host is in ALLOWED_HOSTS', () => {
		process.env.ALLOWED_HOSTS = `other.example, ${HOST}`;
		try {
			assert.equal(isTrustedOrigin({ host: HOST, origin: `http://${HOST}` }), true);
		} finally {
			delete process.env.ALLOWED_HOSTS;
		}
	});

	it('is permissive (Host not checked) when ALLOWED_HOSTS is unset', () => {
		delete process.env.ALLOWED_HOSTS;
		assert.equal(isTrustedOrigin({ host: REBIND_HOST, origin: `http://${REBIND_HOST}` }), true);
	});

	it('403s a GET via the middleware when Host is not in ALLOWED_HOSTS', () => {
		process.env.ALLOWED_HOSTS = HOST;
		try {
			const { req, res, next, calledNext } = mockReqRes({ method: 'GET', host: REBIND_HOST });
			csrfOriginCheck(req, res, next);
			assert.equal(calledNext(), false);
			assert.equal(res.statusCode, 403);
		} finally {
			delete process.env.ALLOWED_HOSTS;
		}
	});

	it('allows a GET via the middleware when Host is in ALLOWED_HOSTS', () => {
		process.env.ALLOWED_HOSTS = HOST;
		try {
			const { req, res, next, calledNext } = mockReqRes({ method: 'GET', host: HOST });
			csrfOriginCheck(req, res, next);
			assert.equal(calledNext(), true);
		} finally {
			delete process.env.ALLOWED_HOSTS;
		}
	});
});

function mockReqRes({ method = 'POST', host = HOST, origin, referer } = {}) {
	const req = { method, headers: { host, origin, referer } };
	const res = {
		statusCode: null,
		body: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		send(body) {
			this.body = body;
			return this;
		},
	};
	let nextCalled = false;
	const next = () => {
		nextCalled = true;
	};
	return { req, res, next, calledNext: () => nextCalled };
}

describe('csrfOriginCheck middleware', () => {
	it('calls next() for GET requests regardless of Origin', () => {
		const { req, res, next, calledNext } = mockReqRes({ method: 'GET', origin: 'https://evil.example' });
		csrfOriginCheck(req, res, next);
		assert.equal(calledNext(), true);
		assert.equal(res.statusCode, null);
	});

	it('calls next() for a same-origin POST', () => {
		const { req, res, next, calledNext } = mockReqRes({ origin: `http://${HOST}` });
		csrfOriginCheck(req, res, next);
		assert.equal(calledNext(), true);
	});

	it('403s a cross-origin POST', () => {
		const { req, res, next, calledNext } = mockReqRes({ origin: 'https://evil.example' });
		csrfOriginCheck(req, res, next);
		assert.equal(calledNext(), false);
		assert.equal(res.statusCode, 403);
	});

	it('403s a POST with neither Origin nor Referer', () => {
		const { req, res, next, calledNext } = mockReqRes({});
		csrfOriginCheck(req, res, next);
		assert.equal(calledNext(), false);
		assert.equal(res.statusCode, 403);
	});

	it('403s a cross-origin PUT (future non-GET methods are covered too)', () => {
		const { req, res, next, calledNext } = mockReqRes({ method: 'PUT', origin: 'https://evil.example' });
		csrfOriginCheck(req, res, next);
		assert.equal(calledNext(), false);
		assert.equal(res.statusCode, 403);
	});

	it('403s a cross-origin OPTIONS (not exempted alongside GET)', () => {
		const { req, res, next, calledNext } = mockReqRes({ method: 'OPTIONS', origin: 'https://evil.example' });
		csrfOriginCheck(req, res, next);
		assert.equal(calledNext(), false);
		assert.equal(res.statusCode, 403);
	});
});
