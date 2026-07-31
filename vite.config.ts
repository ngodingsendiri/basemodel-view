import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Deployed to a custom domain (basemodel.fun) at root. Overridable for PR
  // preview deployments (e.g. /basemodel-view/pr-preview/pr-12/).
  base: process.env.BASE_URL || '/',
  plugins: [react()],
  server: {
    fs: {
      allow: ['.'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('@tanstack/react-virtual')) return 'vendor-virtual';
            if (id.includes('zod')) return 'vendor-zod';
            return 'vendor';
          }
          if (id.includes('AlternativesModal')) return 'modal';
        },
      },
    },
    chunkSizeWarningLimit: 200,
    cssCodeSplit: true,
  },
});
