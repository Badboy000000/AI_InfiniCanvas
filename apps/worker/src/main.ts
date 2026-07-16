import { createWorkerRuntime } from './runtime.js';

// standalone start（第一版不 stand-alone 运行，API + Worker 通常共进程）
const runtime = createWorkerRuntime({
  inbox: {
    publish(event) {
      console.log('[worker] event:', event.type, event);
    },
  },
});

console.log('ai-canvas worker ready. Awaiting in-process dispatch. Executors registered.');

// 保持进程活跃
setInterval(() => undefined, 60_000);

export { runtime };
