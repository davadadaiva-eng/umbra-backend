/**
 * MCP Registry — catalog of every tool reachable through the model-context
 * protocol, regardless of transport (HTTP endpoint, native binding, or
 * prompt-injected). The router resolves calls against this registry.
 */

import { CompiledSkill, McpRegistryEntry } from '../skill/SkillCompiler';

export type McpTransport = 'http' | 'native' | 'prompt';

export interface McpToolBinding {
  key: string;
  skill: string;
  tool: string;
  transport: McpTransport;
  /** HTTP endpoints use vault-backed credentials via a resolver. */
  endpoint?: string;
  credentialService?: string;
  method?: string;
}

export interface RegisterToolOptions {
  skill?: string;
  endpoint?: string;
  credentialService?: string;
  transport?: McpTransport;
}

export class McpRegistry {
  private tools = new Map<string, McpToolBinding>();

  register(skill: string, tool: string, options: RegisterToolOptions = {}): McpToolBinding {
    const binding: McpToolBinding = {
      key: `${skill}.${tool}`,
      skill,
      tool,
      transport: options.transport ?? (options.endpoint ? 'http' : 'prompt'),
      endpoint: options.endpoint,
      credentialService: options.credentialService,
    };
    this.tools.set(binding.key, binding);
    return binding;
  }

  registerSkill(skill: CompiledSkill): void {
    for (const entry of skill.mcpRegistry) {
      this.register(skill.name, entry.tool, {
        transport: (entry.method as McpTransport) ?? 'prompt',
      });
    }
  }

  registerEntries(entries: McpRegistryEntry[], options: RegisterToolOptions = {}): void {
    for (const entry of entries) {
      this.register(entry.skill, entry.tool, options);
    }
  }

  get(key: string): McpToolBinding | undefined {
    return this.tools.get(key);
  }

  resolve(skill: string, tool: string): McpToolBinding | undefined {
    return this.tools.get(`${skill}.${tool}`);
  }

  findByService(service: string): McpToolBinding[] {
    return [...this.tools.values()].filter(t => t.credentialService === service);
  }

  list(): McpToolBinding[] {
    return [...this.tools.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}
