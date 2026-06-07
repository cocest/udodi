import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 5173,
		open: true,
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
	// This ensures Vite resolves the local Udodi from dist
	resolve: {
		alias: {
			udodi: "../dist/index.js", // points to ESM build
		},
	},
});
