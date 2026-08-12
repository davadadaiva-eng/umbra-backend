/**
 * McpHttpConnector — a real MCP (Model Context Protocol) JSON-RPC client for
 * remote HTTP endpoints.
 *
 * Speaks the streamable-HTTP subset of the MCP protocol:
 *   - POST JSON-RPC 2.0 requests with `MCP-Protocol-Version`
 *   - `tools/call` for tool invocation, `initialize` handshake when the server
 *     demands it (retried once automatically)
 *   - resolves credentials lazily from the CredentialVault and attaches them
 *     using the connector's configured auth scheme and header name
 *
 * Plain JSON endpoints that don't speak JSON-RPC are tolerated: the response
 * body is returned as-is, so connectors can wrap simple REST APIs too.
 */

import { McpToolBinding } from './McpRegistry';
import { CredentialVault } from '../vault/CredentialVault';
import { getLogger } from '../Logger';

export interface HttpCallOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export type CredentialResolver = (service: string) => { username: string; secret: string } | undefined;

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string;
  result?: {
    content?: Array<{ type: string; text?: string; image?: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  error?: { code?: number; message?: string };
}

const PROTOCOL_VERSION = '2025-06-18';

export class McpHttpConnector {
  private vault?: CredentialVault;
  private resolver?: CredentialResolver;
  private timeoutMs: number;
  private nextId: number = 1;

  constructor(options: { vault?: CredentialVault; resolver?: CredentialResolver; timeoutMs?: number } = {}) {
    this.vault = options.vault;
    this.resolver = options.resolver;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async call(binding: McpToolBinding, input: Record<string, unknown>, options: HttpCallOptions = {}): Promise<unknown> {
    if (!binding.endpoint) throw new Error(`No endpoint for ${binding.key}`);

    const cred = this.resolveCredential(binding);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream',
      'user-agent': 'umbra-os/mcp',
      'mcp-protocol-version': PROTOCOL_VERSION,
      ...options.headers,
    };
    Object.assign(headers, this.authHeaders(binding, cred));

    let body: JsonRpcResponse;
    try {
      body = await this.request(binding.endpoint, 'tools/call', {
        name: binding.tool,
        arguments: input,
      }, headers, options.timeoutMs ?? this.timeoutMs);
      // Some servers answer tools/call with a JSON-RPC error until the client
      // has performed the initialize handshake — surface it as a throw so the
      // retry path below can handshake and try again.
      if (body.error && this.isInitializationRequired(body.error.message || '')) {
        throw new Error(`MCP initialize required: ${body.error.message}`);
      }
    } catch (err: any) {
      // Servers that require an initialize handshake reject tools/call first.
      // Perform the handshake once, then retry the call.
      if (this.isInitializationRequired(err.message)) {
        getLogger().debug({ endpoint: binding.endpoint }, 'MCP server requires initialize handshake');
        try {
          await this.initialize(binding.endpoint, headers, options.timeoutMs ?? this.timeoutMs);
        } catch (initErr: any) {
          throw new Error(`MCP initialize failed: ${initErr.message}`);
        }
        body = await this.request(binding.endpoint, 'tools/call', {
          name: binding.tool,
          arguments: input,
        }, headers, options.timeoutMs ?? this.timeoutMs);
      } else {
        throw err;
      }
    }

    if (body.error) {
      throw new Error(`MCP ${binding.key} error ${body.error.code ?? ''}: ${body.error.message || 'unknown error'}`);
    }
    return this.normalize(body);
  }

  private async initialize(endpoint: string, headers: Record<string, string>, timeoutMs: number): Promise<JsonRpcResponse> {
    return this.request(endpoint, 'initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'umbra-os', version: '0.1.0' },
    }, headers, timeoutMs);
  }

  private async request(
    endpoint: string,
    method: string,
    params: Record<string, unknown>,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<JsonRpcResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, params }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`MCP ${endpoint} returned ${res.status}`);
      }
      const text = await res.text();
      if (!text) return { jsonrpc: '2.0', result: { content: [] } };
      try {
        return JSON.parse(text) as JsonRpcResponse;
      } catch {
        // Not JSON — tolerate as a plain-text result.
        return { jsonrpc: '2.0', result: { content: [{ type: 'text', text }] } };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Pull the text out of an MCP result while preserving structured data. */
  private normalize(body: JsonRpcResponse): unknown {
    const result = body.result;
    if (!result) return body;
    const texts = (result.content ?? [])
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text as string);
    const text = texts.join('\n');
    if (result.isError) throw new Error(text || 'MCP tool returned an error result');
    if (text) return text;
    if (result.structuredContent) return result.structuredContent;
    return result;
  }

  private authHeaders(
    binding: McpToolBinding,
    cred?: { username: string; secret: string },
  ): Record<string, string> {
    if (!cred) return {};
    const header = binding.apiKeyHeader || 'Authorization';

    if (binding.authType === 'apiKey') {
      // Conventional "Authorization: Bearer" is treated as a bearer token even
      // when the catalog classifies it as apiKey; custom headers get the raw key.
      return { [header]: header.toLowerCase() === 'authorization' ? `Bearer ${cred.secret}` : cred.secret };
    }
    if (cred.username && cred.username !== 'api-key') {
      // A vault entry with a real username is a user/password service (Basic).
      return { 'authorization': `Basic ${Buffer.from(`${cred.username}:${cred.secret}`).toString('base64')}` };
    }
    return { [header]: `Bearer ${cred.secret}` };
  }

  private resolveCredential(binding: McpToolBinding): { username: string; secret: string } | undefined {
    if (!binding.credentialService) return undefined;
    if (this.vault && this.vault.isUnlocked) {
      const entry = this.vault.find(binding.credentialService);
      if (entry) return { username: entry.username, secret: entry.secret };
    }
    if (this.resolver) return this.resolver(binding.credentialService);
    return undefined;
  }

  private isInitializationRequired(message: string): boolean {
    return /not initialized|initialize|MCP-Protocol|invalid method|Invalid Request/i.test(message);
  }
}
