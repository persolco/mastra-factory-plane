import { MCPClient } from '@mastra/mcp';
import type { FactoryIntegration, IntegrationTools } from '@mastra/factory/integrations/base';

export interface PlaneIntegrationOptions {
  apiKey: string;
  workspaceSlug: string;
  /** Plane API origin. Omit for Plane Cloud; set for self-hosted (e.g. http://localhost). */
  baseUrl?: string;
  /**
   * Replaces how the MCP client is built. Mainly for tests, or to run the
   * server differently than `uvx plane-mcp-server stdio`.
   */
  createClient?: (env: Record<string, string>) => PlaneToolClient;
}

/** The slice of `MCPClient` this integration uses. */
export interface PlaneToolClient {
  listTools(): Promise<unknown>;
  disconnect(): Promise<void>;
}

/**
 * Exposes Plane (https://plane.so) to Factory agents by running the official
 * `plane-mcp-server` over stdio and handing its tools to the agent tool set as
 * `plane_*`. `@mastra/factory` has no MCP loader of its own, so a `.mcp.json`
 * alone never reaches its agents; `agentTools()` is the supported hook.
 */
export class PlaneIntegration implements FactoryIntegration {
  readonly id = 'plane';
  readonly #options: PlaneIntegrationOptions;
  #client?: PlaneToolClient;
  #tools?: Promise<IntegrationTools>;

  constructor(options: PlaneIntegrationOptions) {
    if (!options.apiKey?.trim()) throw new Error('PlaneIntegration: apiKey is required');
    if (!options.workspaceSlug?.trim()) throw new Error('PlaneIntegration: workspaceSlug is required');
    this.#options = options;
  }

  routes() {
    return [];
  }

  /** Tools are fetched once; a failed start is retried on the next request. */
  agentTools(): Promise<IntegrationTools> {
    this.#tools ??= this.#loadTools().catch(error => {
      this.#tools = undefined;
      console.error('plane integration: failed to load MCP tools', error);
      return {};
    });
    return this.#tools;
  }

  diagnostics() {
    return {
      configured: true,
      workspaceSlug: this.#options.workspaceSlug,
      baseUrl: this.#options.baseUrl ?? 'https://api.plane.so',
    };
  }

  async shutdown() {
    await this.#client?.disconnect();
    this.#client = undefined;
    this.#tools = undefined;
  }

  async #loadTools(): Promise<IntegrationTools> {
    const { apiKey, workspaceSlug, baseUrl, createClient } = this.#options;
    const env: Record<string, string> = {
      PLANE_API_KEY: apiKey,
      PLANE_WORKSPACE_SLUG: workspaceSlug,
      ...(baseUrl ? { PLANE_BASE_URL: baseUrl } : {}),
    };
    this.#client = createClient ? createClient(env) : defaultClient(env);
    return (await this.#client.listTools()) as IntegrationTools;
  }
}

function defaultClient(env: Record<string, string>): PlaneToolClient {
  return new MCPClient({
    id: 'plane',
    servers: { plane: { command: 'uvx', args: ['plane-mcp-server', 'stdio'], env } },
  });
}
