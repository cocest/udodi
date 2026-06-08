import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
	server: {
		port: 5173,
		open: true,
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			udodi: path.resolve(__dirname, "../")
		},
	},
});
