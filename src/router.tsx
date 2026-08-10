// `buffer` is CJS — named ESM `{ Buffer }` throws in the browser Vite client and
// leaves routes stuck on their initial loading spinner (hydration never finishes).
import buffer from "buffer";

type BufferCtor = typeof globalThis extends { Buffer: infer B } ? B : never;
const BufferImpl = (buffer as unknown as { Buffer: BufferCtor }).Buffer;
const g = globalThis as unknown as { Buffer?: BufferCtor };
g.Buffer = g.Buffer ?? BufferImpl;

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
