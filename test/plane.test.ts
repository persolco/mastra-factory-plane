import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PlaneIntegration } from '../src/index.js';

const base = { apiKey: 'k', workspaceSlug: 'acme' };

describe('PlaneIntegration', () => {
  it('requires an api key and workspace slug', () => {
    assert.throws(() => new PlaneIntegration({ apiKey: ' ', workspaceSlug: 'acme' }), /apiKey/);
    assert.throws(() => new PlaneIntegration({ apiKey: 'k', workspaceSlug: '' }), /workspaceSlug/);
  });

  it('reports diagnostics without the api key', () => {
    const d = new PlaneIntegration({ ...base, baseUrl: 'http://localhost' }).diagnostics();
    assert.deepEqual(d, { configured: true, workspaceSlug: 'acme', baseUrl: 'http://localhost' });
    assert.equal(JSON.stringify(d).includes('"k"'), false);
  });

  it('defaults to Plane Cloud', () => {
    assert.equal(new PlaneIntegration(base).diagnostics().baseUrl, 'https://api.plane.so');
  });

  it('passes env to the client and caches tools', async () => {
    let created = 0;
    let seen: Record<string, string> = {};
    const tools = { plane_list_projects: {} };
    const plane = new PlaneIntegration({
      ...base,
      baseUrl: 'http://localhost',
      createClient: env => {
        created++;
        seen = env;
        return { listTools: async () => tools, disconnect: async () => {} };
      },
    });
    assert.equal(await plane.agentTools(), tools);
    assert.equal(await plane.agentTools(), tools);
    assert.equal(created, 1);
    assert.deepEqual(seen, { PLANE_API_KEY: 'k', PLANE_WORKSPACE_SLUG: 'acme', PLANE_BASE_URL: 'http://localhost' });
  });

  it('omits PLANE_BASE_URL when unset', async () => {
    let seen: Record<string, string> = {};
    const plane = new PlaneIntegration({
      ...base,
      createClient: env => ((seen = env), { listTools: async () => ({}), disconnect: async () => {} }),
    });
    await plane.agentTools();
    assert.equal('PLANE_BASE_URL' in seen, false);
  });

  it('returns no tools on failure and retries next time', async () => {
    let calls = 0;
    const plane = new PlaneIntegration({
      ...base,
      createClient: () => ({
        listTools: async () => {
          if (++calls === 1) throw new Error('uvx missing');
          return { ok: {} };
        },
        disconnect: async () => {},
      }),
    });
    const log = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await plane.agentTools(), {});
    } finally {
      console.error = log;
    }
    assert.deepEqual(await plane.agentTools(), { ok: {} });
  });

  it('disconnects on shutdown', async () => {
    let disconnected = false;
    const plane = new PlaneIntegration({
      ...base,
      createClient: () => ({ listTools: async () => ({}), disconnect: async () => void (disconnected = true) }),
    });
    await plane.agentTools();
    await plane.shutdown();
    assert.equal(disconnected, true);
  });
});
