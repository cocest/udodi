/**
 * Still writting...
 */

const jobQueue = new Set();
let isFlushing = false;

function schedule(job) {
    if (jobQueue.has(job)) return; // optional but good for performance

    jobQueue.add(job);

    if (!isFlushing) {
        isFlushing = true;
        queueMicrotask(flushJobs);
    }
}

function flushJobs() {
    const jobs = Array.from(jobQueue);
    jobQueue.clear();
    isFlushing = false;

    let i = 0;
    for (; i < jobs.length; i++) {
        jobs[i]();
    }
}

let currentEffect = null;

/**
 * Creates a reactive signal - a primitive reactive value with getter and setter.
 * 
 * Signals are the foundation of the reactivity system. They track dependencies
 * when read (inside effects or computed) and notify dependents when updated.
 *
 * @param {any} initialValue - The initial value of the signal.
 * @returns {[get: () => any, set: (newValue: any) => void]} 
 *   A tuple containing:
 *   - `get`: Function to read the current value (tracks dependencies)
 *   - `set`: Function to update the value and trigger effects
 *
 * @example
 * const [count, setCount] = createSignal(0);
 * 
 * effect(() => {
 *   console.log('Count is:', count());
 * });
 * 
 * setCount(5); // Triggers the effect
 */
export function createSignal(initialValue) {
    let value = initialValue;
    const subscribers = new Set();

    const get = () => {
        if (currentEffect) {
            subscribers.add(currentEffect);
            currentEffect.deps.add(subscribers);
        }
        return value;
    };

    const set = (nextValue) => {
        if (Object.is(value, nextValue)) return;

        value = nextValue;

        if (subscribers.size === 0) return;

        for (const effect of subscribers) {
            schedule(effect);
        }
    };

    return [get, set];
}

/**
 * Runs side effect and tracks dependencies
 */
export function effect(fn, scope) {
    let deps = new Set();

    const effectFn = () => {
        // Cleanup old dependencies
        // This prevents memory leaks and stale subscriptions
        for (const dep of deps) {
            dep.delete(effectFn);
        }
        deps.clear();

        // Track new dependencies
        currentEffect = effectFn;
        try {
            fn();
        } finally {
            currentEffect = null;
        }
    };

    effectFn.deps = deps;

    if (scope) {
        scope.effects.push(() => cleanup(effectFn));
    }

    effectFn(); // initial run
    return () => cleanup(effectFn);
}

function cleanup(effectFn) {
    const deps = effectFn.deps;

    if (!deps) return;

    for (const dep of deps) {
        dep.delete(effectFn);
    }

    deps.clear();
}

/**
 * Computed value with caching
 */
export function computed(fn) {
    let cachedValue;
    let dirty = true;

    const [getSignal, setSignal] = createSignal();

    effect(() => {
        const newValue = fn();

        if (!Object.is(newValue, cachedValue)) {
            cachedValue = newValue;
            setSignal(newValue);
        }

        dirty = false;
    });

    return () => {
        if (dirty) {
            cachedValue = fn();
            dirty = false;
        }

        return getSignal();
    };
}

/**
 * Creates a shallow reactive object backed by per-key signals.
 *
 * Reading `state.key` tracks the current effect. Writing `state.key = value`
 * updates the signal for that key. Nested objects are not deeply proxied.
 */
export function reactive(initialState = {}, options = {}) {
    const { interceptors = {} } = options;
    const signals = new Map();
    const target = {};

    for (const [key, value] of Object.entries(initialState)) {
        const [getter, setter] = createSignal(value);
        signals.set(key, { getter, setter });
    }

    const commit = (prop, value) => {
        let nextValue = value;
        const interceptor = interceptors[prop];

        if (typeof interceptor === "function") {
            const intercepted = interceptor(value);
            if (intercepted === undefined) return true;
            nextValue = intercepted;
        }

        signals.get(prop).setter(nextValue);
        return true;
    };

    return new Proxy(target, {
        get(target, prop, receiver) {
            if (signals.has(prop)) {
                return signals.get(prop).getter();
            }

            return Reflect.get(target, prop, receiver);
        },

        set(target, prop, value, receiver) {
            if (signals.has(prop)) {
                return commit(prop, value);
            }

            return Reflect.set(target, prop, value, receiver);
        },

        has(target, prop) {
            return signals.has(prop) || Reflect.has(target, prop);
        },

        ownKeys(target) {
            return Array.from(new Set([...Reflect.ownKeys(target), ...signals.keys()]));
        },

        getOwnPropertyDescriptor(target, prop) {
            if (signals.has(prop)) {
                return {
                    enumerable: true,
                    configurable: true,
                };
            }

            return Reflect.getOwnPropertyDescriptor(target, prop);
        },
    });
}

/**
 * Marks a value as a reactive binding for prop passing.
 * 
 * Use this when passing reactive state to a child component to maintain
 * the reactive connection. Without this, props are plain value snapshots.
 * 
 * @param {any} value - The value to bind reactively (usually a reactive Proxy)
 * @returns {Object} A marked binding object
 * 
 * @example
 * const Child = createComponent({...});
 * 
 * // Parent component
 * Parent({
 *     template: (ctx) => `${Child({ data: bindProp(ctx.data) })}`
 * });
 * 
 * // In Child, ctx.data is now reactively linked to Parent's ctx.data
 */
const REACTIVE_BINDING = Symbol('REACTIVE_BINDING');

export function bindProp(value) {
    return { [REACTIVE_BINDING]: true, value };
}

export function isReactiveProp(prop) {
    return prop && typeof prop === 'object' && prop[REACTIVE_BINDING] === true;
}

export function unwrapReactiveProp(prop) {
    return isReactiveProp(prop) ? prop.value : prop;
}
