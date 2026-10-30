import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://justcreature.github.io',
  base: process.env.GITHUB_PAGES === 'true' ? '/off-planner' : '/',
  devToolbar: {
    enabled: false,
  },
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
