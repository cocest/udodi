/**
 * Tokenizer Test Suite
 * Tests edge cases and expected behavior for directive expression parsing.
 */

import {
	isQuote,
	isEscaped,
	isQuotedString,
	unquoteString,
	splitOutsideQuotes,
	splitBindingsBySpace,
	splitUnquoted,
	isPathToken,
	isPathPath,
	classifyToken,
	parseResolver,
} from "./tokenizer.js";

// Helper for test reporting
function test(description, fn) {
	try {
		fn();
		console.log(`✓ ${description}`);
	} catch (err) {
		console.error(`✗ ${description}`, err.message);
	}
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

// Test isQuotedString edge cases
test("isQuotedString: simple single quotes", () => {
	assert(isQuotedString("'hello'") === true);
	assert(isQuotedString("'hello") === false);
	assert(isQuotedString("hello'") === false);
});

test("isQuotedString: simple double quotes", () => {
	assert(isQuotedString('"hello"') === true);
	assert(isQuotedString('"hello') === false);
});

test("isQuotedString: mixed quote types", () => {
	assert(isQuotedString("'hello\"") === false);
	assert(isQuotedString('"hello\'') === false);
});

test("isQuotedString: escaped quotes inside", () => {
	assert(isQuotedString("'it\\'s'") === true);
	assert(isQuotedString("\"it\\\"s\"") === true);
});

test("isQuotedString: empty quotes", () => {
	assert(isQuotedString("''") === true);
	assert(isQuotedString('""') === true);
});

// Test unquoteString
test("unquoteString: basic unquoting", () => {
	assert(unquoteString("'hello'") === "hello");
	assert(unquoteString('"world"') === "world");
});

test("unquoteString: unescape quotes", () => {
	assert(unquoteString("'it\\'s'") === "it's");
	assert(unquoteString('"say \\"hello\\""') === 'say "hello"');
});

test("unquoteString: non-quoted strings pass through", () => {
	assert(unquoteString("hello") === "hello");
});

// Test splitOutsideQuotes
test("splitOutsideQuotes: split by spaces respecting quotes", () => {
	const result = splitOutsideQuotes("user.name 'hello world' count", (ch) => ch === " ");
	assert(result.length === 3);
	assert(result[0] === "user.name");
	assert(result[1] === "'hello world'");
	assert(result[2] === "count");
});

test("splitOutsideQuotes: throw on unclosed quote", () => {
	try {
		splitOutsideQuotes("'unclosed string", (ch) => ch === " ");
		assert(false, "Should have thrown");
	} catch (err) {
		assert(err.message.includes("Unclosed quoted string"));
	}
});

test("splitOutsideQuotes: colon separator with quoted args", () => {
	const result = splitOutsideQuotes("formatDate:createdAt:'MMM DD, YYYY'", (ch) => ch === ":");
	assert(result.length === 3);
	assert(result[0] === "formatDate");
	assert(result[1] === "createdAt");
	assert(result[2] === "'MMM DD, YYYY'");
});

// Test splitBindingsBySpace
test("splitBindingsBySpace: multiple space-separated bindings", () => {
	const result = splitBindingsBySpace("item:index todos");
	assert(result.length === 2);
	assert(result[0] === "item:index");
	assert(result[1] === "todos");
});

// Test isPathToken
test("isPathToken: valid identifiers", () => {
	assert(isPathToken("user") === true);
	assert(isPathToken("_private") === true);
	assert(isPathToken("$special") === true);
	assert(isPathToken("User123") === true);
});

test("isPathToken: invalid identifiers", () => {
	assert(isPathToken("123user") === false);
	assert(isPathToken("user-name") === false);
	assert(isPathToken("user.name") === false);
	assert(isPathToken("") === false);
});

// Test isPathPath (dot paths)
test("isPathPath: single and nested valid paths", () => {
	assert(isPathPath("user") === true);
	assert(isPathPath("user.name") === true);
	assert(isPathPath("user.profile.firstName") === true);
});

test("isPathPath: invalid paths", () => {
	assert(isPathPath("user.") === false);
	assert(isPathPath(".user") === false);
	assert(isPathPath("user..name") === false);
	assert(isPathPath("user-name") === false);
});

// Test classifyToken
test("classifyToken: quoted literals", () => {
	const result = classifyToken("'hello'");
	assert(result.type === "literal");
	assert(result.value === "hello");
});

test("classifyToken: paths", () => {
	const result = classifyToken("user.name");
	assert(result.type === "path");
	assert(result.value === "user.name");
});

test("classifyToken: invalid tokens", () => {
	assert(classifyToken("").type === "invalid");
	assert(classifyToken("123invalid").type === "invalid");
	assert(classifyToken("user-name").type === "invalid");
});

// Test parseResolver
test("parseResolver: basic resolver", () => {
	const result = parseResolver("formatDate:createdAt");
	assert(result !== null);
	assert(result.resolver === "formatDate");
	assert(result.args.length === 1);
	assert(result.args[0].value === "createdAt");
});

test("parseResolver: resolver with multiple args", () => {
	const result = parseResolver("currency:pricing.total:'USD'");
	assert(result !== null);
	assert(result.resolver === "currency");
	assert(result.args.length === 2);
	assert(result.args[0].value === "pricing.total");
	assert(result.args[1].value === "USD");
});

test("parseResolver: quoted resolver name (invalid)", () => {
	const result = parseResolver("'formatDate':arg");
	assert(result === null, "Quoted resolver name should be rejected");
});

test("parseResolver: no args (invalid)", () => {
	const result = parseResolver("formatDate");
	assert(result === null, "Resolver with no : separator should be null");
});

// Test edge case: special characters in quoted strings
test("special characters in quoted strings", () => {
	const tokens = splitOutsideQuotes("'hello:world|test@example'", (ch) => ch === "|");
	assert(tokens[0] === "'hello:world|test@example'");
});

test("nested quote types in string literals", () => {
	// Single quotes containing double quotes
	assert(isQuotedString("'say \"hello\"'") === true);
	assert(unquoteString("'say \"hello\"'") === 'say "hello"');

	// Double quotes containing single quotes
	assert(isQuotedString('"it\'s"') === true);
	assert(unquoteString('"it\'s"') === "it's");
});

console.log("\n✓ Tokenizer test suite complete");
