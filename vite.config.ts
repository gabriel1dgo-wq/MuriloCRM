import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'runtime-public-config',
        configureServer(server) {
          server.middlewares.use('/config.json', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                supabaseUrl: env.SUPABASE_URL || '',
                supabaseKey: env.SUPABASE_PUBLISHABLE_KEY || '',
                demoEnabled: env.DEMO_ENABLED !== 'false',
              }),
            );
          });
        },
      },
    ],
    server: { port: 5173, strictPort: true },
  };
});
