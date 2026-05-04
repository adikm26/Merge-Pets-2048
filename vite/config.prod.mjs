import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    logLevel: 'warn',
    build: {
        target: 'es2020',
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2,
                drop_console: false
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    }
});
