// Slugs become filenames under CONTENT_DIR. Restricting the charset to this
// pattern rules out path traversal (no `/`, `..`, or null bytes possible).
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidSlug(slug) {
	return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

// Safely embeds a value as a JS string literal inside an inline <script>
// block. JSON.stringify alone isn't enough: it doesn't escape "<", so a
// value containing "</script>" would close the tag early regardless of the
// surrounding JS string quoting, letting an attacker-controlled value (e.g.
// a query param) inject a new <script> tag.
export function toScriptLiteral(value) {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}
