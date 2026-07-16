import { createServer } from 'node:http';
import { wireApiWithInProcessWorker } from './wire-mvp.js';
import { createEcommerceDetailWorkflow } from '../apps/api/src/templates/ecommerce-detail.js';

/**
 * 一体化开发服务器：把 apps/api 与 apps/worker 装到同一个 Node/Bun 进程里，
 * 供本地开发与端到端联调使用。
 *
 * 会预置一份电商详情图 MVP 工作流（id: wf-mvp），前端可以直接拉取并试跑。
 * 端口通过 PORT 环境变量指定，默认 4000。
 */

const app = wireApiWithInProcessWorker();

const port = Number.parseInt(process.env.PORT ?? '4000', 10);
const server = createServer((req, res) => {
  app.handler(req, res).catch((error) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ code: 'internal_error', message: (error as Error).message }));
    }
  });
});

// 预置示例工作流，便于前端一键跑通
await app.workflows.save(createEcommerceDetailWorkflow('wf-mvp'));

server.listen(port, () => {
  console.log(`ai-canvas mvp dev server listening on http://localhost:${port}`);
  console.log('预置工作流：GET /api/workflows/wf-mvp');
  console.log('触发运行：POST /api/workflows/wf-mvp/runs');
});
