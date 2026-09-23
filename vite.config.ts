import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` enables a self-signed certificate. Phones only expose the
// gyroscope on secure origins, so use it when testing the remote on your LAN.
const useHttps = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), useHttps ? (basicSsl() as PluginOption) : null].filter(Boolean) as PluginOption[],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
