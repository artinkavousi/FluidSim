import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@fluid-2d': path.resolve(__dirname, './packages/fluid-2d'),
            '@fluid-3d': path.resolve(__dirname, './packages/fluid-3d'),
            '@studio': path.resolve(__dirname, './packages/studio'),
        },
    },
    build: {
        target: 'esnext',
    },
});
