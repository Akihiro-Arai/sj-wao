export type MetricsResponse = {
	updatedAt: string;
	metrics: Record<string, number>;
};

/**
 * True if `updatedAtIso` is more than `thresholdMs` older than `now`, or if
 * it can't be parsed as a date at all (treated as stale — we have no
 * evidence the data is fresh).
 */
export function isStale(updatedAtIso: string, now: Date, thresholdMs = 2 * 60 * 60 * 1000): boolean {
	const updated = new Date(updatedAtIso);
	if (Number.isNaN(updated.getTime())) return true;
	return now.getTime() - updated.getTime() > thresholdMs;
}

/**
 * Validates the shape of a metrics API response. Returns null (rather than
 * throwing) on anything unexpected, so callers can fall back to an error
 * state instead of crashing or rendering "Invalid Date".
 */
export function parseMetricsResponse(data: unknown): MetricsResponse | null {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;

	const { updatedAt, metrics } = data as Record<string, unknown>;

	if (typeof updatedAt !== 'string' || Number.isNaN(new Date(updatedAt).getTime())) return null;
	if (typeof metrics !== 'object' || metrics === null || Array.isArray(metrics)) return null;

	const cleanMetrics: Record<string, number> = {};
	for (const [key, value] of Object.entries(metrics as Record<string, unknown>)) {
		if (typeof value === 'number' && Number.isFinite(value)) {
			cleanMetrics[key] = value;
		}
	}

	return { updatedAt, metrics: cleanMetrics };
}
