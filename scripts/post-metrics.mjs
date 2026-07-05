#!/usr/bin/env node

/**
 * Collects home-server metrics and POSTs them to the sj-wao-metrics Worker.
 * Intended to run from cron once an hour. See scripts/README.md for setup.
 */

/**
 * Reads sensor values. Stubbed for now — real sensor wiring is environment
 * work for the repo owner, not something this script can implement here.
 *
 * Expected return shape: a flat object of metric name -> finite number, e.g.
 *   { room_temp_c: 26.5, room_humidity_pct: 55 }
 */
export function collectMetrics() {
	throw new Error('collectMetrics is not implemented yet');
}

/**
 * POSTs `metrics` to the Worker. Returns nothing on success; throws on any
 * failure (non-2xx response, network error, or timeout) with a message
 * describing what went wrong.
 */
export async function postMetrics(metrics, { url, token, fetchImpl = fetch }) {
	let response;
	try {
		response = await fetchImpl(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(metrics),
			signal: AbortSignal.timeout(30_000),
		});
	} catch (err) {
		if (err.name === 'TimeoutError' || err.name === 'AbortError') {
			throw new Error(`request timed out after 30s: ${err.message}`);
		}
		throw new Error(`request failed: ${err.message}`);
	}

	if (!response.ok) {
		const body = await response.text().catch(() => '<failed to read body>');
		throw new Error(`unexpected status ${response.status}: ${body}`);
	}
}

function parseDryRunArg(argv) {
	const flagIndex = argv.indexOf('--dry-run');
	if (flagIndex === -1) return null;
	const raw = argv[flagIndex + 1];
	if (!raw) {
		throw new Error('--dry-run requires a JSON argument, e.g. --dry-run \'{"room_temp_c":26.5}\'');
	}
	return JSON.parse(raw);
}

async function main() {
	const url = process.env.METRICS_URL;
	const token = process.env.METRICS_TOKEN;

	if (!url) {
		console.error('METRICS_URL is not set');
		process.exitCode = 1;
		return;
	}
	if (!token) {
		console.error('METRICS_TOKEN is not set');
		process.exitCode = 1;
		return;
	}

	let metrics;
	try {
		metrics = parseDryRunArg(process.argv.slice(2)) ?? collectMetrics();
	} catch (err) {
		console.error(`failed to collect metrics: ${err.message}`);
		process.exitCode = 1;
		return;
	}

	try {
		await postMetrics(metrics, { url, token });
	} catch (err) {
		console.error(`failed to post metrics: ${err.message}`);
		process.exitCode = 1;
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
