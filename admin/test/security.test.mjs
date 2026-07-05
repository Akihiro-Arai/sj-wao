import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidDateString, isValidSlug, toScriptLiteral } from '../security.mjs';

describe('isValidSlug', () => {
	it('accepts a plain slug', () => {
		assert.equal(isValidSlug('hello-world'), true);
	});

	it('accepts a generated timestamp slug', () => {
		assert.equal(isValidSlug('post-202607060255'), true);
	});

	it('rejects path traversal attempts', () => {
		assert.equal(isValidSlug('../../etc/passwd'), false);
		assert.equal(isValidSlug('..'), false);
		assert.equal(isValidSlug('foo/bar'), false);
	});

	it('rejects a leading hyphen or dot', () => {
		assert.equal(isValidSlug('-leading-hyphen'), false);
		assert.equal(isValidSlug('.hidden'), false);
	});

	it('rejects an empty string', () => {
		assert.equal(isValidSlug(''), false);
	});

	it('rejects non-string input', () => {
		assert.equal(isValidSlug(undefined), false);
		assert.equal(isValidSlug(null), false);
	});

	it('rejects uppercase and special characters', () => {
		assert.equal(isValidSlug('Hello'), false);
		assert.equal(isValidSlug('hello world'), false);
		assert.equal(isValidSlug('hello.md'), false);
	});
});

describe('toScriptLiteral', () => {
	it('produces a value usable as a JS string literal', () => {
		// eslint-disable-next-line no-new-func
		const evaluated = new Function(`return ${toScriptLiteral('hello "world"')};`)();
		assert.equal(evaluated, 'hello "world"');
	});

	it('neutralizes </script> so it cannot close the surrounding tag', () => {
		const literal = toScriptLiteral('</script><script>alert(1)</script>');
		assert.equal(literal.includes('</script>'), false);
		// eslint-disable-next-line no-new-func
		const evaluated = new Function(`return ${literal};`)();
		assert.equal(evaluated, '</script><script>alert(1)</script>');
	});

	it('round-trips a plain string with no special characters', () => {
		// eslint-disable-next-line no-new-func
		const evaluated = new Function(`return ${toScriptLiteral('/edit/hello')};`)();
		assert.equal(evaluated, '/edit/hello');
	});
});

describe('isValidDateString', () => {
	it('accepts a real calendar date', () => {
		assert.equal(isValidDateString('2026-07-06'), true);
	});

	it('accepts a leap day', () => {
		assert.equal(isValidDateString('2024-02-29'), true);
	});

	it('rejects Feb 30 (silently rolls over to Mar 2 in plain Date parsing)', () => {
		assert.equal(isValidDateString('2025-02-30'), false);
	});

	it('rejects Feb 29 on a non-leap year', () => {
		assert.equal(isValidDateString('2025-02-29'), false);
	});

	it('rejects month 13', () => {
		assert.equal(isValidDateString('2025-13-01'), false);
	});

	it('rejects a non-padded format', () => {
		assert.equal(isValidDateString('2025-2-3'), false);
	});

	it('rejects a non-date string', () => {
		assert.equal(isValidDateString('not-a-date'), false);
	});

	it('rejects non-string input', () => {
		assert.equal(isValidDateString(undefined), false);
		assert.equal(isValidDateString(null), false);
	});
});
