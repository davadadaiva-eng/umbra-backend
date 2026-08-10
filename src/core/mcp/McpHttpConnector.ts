/**
 * McpHttpConnector — calls remote MCP-compatible HTTP endpoints, injecting
 * credentials from the vault. Secrets never leave the vault in plaintext
 * logs.
 */

import { McpToolBinding } from './McpRegistry';
import { CredentialVault } from '../vault/CredentialVault';

export interface HttpCallOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export type CredentialResolver = (service: string) => { username: string; secret: string } | undefined;

export class McpHttpConnector {
  private vault?: CredentialVault;
  private resolver?: CredentialResolver;
  private timeoutMs: number;

  constructor(options: { vault?: CredentialVault; resolver?: CredentialResolver; timeoutMs?: number } = {}) {
    this.vault = options.vault;
    this.resolver = options.resolver;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async call(binding: McpToolBinding, input: Record<string, unknown>, options: HttpCallOptions = {}): Promise<unknown> {
    if (!binding.endpoint) throw new Error(`No endpoint for ${binding.key}`);

    const cred = this.resolveCredential(binding);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'umbra-os/mcp',
      ...options.headers,
    };
    if (cred) {
      headers['authorization'] = `Basic ${Buffer.from(`${cred.username}:${cred.secret}`).toString('base64')}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);
    try {
      const res = await fetch(binding.endpoint, {
        method: binding.method ?? 'POST',
        headers,
        body: JSON.stringify({ tool: binding.tool, input }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`MCP ${binding.endpoint} returned ${res.status}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
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
}
