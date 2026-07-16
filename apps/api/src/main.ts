import { createServer } from 'node:http';
import { createApiApplication } from './application.js';

const port = Number.parseInt(process.env.PORT ?? '4000', 10);
const app = createApiApplication();
const server = createServer((req, res) => {
  app.handler(req, res).catch((error) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ code: 'internal_error', message: (error as Error).message }));
    }
  });
});

server.listen(port, () => {
  console.log(`ai-canvas api listening on http://localhost:${port}`);
});
