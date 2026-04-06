import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { askLLM } from './server/llm/client'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Feed processes natively here into node
  process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  process.env.LIVE_MODE = env.LIVE_MODE || 'true';

  return {
    plugins: [
      react(),
      {
        name: 'llm-proxy-api',
        configureServer(server) {
          server.middlewares.use('/api/llm', async (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              req.on('end', async () => {
                 try {
                   const payload = JSON.parse(body);
                   const response = await askLLM(payload);
                   res.setHeader('Content-Type', 'application/json');
                   res.end(JSON.stringify(response));
                 } catch (e: any) {
                   res.statusCode = 500;
                   res.end(JSON.stringify({ error: e.message }));
                 }
              });
            } else {
               res.statusCode = 405; res.end();
            }
          })
        }
      }
    ]
  }
})
