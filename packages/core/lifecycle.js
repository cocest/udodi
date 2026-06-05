export const mountedRoots = new WeakSet();
export const cleanupFunctions = new WeakMap();
export const unmountFunctions = new WeakMap();

let cleanupObserver = null;

export function runScopeCleanup(scope, label = "scope") {
    if (!scope) return;

    for (const fn of scope.effects || []) {
        try {
            fn?.();
        } catch (err) {
            console.warn(`[cleanup] effect error (${label}):`, err);
        }
    }

    for (const fn of scope.cleanups || []) {
        try {
            fn?.();
        } catch (err) {
            console.warn(`[cleanup] cleanup error (${label}):`, err);
        }
    }
}

export function registerRoot(root, cleanup, unmount) {
    if (!root) return;
    mountedRoots.add(root);
    cleanupFunctions.set(root, cleanup);
    unmountFunctions.set(root, unmount);
}

export function unregisterRoot(root) {
    if (!root) return;
    mountedRoots.delete(root);
    cleanupFunctions.delete(root);
    unmountFunctions.delete(root);
}

export function getCleanupObserver() {
    if (cleanupObserver) {
        return cleanupObserver;
    }

    cleanupObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                // Cleanup removed tree
                if (!node || node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }

                traverse(node);
            }
        }
    });

    cleanupObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    return cleanupObserver;
}

function traverse(node) {
    if (
        mountedRoots.has(node) &&
        typeof cleanupFunctions.get(node) === "function" &&
        !node.isConnected
    ) {
        cleanupFunctions.get(node)();
    }

    let child = node.firstElementChild;

    while (child) {
        traverse(child);
        child = child.nextElementSibling;
    }
}
