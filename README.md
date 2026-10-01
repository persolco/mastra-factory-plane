# mastra-factory-plane

[Plane](https://plane.so) integration for [Mastra Factory](https://mastra.ai/factory). It gives Factory agents Plane tools (projects, work items, cycles, modules, comments, and so on) by running the official [`plane-mcp-server`](https://github.com/makeplane/plane-mcp-server) and handing its tools to the agent tool set.

`@mastra/factory` has no MCP loader of its own, so a `.mcp.json` file never reaches Factory agents. This package uses the integration hook `agentTools()` to supply the tools.

> Unofficial. Not affiliated with Mastra or Plane.

## Scope

This package gives agents **tools** for reading and changing Plane. It does not (yet) make Plane a work source: Plane issues are not turned into Factory work items, and Factory status is not synced back to Plane. That fuller integration was requested in [mastra-ai/mastra#25703](https://github.com/mastra-ai/mastra/issues/25703), where the Mastra team suggested it live in a community repo. Intake and sync are the planned next steps; contributions are welcome.

## Requirements

- `@mastra/factory` >= 0.17.0 and `@mastra/mcp` >= 2.1.0 (peer dependencies)
- [`uv`](https://docs.astral.sh/uv/) on the Factory server's `PATH`, because the MCP server is started with `uvx plane-mcp-server stdio`
- A Plane API key (Profile → Settings → Personal Access Tokens) and your workspace slug

## Install

```bash
npm install mastra-factory-plane @mastra/mcp
```

## Use

```ts
import { MastraFactory } from '@mastra/factory';
import { PlaneIntegration } from 'mastra-factory-plane';

const plane =
  process.env.PLANE_API_KEY && process.env.PLANE_WORKSPACE_SLUG
    ? new PlaneIntegration({
        apiKey: process.env.PLANE_API_KEY,
        workspaceSlug: process.env.PLANE_WORKSPACE_SLUG,
        baseUrl: process.env.PLANE_BASE_URL, // omit for Plane Cloud
      })
    : undefined;

export const factory = new MastraFactory({
  integrations: [...(plane ? [plane] : [])],
  // ...the rest of your config
});
```

Agents then see the server's tools, named `plane_*`.

## Options

| Option          | Required | Description                                                                                   |
| --------------- | -------- | --------------------------------------------------------------------------------------------- |
| `apiKey`        | yes      | Plane personal access token                                                                   |
| `workspaceSlug` | yes      | Workspace slug from your Plane URL                                                            |
| `baseUrl`       | no       | API origin. Omit for Plane Cloud (`https://api.plane.so`); set for self-hosted                |
| `createClient`  | no       | Build the MCP client yourself (for tests, or to run the server some other way)                |

## Behavior

- Tools load lazily on the first agent request and are cached. If the server fails to start (for example `uvx` is missing), the error is logged, agents get no Plane tools for that request, and the next request retries.
- `diagnostics()` reports the workspace slug and base URL. It never includes the API key.
- `shutdown()` disconnects the MCP client.

## Development

```bash
npm install
npm run check
npm test
npm run build
```

## License

MIT
