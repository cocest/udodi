/**
 * Tokenizer Module - Consolidated directive expression parsing.
 * Handles quoted strings, dot-paths, and resolver syntax.
 */

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
	let i = index;
	let n = 0;

	while (--i >= 0) {
		if (str.charCodeAt(i) !== 92) break;
		n++;
	}

	return (n & 1) === 1;
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
export function splitOutsideQuotes(
	str,
	delimiter = null,
	whitespace = false
) {
	if (str.length === 0) return [];

	const tokens = [];
	const delimiterCode = delimiter ? delimiter.charCodeAt(0) : 0;

	let start = 0;
	let quote = 0;
	let escaped = false;

	const len = str.length;

	for (let i = 0; i < len; i++) {
		const code = str.charCodeAt(i);

		// Backslash
		if (code === 92) {
			escaped = !escaped;
			continue;
		}

		// Quotes
		if ((code === 34 || code === 39) && !escaped) {
			if (quote === 0) {
				quote = code;
			} else if (quote === code) {
				quote = 0;
			}

			continue;
		}

		escaped = false;

		let separator = false;

		if (quote === 0) {
			if (whitespace) {
				// space, tab, newline, carriage return
				separator =
					code === 32 ||
					code === 9 ||
					code === 10 ||
					code === 13;
			} else {
				separator = code === delimiterCode;
			}
		}

		if (separator) {
			let s = start;
			let e = i;

			// left trim
			while (s < e && str.charCodeAt(s) <= 32) s++;

			// right trim
			while (e > s && str.charCodeAt(e - 1) <= 32) e--;

			if (s < e) {
				tokens.push(str.slice(s, e));
			}

			start = i + 1;
		}
	}

	if (quote !== 0) {
		throw new Error(`Unclosed quoted string in directive: ${str}`);
	}

	let s = start;
	let e = len;

	while (s < e && str.charCodeAt(s) <= 32) s++;
	while (e > s && str.charCodeAt(e - 1) <= 32) e--;

	if (s < e) {
		tokens.push(str.slice(s, e));
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
	const len = str.length;
	const delimCode = delimiter.charCodeAt(0);

	let quote = 0;
	let escaped = false;

	for (let i = 0; i < len; i++) {
		const c = str.charCodeAt(i);

		if (c === 92 && !escaped) { // '\'
			escaped = true;
			continue;
		}

		if ((c === 34 || c === 39) && !escaped) {
			quote = quote === c ? 0 : quote || c;
			continue;
		}

		escaped = false;

		if (quote === 0 && c === delimCode) {
			return [
				str.slice(0, i),
				str.slice(i + 1)
			];
		}
	}

	return [str];
}

/**
 * Checks if a string is properly quoted.
 *
 * @param {string} str - String to test.
 * @returns {boolean} True if quoted.
 */
export function isQuotedString(str) {
	const len = str.length;
	if (len < 2) return false;

	const first = str.charCodeAt(0);

	// 34 = ", 39 = '
	if (first !== 34 && first !== 39) return false;

	return str.charCodeAt(len - 1) === first;
}

/**
 * Removes quotes and unescapes content.
 *
 * @param {string} str - Quoted string.
 * @returns {string} Unquoted string.
 */
export function unquoteString(str) {
	if (!isQuotedString(str)) return str;

	const len = str.length;
	let i = 1;
	let escaped = false;
	let out = "";

	while (i < len - 1) {
		const c = str.charCodeAt(i);

		if (c === 92 && !escaped) {
			escaped = true;
			i++;
			continue;
		}

		out += str[i];
		escaped = false;
		i++;
	}

	return out;
}

/**
 * Tests if token is a valid identifier.
 * The same with the regex pattern `/^[A-Za-z_$][A-Za-z0-9_$]*$/`but much faster.
 *
 * @param {string} token - Token to test.
 * @returns {boolean} True if valid.
 */
export function isPathToken(token) {
	let code = token.charCodeAt(0);

	// First character: A-Z, a-z, _, $
	if (!(
		(code >= 65 && code <= 90) ||   // A-Z
		(code >= 97 && code <= 122) ||  // a-z
		code === 95 ||                  // _
		code === 36                     // $
	)) {
		return false;
	}

	const len = token.length;

	for (let i = 1; i < len; i++) {
		code = token.charCodeAt(i);
		if (!(
			(code >= 65 && code <= 90) ||    // A-Z
			(code >= 97 && code <= 122) ||   // a-z
			(code >= 48 && code <= 57) ||    // 0-9
			code === 95 ||                   // _
			code === 36                      // $
		)) {
			return false;
		}
	}

	return true;
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
	const segments = path.split(".");

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
	const quoted = isQuotedString(raw);

	return {
		raw,
		value: quoted ? unquoteString(raw) : raw,
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
