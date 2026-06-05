import { createSignal, effect } from "../reactivity/index.js";
import { extractAllDirectives, DIRECTIVE_ATTRIBUTES } from "./directive.js";
import {
	mountedRoots,
	cleanupFunctions,
	unmountFunctions,
} from "./lifecycle.js";

/* -------------------------
 * Core constants
 * ------------------------- */

const NON_DELEGATED_EVENTS = new Set([
	"wheel",
	"scroll",
	"touchstart",
	"touchmove",
	"touchend",
	"mouseenter",
	"mouseleave",
	"pointerenter",
	"pointerleave",
]);

const KEY_MODIFIERS = {
	enter: "Enter",
	esc: "Escape",
	space: " ",
	tab: "Tab",
};

/* -------------------------
 * Weak state
 * ------------------------- */

const teleportMap = new WeakMap();

/* -------------------------
 * Helpers
 * ------------------------- */

function unwrap(v) {
	return typeof v === "function" ? v() : v;
}

function isQuote(ch) {
	return ch === "'" || ch === '"';
}

function isEscaped(str, i) {
	let c = 0;
	while (--i >= 0 && str[i] === "\\") c++;
	return c % 2 === 1;
}

function splitOutsideQuotes(str, sepFn) {
	const out = [];
	let cur = "";
	let q = null;

	for (let i = 0; i < str.length; i++) {
		const ch = str[i];

		if (isQuote(ch)) {
			if (!q) q = ch;
			else if (q === ch && !isEscaped(str, i)) q = null;
			cur += ch;
			continue;
		}

		if (!q && sepFn(ch)) {
			if (cur.trim()) out.push(cur.trim());
			cur = "";
			continue;
		}

		cur += ch;
	}

	if (q) throw new Error(`Unclosed quote: ${str}`);
	if (cur.trim()) out.push(cur.trim());

	return out;
}

const splitSpace = (s) => splitOutsideQuotes(s, (c) => /\s/.test(c));
const splitColon = (s) => splitOutsideQuotes(s, (c) => c === ":");

function isQuoted(s) {
	return (
		s &&
		s.length > 1 &&
		isQuote(s[0]) &&
		s[0] === s[s.length - 1] &&
		!isEscaped(s, s.length - 1)
	);
}

function unquote(s) {
	return s.slice(1, -1).replace(/\\(['"\\])/g, "$1");
}

/* -------------------------
 * Resolver parser
 * resolver:arg:arg
 * ------------------------- */

function parseResolver(expr) {
	const parts = splitColon(expr);
	if (parts.length < 2) return null;

	const resolver = parts.shift().trim();
	if (!resolver || isQuoted(resolver)) return null;

	return {
		resolver,
		args: parts,
	};
}

/* -------------------------
 * Path (STRICT DOT ONLY)
 * ------------------------- */

function readPath(ctx, path) {
	if (!path || isQuoted(path)) return undefined;

	const parts = path.split(".");
	let v = ctx;

	for (const p of parts) {
		if (!p) return undefined;
		if (v == null) return undefined;
		v = unwrap(v)?.[p];
	}

	return v;
}

/* -------------------------
 * Token resolution (STRICT)
 * ------------------------- */

function resolveToken(ctx, token) {
	if (isQuoted(token)) return unquote(token);

	// STRICT: no fallback to literal string
	return unwrap(readPath(ctx, token));
}

/* -------------------------
 * Getter factory
 * ------------------------- */

function createGetter(ctx, expr) {
	if (!expr) return () => undefined;

	if (isQuoted(expr)) {
		const lit = unquote(expr);
		return () => lit;
	}

	const resolver = parseResolver(expr);
	if (resolver) {
		return () => {
			const fn = readPath(ctx, resolver.resolver);
			if (typeof fn !== "function") return undefined;

			try {
				return fn(...resolver.args.map((a) => resolveToken(ctx, a)));
			} catch {
				return undefined;
			}
		};
	}

	return () => unwrap(readPath(ctx, expr));
}

/* -------------------------
 * Model
 * ------------------------- */

function createModel(ctx, expr) {
	const resolver = parseResolver(expr);

	if (resolver) {
		return {
			get: createGetter(ctx, expr),
			set() {
				console.warn("[@bind] resolver binding is read-only");
			},
		};
	}

	return {
		get: createGetter(ctx, expr),
		set(v) {
			const parts = expr.split(".");
			let obj = ctx;

			for (let i = 0; i < parts.length - 1; i++) {
				obj = obj?.[parts[i]];
			}

			if (obj) obj[parts.at(-1)] = v;
		},
	};
}

/* -------------------------
 * FOR directive
 * ------------------------- */

function processForDirective(nodes, ctx, scope) {
	nodes.forEach((el) => {
		const expr = el.getAttribute("@for")?.trim();
		if (!expr) return;

		const parts = splitSpace(expr);

		const itemVar = parts[0];
		const indexVar = parts.length === 3 ? parts[1] : null;
		const arrayKey = parts.at(-1);

		const getter = createGetter(ctx, arrayKey);
		const container = el.parentNode;
		if (!container) return;

		const template = el.cloneNode(true);
		const anchor = document.createComment("@for");
		container.replaceChild(anchor, el);

		template.removeAttribute("@for");

		const map = new Map();

		const dispose = effect(() => {
			const arr = getter();
			if (!Array.isArray(arr)) return;

			const used = new Set();
			let prev = anchor;

			for (let i = 0; i < arr.length; i++) {
				const item = arr[i];

				const keyCtx = Object.create(ctx);
				keyCtx[itemVar] = item;
				if (indexVar) keyCtx[indexVar] = i;

				const key = item ?? i;

				if (used.has(key)) continue;
				used.add(key);

				let rec = map.get(key);

				if (!rec) {
					const el2 = template.cloneNode(true);

					const [getItem, setItem] = createSignal(item);
					const [getIndex, setIndex] = createSignal(i);

					const itemCtx = Object.create(ctx);
					itemCtx[itemVar] = getItem;
					if (indexVar) itemCtx[indexVar] = getIndex;

					bindDOM(extractAllDirectives(el2), itemCtx, scope);

					rec = { el: el2, setItem, setIndex };
					map.set(key, rec);
				} else {
					rec.setItem(item);
					rec.setIndex(i);
				}

				if (rec.el !== prev.nextSibling) {
					container.insertBefore(rec.el, prev.nextSibling);
				}

				prev = rec.el;
			}
		}, scope);

		scope.cleanups.push(() => {
			dispose();
			map.forEach((r) => r.el.remove());
			map.clear();
			anchor.remove();
		});
	});
}

/* -------------------------
 * TEXT
 * ------------------------- */

function processTextDirective(nodes, ctx, scope) {
	nodes.forEach((el) => {
		const expr = el.getAttribute("@text")?.trim();
		if (!expr) return;

		if (isQuoted(expr)) {
			el.textContent = unquote(expr);
			el.removeAttribute("@text");
			return;
		}

		const getter = createGetter(ctx, expr);

		const dispose = effect(() => {
			const v = getter();
			el.textContent = v == null ? "" : String(v);
		}, scope);

		scope.cleanups.push(dispose);
		el.removeAttribute("@text");
	});
}

/* -------------------------
 * CLASS (FIXED RULE)
 * ------------------------- */

function processClassDirective(nodes, ctx, scope) {
	nodes.forEach((el) => {
		const expr = el.getAttribute("@class");
		if (!expr) return;

		const parts = splitSpace(expr);

		const bindings = parts.map((p) => {
			const colon = p.includes(":");

			if (!colon) {
				const getter = createGetter(ctx, p);
				return { type: "dynamic", getter };
			}

			const [cls, cond] = splitColon(p);
			const classes = isQuoted(cls)
				? unquote(cls).split(/\s+/)
				: [];

			const getter = createGetter(ctx, cond);

			return { type: "conditional", classes, getter };
		});

		const dispose = effect(() => {
			bindings.forEach((b) => {
				if (b.type === "dynamic") {
					const v = b.getter();

					const classes =
						typeof v === "string"
							? v.split(/\s+/)
							: Array.isArray(v)
								? v
								: [];

					el.classList.remove(...Array.from(el.classList));
					el.classList.add(...classes);
					return;
				}

				const active = !!b.getter();

				if (active) el.classList.add(...b.classes);
				else el.classList.remove(...b.classes);
			});
		}, scope);

		scope.cleanups.push(dispose);
		el.removeAttribute("@class");
	});
}

/* -------------------------
 * ATTR (strict)
 * ------------------------- */

function processAttrDirective(nodes, ctx, scope) {
	nodes.forEach((el) => {
		const expr = el.getAttribute("@attr");
		if (!expr) return;

		const bindings = splitSpace(expr).map((b) => {
			const [attr, val] = splitColon(b);
			return { attr, getter: createGetter(ctx, val) };
		});

		const dispose = effect(() => {
			bindings.forEach(({ attr, getter }) => {
				const v = getter();

				if (v == null || v === false) el.removeAttribute(attr);
				else if (v === true) el.setAttribute(attr, "");
				else el.setAttribute(attr, String(v));
			});
		}, scope);

		scope.cleanups.push(dispose);
		el.removeAttribute("@attr");
	});
}

/* -------------------------
 * EVENT
 * ------------------------- */

function processEventDirective(nodes, ctx, scope) {
	const eventMap = new Map();

	nodes.forEach((el) => {
		const expr = el.getAttribute("@on");
		if (!expr) return;

		eventMap.set(el, expr.split(/\s+/));
	});

	const root = scope._root || document;

	const handler = (e) => {
		let t = e.target;

		while (t) {
			const b = eventMap.get(t);
			if (b) {
				b.forEach((b) => {
					const [evt, fn] = splitColon(b);
					if (evt !== e.type) return;

					const f = readPath(ctx, fn);
					if (typeof f === "function") f(e);
				});
			}

			if (t === root) break;
			t = t.parentElement;
		}
	};

	root.addEventListener("click", handler, true);

	scope.cleanups.push(() => {
		root.removeEventListener("click", handler, true);
	});
}

/* -------------------------
 * IF (FIXED BUG)
 * ------------------------- */

function processIfDirective(nodes, ctx, scope) {
	nodes.forEach((el) => {
		const expr = el.getAttribute("@if");
		if (!expr) return;

		const getter = createGetter(ctx, expr);

		const parent = el.parentNode;
		if (!parent) return;

		let mounted = true;
		const anchor = document.createComment("@if");

		parent.insertBefore(anchor, el);

		const dispose = effect(() => {
			const v = !!getter();

			if (v && !mounted) {
				parent.insertBefore(el, anchor.nextSibling);
				mounted = true;
			}

			if (!v && mounted) {
				parent.replaceChild(anchor, el);
				mounted = false;
			}
		}, scope);

		scope.cleanups.push(dispose);

		scope.cleanups.push(() => {
			if (mounted) el.remove();
			anchor.remove();
		});

		el.removeAttribute("@if");
	});
}

/* -------------------------
 * SHOW
 * ------------------------- */

function processShowDirective(nodes, ctx, scope) {
	nodes.forEach((el) => {
		const expr = el.getAttribute("@show");
		if (!expr) return;

		const getter = createGetter(ctx, expr);

		const dispose = effect(() => {
			el.style.display = getter() ? "" : "none";
		}, scope);

		scope.cleanups.push(dispose);
		el.removeAttribute("@show");
	});
}

/* -------------------------
 * BIND
 * ------------------------- */

function processBindDirective(nodes, ctx, scope) {
	nodes.forEach((el) => {
		const expr = el.getAttribute("@bind");
		if (!expr) return;

		const model = createModel(ctx, expr);

		const update = () => {
			el.value = model.get() ?? "";
		};

		const input = () => model.set(el.value);

		const dispose = effect(update, scope);

		el.addEventListener("input", input);

		scope.cleanups.push(() => {
			dispose();
			el.removeEventListener("input", input);
		});

		el.removeAttribute("@bind");
	});
}

/* -------------------------
 * REF
 * ------------------------- */

function processRefDirective(nodes, ctx) {
	nodes.forEach((el) => {
		const key = el.getAttribute("@ref");
		if (!key) return;

		if (!ctx.refs) ctx.refs = {};
		ctx.refs[isQuoted(key) ? unquote(key) : key] = el;

		el.removeAttribute("@ref");
	});
}

/* -------------------------
 * MAIN
 * ------------------------- */

export function bindDOM(directives, ctx = {}, scope = { cleanups: [] }) {
	processRefDirective(directives.ref, ctx);
	processForDirective(directives.for, ctx, scope);
	processTextDirective(directives.text, ctx, scope);
	processIfDirective(directives.if, ctx, scope);
	processShowDirective(directives.show, ctx, scope);
	processEventDirective(directives.on, ctx, scope);
	processBindDirective(directives.bind, ctx, scope);
	processClassDirective(directives.class, ctx, scope);
	processAttrDirective(directives.attr, ctx, scope);

	// style + teleport omitted here for brevity (can be added next cleanly)
}