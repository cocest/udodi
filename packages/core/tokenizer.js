/**
 * Quote-aware scanner utilities.
 *
 * These helpers are intended as the foundation
 * for Udodi's lexer and directive parser.
 */

/**
 * Scanner mode: split on delimiter.
 *
 * @type {number}
 */
export const SCAN_DELIMITER = 1;

/**
 * Scanner mode: split on whitespace.
 *
 * @type {number}
 */
export const SCAN_WHITESPACE = 2;

/**
 * Returns true if character is a quote.
 *
 * @param {string} ch - Character.
 * @returns {boolean}
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
 * Returns true if string is enclosed
 * by matching quotes.
 *
 * Examples:
 *
 * "hello"
 * 'hello'
 *
 * @param {string} str
 * @returns {boolean}
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
 * Removes surrounding quotes and
 * unescapes quoted content.
 *
 * Examples:
 *
 * "'hello'" -> "hello"
 * "'it\\'s'" -> "it's"
 *
 * @param {string} str
 * @returns {string}
 */
export function unquoteString(str) {
	if (!isQuotedString(str)) {
		return str;
	}

	const len = str.length;

	let result = "";

	for (let i = 1; i < len - 1; i++) {
		const c = str.charCodeAt(i);

		// '\'
		if (c === 92 && i + 1 < len - 1) {
			result += str[++i];
			continue;
		}

		result += str[i];
	}

	return result;
}

/**
 * Scans a string while respecting
 * quoted regions.
 *
 * Emits token ranges.
 *
 * Callback receives:
 *
 * (start, end)
 *
 * where:
 *
 * str.slice(start, end)
 *
 * is the token.
 *
 * @param {string} str
 * @param {(start:number,end:number)=>void} onToken
 * @param {number} mode
 * @param {string|null} [delimiter=null]
 */
export function scanQuoted(str, onToken, mode, delimiter = null) {
	const len = str.length;

	if (len === 0) {
		return;
	}

	let quote = 0;
	let escaped = false;
	let start = 0;

	const delimCode =
		mode === SCAN_DELIMITER && delimiter ? delimiter.charCodeAt(0) : 0;

	for (let i = 0; i < len; i++) {
		const c = str.charCodeAt(i);

		// Escape
		if (c === 92 && !escaped) {
			escaped = true;
			continue;
		}

		// Quote handling
		if ((c === 34 || c === 39) && !escaped) {
			if (quote === 0) {
				quote = c;
			} else if (quote === c) {
				quote = 0;
			}

			continue;
		}

		escaped = false;

		// ----------------------------------
		// Delimiter mode
		// ----------------------------------

		if (mode === SCAN_DELIMITER && quote === 0 && c === delimCode) {
			onToken(start, i);
			start = i + 1;
			continue;
		}

		// ----------------------------------
		// Whitespace mode
		// ----------------------------------

		if (mode === SCAN_WHITESPACE && quote === 0 && c <= 32) {
			if (start < i) {
				onToken(start, i);
			}

			i++;

			while (i < len && str.charCodeAt(i) <= 32) {
				i++;
			}

			start = i;
			i--;
		}
	}

	if (quote !== 0) {
		throw new Error(`Unclosed quoted string: ${str}`);
	}

	onToken(start, len);
}

/**
 * Splits a string by delimiter
 * outside quoted regions.
 *
 * Empty tokens are preserved.
 *
 * Examples:
 *
 * a:b:c
 * -> ["a","b","c"]
 *
 * a::c
 * -> ["a","","c"]
 *
 * @param {string} str
 * @param {string} delimiter
 * @returns {string[]}
 */
export function splitUnquoted(str, delimiter) {
	if (!str) {
		return [];
	}

	const tokens = [];

	scanQuoted(
		str,
		(start, end) => {
			tokens.push(str.slice(start, end));
		},
		SCAN_DELIMITER,
		delimiter,
	);

	return tokens;
}

/**
 * Splits a string by whitespace
 * outside quoted regions.
 *
 * Examples:
 *
 * foo bar baz
 * -> ["foo","bar","baz"]
 *
 * foo "bar baz"
 * -> ["foo","\"bar baz\""]
 *
 * @param {string} str
 * @returns {string[]}
 */
export function splitBindingsBySpace(str) {
	if (!str) {
		return [];
	}

	const tokens = [];

	scanQuoted(
		str,
		(start, end) => {
			if (start < end) {
				tokens.push(str.slice(start, end));
			}
		},
		SCAN_WHITESPACE,
	);

	return tokens;
}

/**
 * Splits once by delimiter
 * outside quoted regions.
 *
 * Returns:
 *
 * [left]
 *
 * or
 *
 * [left, right]
 *
 * @param {string} str
 * @param {string} delimiter
 * @returns {string[]}
 */
export function splitFirstUnquoted(str, delimiter) {
	if (!str) {
		return [""];
	}

	const delimCode = delimiter.charCodeAt(0);

	const len = str.length;

	let quote = 0;
	let escaped = false;

	for (let i = 0; i < len; i++) {
		const c = str.charCodeAt(i);

		if (c === 92 && !escaped) {
			escaped = true;
			continue;
		}

		if ((c === 34 || c === 39) && !escaped) {
			if (quote === 0) {
				quote = c;
			} else if (quote === c) {
				quote = 0;
			}

			continue;
		}

		escaped = false;

		if (quote === 0 && c === delimCode) {
			return [str.slice(0, i), str.slice(i + 1)];
		}
	}

	if (quote !== 0) {
		throw new Error(`Unclosed quoted string: ${str}`);
	}

	return [str];
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

	if (isQuotedString(token)) {
		return {
			type: "literal",
			value: unquoteString(token),
		};
	}

	if (isPathPath(token)) {
		return {
			type: "path",
			value: token,
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
