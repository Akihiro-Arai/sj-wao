import { describe, expect, it } from 'vitest';
import { isStale, parseMetricsResponse } from './metrics';

describe('isStale', () => {
	const now = new Date('2026-07-05T12:00:00.000Z');

	it('is false exactly at the threshold', () => {
		const updatedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
		expect(isStale(updatedAt, now)).toBe(false);
	});

	it('is true one millisecond past the threshold', () => {
		const updatedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000 - 1).toISOString();
		expect(isStale(updatedAt, now)).toBe(true);
	});

	it('is false for recent timestamps', () => {
		const updatedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
		expect(isStale(updatedAt, now)).toBe(false);
	});

	it('treats an invalid date string as stale', () => {
		expect(isStale('not-a-date', now)).toBe(true);
	});

	it('respects a custom threshold', () => {
		const updatedAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
		expect(isStale(updatedAt, now, 5 * 60 * 1000)).toBe(true);
	});
});

describe('parseMetricsResponse', () => {
	it('accepts a well-formed response', () => {
		const input = { updatedAt: '2026-07-05T12:00:00.000Z', metrics: { room_temp_c: 26.5 } };
		expect(parseMetricsResponse(input)).toEqual(input);
	});

	it('rejects a non-object body', () => {
		expect(parseMetricsResponse('hello')).toBeNull();
		expect(parseMetricsResponse(null)).toBeNull();
		expect(parseMetricsResponse(42)).toBeNull();
	});

	it('rejects an array body', () => {
		expect(parseMetricsResponse([1, 2, 3])).toBeNull();
	});

	it('rejects a missing or invalid updatedAt', () => {
		expect(parseMetricsResponse({ metrics: {} })).toBeNull();
		expect(parseMetricsResponse({ updatedAt: 'not-a-date', metrics: {} })).toBeNull();
		expect(parseMetricsResponse({ updatedAt: 123, metrics: {} })).toBeNull();
	});

	it('rejects when metrics is an array', () => {
		expect(parseMetricsResponse({ updatedAt: '2026-07-05T12:00:00.000Z', metrics: [1, 2] })).toBeNull();
	});

	it('drops non-number values from metrics', () => {
		const input = {
			updatedAt: '2026-07-05T12:00:00.000Z',
			metrics: { room_temp_c: 26.5, bogus: 'x', nan_value: NaN },
		};
		expect(parseMetricsResponse(input)).toEqual({
			updatedAt: '2026-07-05T12:00:00.000Z',
			metrics: { room_temp_c: 26.5 },
		});
	});
});
