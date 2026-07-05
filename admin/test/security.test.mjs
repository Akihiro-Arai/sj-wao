import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidSlug, toScriptLiteral } from '../security.mjs';

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
