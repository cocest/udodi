/**
 * Cache of previously created readonly proxies.
 * Prevents creating multiple proxy instances for the same object.
 *
 * @type {WeakMap<object, object>}
 */
const readonlyCache = new WeakMap();

/**
 * Creates a deep readonly membrane around an object.
 *
 * Primitive values are returned unchanged.
 * Nested objects are wrapped lazily and cached.
 *
 * @param {*} value - The value to wrap.
 * @returns {*} A readonly proxy or the original primitive.
 */
export function readonly(value) {
    if (value === null || typeof value !== "object") {
        return value;
    }

    const cached = readonlyCache.get(value);

    if (cached) {
        return cached;
    }

    const proxy = new Proxy(value, {
        get(target, prop, receiver) {
            return readonly(Reflect.get(target, prop, receiver));
        },

        set(target, prop) {
            throw new Error(
                `[context] "${String(prop)}" is read-only. Framework namespaces cannot be modified.`
            );
        },

        deleteProperty(target, prop) {
            throw new Error(
                `[context] "${String(prop)}" is read-only. Framework namespaces cannot be modified.`
            );
        },

        defineProperty(target, prop) {
            throw new Error(
                `[context] "${String(prop)}" is read-only. Framework namespaces cannot be modified.`
            );
        },

        setPrototypeOf() {
            throw new Error(
                `[context] Framework namespaces are read-only.`
            );
        }
    });

    readonlyCache.set(value, proxy);

    return proxy;
}