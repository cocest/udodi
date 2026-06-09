/**
 * Tokenizer Module - Consolidated directive expression parsing.
 * Handles quoted strings, dot-paths, and resolver syntax.
 */

const PATH_TOKEN_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const WHITESPACE_REGEX = /\s/;

/**
 * Checks if a character is a quote.
 * @param {string} ch - Single character to test.
 * @returns {boolean} True if ch is ' or "
 */
export function isQuote(ch) {
	return ch === "'" || ch === '"';
}

/**
 * Counts consecutive backslashes before an index
 * to determine if a character is escaped.
 *
 * @param {string} str - String to inspect.
 * @param {number} index - Position to check.
 * @returns {boolean} True if escaped.
 */
export function isEscaped(str, index) {
	let slashCount = 0;

	for (let i = index - 1; i >= 0 && str[i] === "\\"; i--) {
		slashCount++;
	}

	return (slashCount & 1) === 1;
}

/**
 * Splits a string outside quoted regions.
 *
 * Supports:
 * - delimiter splitting
 * - whitespace splitting
 *
 * Throws if quotes are unclosed.
 *
 * @param {string} str - String to split.
 * @param {string|null} delimiter - Delimiter character.
 * @param {boolean} whitespace - Whether to split by whitespace.
 * @returns {string[]} Array of trimmed tokens.
 */
export function splitOutsideQuotes(str, delimiter = null, whitespace = false) {
	if (!str) return [];

	const tokens = [];

	let start = 0;
	let quoteChar = null;

	for (let i = 0; i < str.length; i++) {
		const ch = str[i];

		if (isQuote(ch)) {
			if (!quoteChar) {
				quoteChar = ch;
			} else if (quoteChar === ch && !isEscaped(str, i)) {
				quoteChar = null;
			}

			continue;
		}

		const isSeparator = whitespace ? WHITESPACE_REGEX.test(ch) : ch === delimiter;

		if (!quoteChar && isSeparator) {
			const token = str.slice(start, i).trim();

			if (token) {
				tokens.push(token);
			}

			start = i + 1;
		}
	}

	if (quoteChar) {
		throw new Error(`Unclosed quoted string in directive: ${str}`);
	}

	const tail = str.slice(start).trim();

	if (tail) {
		tokens.push(tail);
	}

	return tokens;
}

/**
 * Splits a string by spaces,
 * respecting quoted regions.
 *
 * @param {string} str - String to split.
 * @returns {string[]} Array of tokens.
 */
export function splitBindingsBySpace(str) {
	return splitOutsideQuotes(str, null, true);
}

/**
 * Splits a string by delimiter
 * outside quoted regions.
 *
 * @param {string} str - String to split.
 * @param {string} delimiter - Delimiter character.
 * @returns {string[]} Array of tokens.
 */
export function splitUnquoted(str, delimiter) {
	return splitOutsideQuotes(str, delimiter, false);
}

/**
 * Splits a string once by delimiter
 * outside quoted regions.
 *
 * Returns at most 2 parts.
 *
 * @param {string} str - String to split.
 * @param {string} delimiter - Delimiter character.
 * @returns {string[]} [left, right] or [left]
 */
export function splitFirstUnquoted(str, delimiter) {
	const parts = splitUnquoted(str, delimiter);

	if (parts.length <= 1) {
		return [parts[0] ?? ""];
	}

	const [first, ...rest] = parts;

	return [first, rest.join(delimiter)];
}

/**
 * Checks if a string is properly quoted.
 *
 * @param {string} str - String to test.
 * @returns {boolean} True if quoted.
 */
export function isQuotedString(str) {
	if (str.length < 2) {
		return false;
	}

	const quote = str[0];

	return isQuote(quote) && str[str.length - 1] === quote;
}

/**
 * Removes quotes and unescapes content.
 *
 * @param {string} str - Quoted string.
 * @returns {string} Unquoted string.
 */
export function unquoteString(str) {
	return isQuotedString(str)
		? str.slice(1, -1).replace(/\\(['"\\])/g, "$1")
		: str;
}

/**
 * Tests if token is a valid identifier.
 *
 * @param {string} token - Token to test.
 * @returns {boolean} True if valid.
 */
export function isPathToken(token) {
	return PATH_TOKEN_REGEX.test(token);
}

/**
 * Tests if a string is a valid dot-path.
 *
 * Examples:
 * - user
 * - user.name
 * - user.profile.avatar
 *
 * @param {string} path - Path string.
 * @returns {boolean} True if valid.
 */
export function isPathPath(path) {
	const trimmed = path.trim();

	if (!trimmed) {
		return false;
	}

	const segments = trimmed.split(".");

	for (let i = 0; i < segments.length; i++) {
		if (!isPathToken(segments[i])) {
			return false;
		}
	}

	return true;
}

/**
 * Classifies a token.
 *
 * Types:
 * - literal
 * - path
 * - invalid
 *
 * @typedef {Object} TokenClassification
 * @property {"literal"|"path"|"invalid"} type
 * @property {string} [value]
 */

/**
 * @param {string} token - Token to classify.
 * @returns {TokenClassification}
 */
export function classifyToken(token) {
	if (!token) {
		return { type: "invalid" };
	}

	const trimmed = token.trim();

	if (!trimmed) {
		return { type: "invalid" };
	}

	if (isQuotedString(trimmed)) {
		return {
			type: "literal",
			value: unquoteString(trimmed),
		};
	}

	if (isPathPath(trimmed)) {
		return {
			type: "path",
			value: trimmed,
		};
	}

	return { type: "invalid" };
}

/**
 * Structured token object.
 *
 * @typedef {Object} Token
 * @property {string} raw - Original trimmed value.
 * @property {string} value - Normalized value.
 * @property {boolean} quoted - Whether token was quoted.
 */

/**
 * Converts raw token to structured token.
 *
 * @param {string} raw - Raw token.
 * @returns {Token}
 */
export function tokenFrom(raw) {
	const trimmed = raw.trim();
	const quoted = isQuotedString(trimmed);

	return {
		raw: trimmed,
		value: quoted ? unquoteString(trimmed) : trimmed,
		quoted,
	};
}

/**
 * Parsed resolver information.
 *
 * Example:
 * formatDate:createdAt:'MMM DD'
 *
 * @typedef {Object} ResolverInfo
 * @property {string} resolver
 * @property {Token[]} args
 */

/**
 * Parses resolver syntax.
 *
 * Resolver name must be a valid identifier.
 *
 * @param {string} expr - Resolver expression.
 * @returns {ResolverInfo|null}
 */
export function parseResolver(expr) {
	const parts = splitUnquoted(expr, ":");

	if (parts.length < 2) {
		return null;
	}

	const resolver = parts.shift();

	if (!resolver || !isPathToken(resolver)) {
		return null;
	}

	return {
		resolver,
		args: parts.map(tokenFrom),
	};
}
