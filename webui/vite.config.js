import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    css: {
        preprocessorOptions: {
            sass: {
                api: "modern"
            }
        }
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:6412",
                ws: true,
                changeOrigin: true,
                secure: false
            }
        }
    }
});