import { defineConfig } from 'vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
// https://vitejs.dev/config/
export default defineConfig(function () {
    return {
        plugins: [
            TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
            react(),
            vanillaExtractPlugin(),
            eslint(),
        ],
        server: {
            port: 3000,
            open: true,
        },
        preview: {
            port: 3000,
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        'react': ['react', 'react-dom'],
                        'tanstack-router': ['@tanstack/router'],
                        'lodash': ['lodash'],
                        'eslint': ['eslint'],
                    },
                },
            },
        },
    };
});
