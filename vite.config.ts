import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import type { Plugin } from "vite";

function clientTopLevelAwait(): Plugin {
  return { ...topLevelAwait(), applyToEnvironment: (env) => env.name === "client" };
}

function midnightSsrStub(): Plugin {
  const wasmStub = path.resolve("src/lib/midnight-ssr-stub.ts");
  const swaps: Array<[string, string]> = [
    [path.resolve("src/lib/append-entry.server.ts"), path.resolve("src/lib/append-entry.ssr-stub.ts")],
    [path.resolve("src/lib/anchor-mandate.server.ts"), path.resolve("src/lib/anchor-mandate.ssr-stub.ts")],
    [path.resolve("src/lib/musdc.server.ts"), path.resolve("src/lib/musdc.ssr-stub.ts")],
    [path.resolve("src/lib/record-order.server.ts"), path.resolve("src/lib/record-order.ssr-stub.ts")],
    [path.resolve("src/lib/move-nft.server.ts"), path.resolve("src/lib/move-nft.ssr-stub.ts")],
    [path.resolve("src/lib/midnight-providers.server.ts"), wasmStub],
  ];
  return {
    name: "midnight-ssr-stub",
    apply: "build",
    enforce: "pre",
    async resolveId(id, importer, options) {
      if (!options?.ssr) return;
      if (id.startsWith("@midnight-ntwrk/")) return wasmStub;
      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      for (const [real, stub] of swaps) {
        if (resolved.id === real) return stub;
      }
      return resolved;
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(loadedEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": path.resolve("src") },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
      react(),
      midnightSsrStub(),
      wasm(),
      clientTopLevelAwait(),
    ],
    build: {
      target: "esnext",
      commonjsOptions: { transformMixedEsModules: true, defaultIsModuleExports: "auto" },
    },
    optimizeDeps: {
      noDiscovery: true,
      include: ["buffer"],
      esbuildOptions: { target: "esnext", supported: { "top-level-await": true } },
      exclude: [
        "@midnight-ntwrk/compact-runtime",
        "@midnight-ntwrk/onchain-runtime-v3",
        "@midnight-ntwrk/midnight-js-contracts",
        "@midnight-ntwrk/midnight-js-http-client-proof-provider",
        "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
        "@midnight-ntwrk/midnight-js-fetch-zk-config-provider",
        "@midnight-ntwrk/midnight-js-network-id",
        "@midnight-ntwrk/midnight-js-utils",
        "@midnight-ntwrk/midnight-js-node-zk-config-provider",
        "@midnight-ntwrk/midnight-js-level-private-state-provider",
        "@midnight-ntwrk/dapp-connector-api",
        "@midnight-ntwrk/testkit-js",
        "@midnight-ntwrk/wallet-sdk",
        "pino",
        "ws",
        "ssh2",
        "cpu-features",
      ],
    },
  };
});
