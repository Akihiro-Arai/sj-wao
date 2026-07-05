/**
 * CSRF defense-in-depth for admin/server.mjs. The IP allowlist proves the
 * request came from a trusted network, but not that it came from our own
 * form — a malicious page loaded on a trusted device could still POST here.
 * Require Origin (or, failing that, Referer) to match the request's own Host.
 *
 * Comparing against the request's own Host header doesn't defend against DNS
 * rebinding (an attacker-controlled domain that resolves to this server would
 * have Origin === Host too). Set ALLOWED_HOSTS (comma-separated) to also
 * require Host itself to be a known value, closing that gap. This Host check
 * applies to every request, including GET, since DNS rebinding is about read
 * access too, not just state-changing requests.
 */

function getAllowedHosts() {
	return (process.env.ALLOWED_HOSTS ?? '')
		.split(',')
		.map((h) => h.trim())
		.filter(Boolean);
}

function isTrustedHost(host) {
	const allowedHosts = getAllowedHosts();
	return allowedHosts.length === 0 || allowedHosts.includes(host);
}

function extractHost(value) {
	try {
		return new URL(value).host;
	} catch {
		return null;
	}
}

export function isTrustedOrigin({ host, origin, referer }) {
	if (!isTrustedHost(host)) return false;

	const sourceHost = origin ? extractHost(origin) : referer ? extractHost(referer) : null;
	return sourceHost !== null && sourceHost === host;
}

export function csrfOriginCheck(req, res, next) {
	const host = req.headers.host;

	if (!isTrustedHost(host)) {
		console.warn(`CSRF check failed: host=${host} is not in ALLOWED_HOSTS`);
		res.status(403).send('不正なリクエスト元です。');
		return;
	}

	if (req.method === 'GET') {
		next();
		return;
	}

	const origin = req.headers.origin;
	const referer = req.headers.referer;

	if (!isTrustedOrigin({ host, origin, referer })) {
		console.warn(`CSRF check failed: host=${host} origin=${origin ?? '(none)'} referer=${referer ?? '(none)'}`);
		res.status(403).send('不正なリクエスト元です。');
		return;
	}

	next();
}
