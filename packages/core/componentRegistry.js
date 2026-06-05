/**
 * Component Registry
 * 
 */

let nextId = 0;
let registry = [];

/**
 * Add component to a registry list and return a placeholder.
 */
export function addComponent(Component, props = {}, children = "") {
    const id = nextId++;

    registry.push({
        Component,
        props,
        children: children || ""
    });

    return `<div data-component-id="${id}"></div>`;
}

/**
 * Get component from the registry using ID.
 */
export function getComponent(id) {
    return registry[id];
}

/** 
 * Clear the registry.
 */
export function clear() {
    registry = [];
    nextId = 0;
}