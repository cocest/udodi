import {
	EXPR_LITERAL,
	EXPR_PATH,
	EXPR_CALL,
	EXPR_CONDITIONAL,
} from "./expTypes.js";

/**
 * Creates a pure expression evaluator for Udodi.
 *
 * This evaluator works on the lowered IR produced by compiler.js.
 * All pipelines are already transformed into nested function calls.
 *
 * Supported expression types:
 * - Literals
 * - Paths (e.g. `user.name`)
 * - Function calls (with pipeline support)
 * - Conditionals (`condition => value`)
 *
 * @param {Object} context - Evaluation context containing state and helper functions.
 * @returns {Function} The `evaluate` function.
 */
export function createEvaluator(context) {
	/**
	 * Evaluates any IR expression.
	 *
	 * @param {Object} expr - Compiled expression IR.
	 * @param {Object} [runtimeContext] - Optional override context for component isolation.
	 * @param {Object} [event] - Event object injected into event handlers.
	 * @returns {*} Evaluated value.
	 */
	return function evaluate(expr, runtimeContext, event) {
		if (!expr) return undefined;

		const ctx = runtimeContext || context;

		switch (expr.type) {
			case EXPR_LITERAL:
				return expr.value;

			case EXPR_PATH:
				return evaluatePath(expr, ctx);

			case EXPR_CALL:
				return evaluateCall(expr, ctx, evaluate, runtimeContext, event);

			case EXPR_CONDITIONAL:
				return evaluateConditional(expr, evaluate, runtimeContext);

			default:
				throw new Error(`Unknown expression type: ${expr.type}`);
		}
	};
}

/**
 * Evaluates a compiled path expression against the given lexical scope.
 *
 * The first segment is resolved by walking the explicit scope chain
 * via `__parent`, allowing nested scopes (such as `@for`) to shadow
 * parent variables without mutating the parent context.
 *
 * Once the root value is resolved, the remaining path segments are
 * traversed normally. Any function encountered during traversal is
 * automatically invoked, allowing reactive signal getters to be
 * transparently unwrapped.
 *
 * @example
 * ```js
 * // Parent context
 * { count: getCount }
 *
 * // Nested `@for` scope
 * {
 *   __parent: parentContext,
 *   user: getUser,
 *   userIndex: getIndex
 * }
 * ```
 *
 * Path resolution:
 *
 * @example
 * ```js
 * evaluatePath(scope, { segments: ["user", "name"] });
 * // => getUser().name
 *
 * evaluatePath(scope, { segments: ["count"] });
 * // => getCount()
 * ```
 *
 * Time complexity:
 * - Scope resolution: O(scope depth)
 * - Path traversal: O(segment count)
 *
 * @param {Object} expr
 *   Compiled path expression.
 * 
 * @param {Object} context
 *   The current lexical scope. May contain a `__parent` property
 *   pointing to an outer scope.
 *
 * @param {string[]} expr.segments
 *   Ordered path segments to resolve.
 *
 * @returns {*}
 *   The resolved value, or `undefined` if the root identifier cannot
 *   be found. Returns `null` or `undefined` immediately if encountered
 *   during traversal.
 */
function evaluatePath(expr, context) {
	const segments = expr.segments;
	const length = segments.length;

	let obj;
	const firstSegment = segments[0];

	for (
		let scope = context;
		scope != null;
		scope = scope.__parent
	) {
		if (Object.hasOwn(scope, firstSegment)) {
			obj = scope[firstSegment];
			break;
		}
	}

	if (typeof obj === "function") {
		obj = obj();
	}

	if (obj == null || length === 1) {
		return obj;
	}

	for (let i = 1; i < length; i++) {
		obj = obj[segments[i]];

		if (typeof obj === "function") {
			obj = obj();
		}

		if (obj == null) {
			return obj;
		}
	}

	return obj;
}

/**
 * Evaluates a function call.
 *
 * Pipelines are lowered by the compiler into nested calls:
 * `user.id | formatDate:'MMM DD'` --> `formatDate(user.id, 'MMM DD')`
 *
 * The `context` already contains bound functions, allowing direct invocation.
 * Calls with 0–3 arguments are optimized to avoid array allocation.
 *
 * @param {Object} expr
 * @param {Object} context
 * @param {Function} evaluate
 * @param {Object} runtimeContext
 * @param {Object} [event]
 * @returns {*}
 */
function evaluateCall(expr, context, evaluate, runtimeContext, event) {
	let fn;
	const name = expr.name;

	for (
		let scope = context;
		scope != null;
		scope = scope.__parent
	) {
		if (Object.hasOwn(scope, name)) {
			fn = scope[name];
			break;
		}
	}

	if (typeof fn !== "function") {
		throw new Error(`Unknown function: ${name}`);
	}

	const args = expr.args;
	const length = args.length;
	const hasEvent = event !== undefined;

	switch (length) {
		case 0:
			return hasEvent ? fn(event) : fn();

		case 1: {
			const arg0 = evaluate(args[0], runtimeContext);
			return hasEvent ? fn(event, arg0) : fn(arg0);
		}

		case 2: {
			const arg0 = evaluate(args[0], runtimeContext);
			const arg1 = evaluate(args[1], runtimeContext);

			return hasEvent
				? fn(event, arg0, arg1)
				: fn(arg0, arg1);
		}

		case 3: {
			const arg0 = evaluate(args[0], runtimeContext);
			const arg1 = evaluate(args[1], runtimeContext);
			const arg2 = evaluate(args[2], runtimeContext);

			return hasEvent
				? fn(event, arg0, arg1, arg2)
				: fn(arg0, arg1, arg2);
		}

		default: {
			const evaluated = new Array(length + hasEvent);

			let i = 0;

			if (hasEvent) {
				evaluated[i++] = event;
			}

			for (; i < evaluated.length; i++) {
				evaluated[i] = evaluate(args[i - hasEvent], runtimeContext);
			}

			return fn(...evaluated);
		}
	}
}

/**
 * Evaluates a conditional expression: `condition => value`.
 *
 * - Evaluates the condition first.
 * - The condition must resolve to a boolean.
 * - If false, returns `undefined`.
 * - If true, evaluates and returns the value expression.
 *
 * @param {Object} expr - Conditional expression.
 * @param {Function} evaluate - Expression evaluator.
 * @param {Object} runtimeContext - Execution context.
 * @returns {*} Result of the value expression or `undefined`.
 * @throws {Error} If the condition does not resolve to a boolean.
 */
function evaluateConditional(expr, evaluate, runtimeContext) {
	const conditionValue = evaluate(expr.condition, runtimeContext);

	if (typeof conditionValue !== "boolean") {
		throw new Error(
			`Conditional expression must resolve to boolean, got ${typeof conditionValue}`
		);
	}

	if (!conditionValue) {
		return undefined;
	}

	return evaluate(expr.value, runtimeContext);
}
