// Slugs become filenames under CONTENT_DIR. Restricting the charset to this
// pattern rules out path traversal (no `/`, `..`, or null bytes possible).
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidSlug(slug) {
	return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

// `new Date('2025-02-30')` doesn't return Invalid Date — it silently rolls
// over to March 2. Round-tripping back through toISOString() and comparing
// to the original string catches that (a real Feb 30 would never round-trip).
export function isValidDateString(value) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return false;
	return d.toISOString().slice(0, 10) === value;
}

// Safely embeds a value as a JS string literal inside an inline <script>
// block. JSON.stringify alone isn't enough: it doesn't escape "<", so a
// value containing "</script>" would close the tag early regardless of the
// surrounding JS string quoting, letting an attacker-controlled value (e.g.
// a query param) inject a new <script> tag.
export function toScriptLiteral(value) {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}
