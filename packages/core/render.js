import { getComponent } from "./componentRegistry.js";
import { mount } from "./mount.js";
import { unmount } from "./unmount.js";

function resolveTarget(target) {
	if (typeof target === "string") {
		return document.querySelector(target);
	}

	return target;
}

function getPlaceholderId(placeholder) {
	const template = document.createElement("template");
	template.innerHTML = String(placeholder).trim();

	const el = template.content.firstElementChild;
	const idAttr = el?.getAttribute("data-component-id");
	if (idAttr === null || idAttr === undefined) return null;

	const id = Number(idAttr);
	return Number.isInteger(id) ? id : null;
}

export function render(placeholder, target) {
	const container = resolveTarget(target);

	if (!container) {
		throw new Error("[render] Target element is required");
	}

	const placeholderId = getPlaceholderId(placeholder);

	if (placeholderId === null) {
		throw new Error("[render] Expected a component placeholder from Component(props)");
	}

	const entry = getComponent(placeholderId);

	if (!entry) {
		throw new Error(`[render] Component placeholder "${placeholderId}" was not found`);
	}

	unmount(container);

	return mount(
		() => entry.Component(entry.props, entry.children),
		container,
	);
}
