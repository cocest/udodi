/**
 * Tokenizer Test Suite
 * Tests edge cases and expected behavior for directive expression parsing.
 */

import { describe, it, expect } from "vitest";
import {
	isQuote,
	isEscaped,
	isQuotedString,
	unquoteString,
	splitUnquoted,
	splitBindingsBySpace,
	splitFirstUnquoted,
	isPathToken,
	isPathPath,
	classifyToken,
	tokenFrom,
	parseResolver,
	scanQuoted,
	SCAN_DELIMITER,
	SCAN_WHITESPACE,
} from "../../packages/utils/tokenizer.js";

describe("Tokenizer", () => {
	describe("isQuote", () => {
		it("identifies quote characters", () => {
			expect(isQuote("'")).toBe(true);
			expect(isQuote('"')).toBe(true);
			expect(isQuote("a")).toBe(false);
			expect(isQuote(" ")).toBe(false);
		});
	});

	describe("isQuotedString", () => {
		it("simple single quotes", () => {
			expect(isQuotedString("'hello'")).toBe(true);
			expect(isQuotedString("'hello")).toBe(false);
			expect(isQuotedString("hello'")).toBe(false);
		});

		it("simple double quotes", () => {
			expect(isQuotedString('"hello"')).toBe(true);
			expect(isQuotedString('"hello')).toBe(false);
		});

		it("mixed quote types", () => {
			expect(isQuotedString("'hello\"")).toBe(false);
			expect(isQuotedString("\"hello'")).toBe(false);
		});

		it("escaped quotes inside", () => {
			expect(isQuotedString("'it\\'s'")).toBe(true);
			expect(isQuotedString('"it\\"s"')).toBe(true);
		});

		it("empty quotes", () => {
			expect(isQuotedString("''")).toBe(true);
			expect(isQuotedString('""')).toBe(true);
		});
	});

	describe("unquoteString", () => {
		it("basic unquoting", () => {
			expect(unquoteString("'hello'")).toBe("hello");
			expect(unquoteString('"world"')).toBe("world");
		});

		it("unescape quotes", () => {
			expect(unquoteString("'it\\'s'")).toBe("it's");
			expect(unquoteString('"say \\"hello\\""')).toBe('say "hello"');
		});
	});

	describe("scanQuoted", () => {
		it("delimiter mode - splits on delimiter outside quotes", () => {
			const tokens = [];
			scanQuoted("a,b,'c,d',e", (s, e) => tokens.push("a,b,'c,d',e".slice(s, e)), SCAN_DELIMITER, ",");
			expect(tokens).toEqual(["a", "b", "'c,d'", "e"]);
		});

		it("whitespace mode - splits on whitespace outside quotes", () => {
			const tokens = [];
			scanQuoted("foo bar 'hello world'  baz", (s, e) => tokens.push("foo bar 'hello world'  baz".slice(s, e)), SCAN_WHITESPACE);
			expect(tokens).toEqual(["foo", "bar", "'hello world'", "baz"]);
		});

		it("throws on unclosed quote", () => {
			expect(() => {
				const tokens = [];
				scanQuoted("'unclosed string", (s, e) => tokens.push(""), SCAN_DELIMITER, ",");
			}).toThrow(/Unclosed quoted string/);
		});
	});

	describe("splitUnquoted", () => {
		it("splits on separator while ignoring content inside quotes", () => {
			expect(splitUnquoted("a,b,'c,d',e", ",")).toEqual([
				"a",
				"b",
				"'c,d'",
				"e",
			]);
			expect(splitUnquoted("name:'John Doe',age:30", ",")).toEqual([
				"name:'John Doe'",
				"age:30",
			]);
		});

		it("works with colon separator", () => {
			expect(splitUnquoted("formatDate:createdAt:'MMM DD, YYYY'", ":")).toEqual([
				"formatDate",
				"createdAt",
				"'MMM DD, YYYY'",
			]);
		});

		it("returns original string when no separator found", () => {
			expect(splitUnquoted("singleToken", ",")).toEqual(["singleToken"]);
		});

		it("handles empty string", () => {
			expect(splitUnquoted("", ",")).toEqual([]);
		});

		it("preserves empty tokens", () => {
			expect(splitUnquoted("a,,b", ",")).toEqual(["a", "", "b"]);
		});
	});

	describe("Edge Cases", () => {
		it("special characters in quoted strings", () => {
			expect(splitUnquoted("'hello:world|test@example'", "|")).toEqual([
				"'hello:world|test@example'"
			]);
		});

		it("nested quote types in string literals", () => {
			expect(isQuotedString("'say \"hello\"'")).toBe(true);
			expect(unquoteString("'say \"hello\"'")).toBe('say "hello"');

			expect(isQuotedString('"it\'s"')).toBe(true);
			expect(unquoteString('"it\'s"')).toBe("it's");
		});

		it("empty tokens and trailing delimiter", () => {
			expect(splitUnquoted("a,b,", ",")).toEqual(["a", "b", ""]);
		});
	});
});
