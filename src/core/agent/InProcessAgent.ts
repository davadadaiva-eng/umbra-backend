/**
 * InProcessAgent — a self-contained agentic reasoning loop that runs entirely
 * inside Umbra (no external CLI). It is the fallback for Hermes delegation:
 * when the `hermes` binary is not installed, delegated agentic tasks ("deep
 * research", "write this module", "audit this codebase") still work using the
 * app's own LLM provider + the same tool surface as the step loop.
 *
 * The loop is a bounded ReAct cycle: each turn the model emits either a JSON
 * tool call ({action, action_input}) or a final answer ({answer}). Tool
 * results are fed back as messages until the model answers or the turn/time
 * budget is exhausted.
 */

import { LLMMessage, LLMCompletionResult } from './LLMConnector';

export interface InProcessAgentTools {
  /** Call a catalog connector through the MCP router. */
  mcpCall?: (skill: string, tool: string, input: Record<string, unknown>) => Promise<{ ok: boolean; output: unknown; error?: string }>;
  /** Search the recall/knowledge graph. */
  searchKnowledge?: (query: string) => Promise<unknown>;
  /** Open a web search and return the page text. */
  webSearch?: (query: string) => Promise<string>;
  /** Read a local file (sandboxed workspace). */
  fileRead?: (path: string) => Promise<string>;
  /** Write a local file (sandboxed workspace). */
  fileWrite?: (path: string, content: string) => Promise<{ bytes: number; path: string }>;
  /** Run a shell command in a repo. */
  repoRun?: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; code: number }>;
}

export interface InProcessAgentOptions {
  llm: {
    complete(
      messages: LLMMessage[],
      role?: 'reasoning' | 'vision' | 'fast',
      options?: { model?: string; temperature?: number; maxTokens?: number },
    ): Promise<LLMCompletionResult>;
  };
  tools?: InProcessAgentTools;
  /** Max model turns before giving up (default 8). */
  maxTurns?: number;
  /** Hard wall-clock timeout for the whole run (default 180s). */
  timeoutMs?: number;
  /** Optional model override for the reasoning calls. */
  model?: string;
}

export interface InProcessAgentResult {
  ok: boolean;
  output: string;
  turns: number;
  durationMs: number;
  timedOut?: boolean;
  error?: string;
}

const DEFAULT_MAX_TURNS = 8;
const DEFAULT_TIMEOUT_MS = 180_000;

/** Robustly pull a JSON object out of an LLM reply (handles fenced blocks). */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  let candidate = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function buildSystemPrompt(tools: InProcessAgentTools): string {
  const names = Object.entries(tools)
    .filter(([, fn]) => typeof fn === 'function')
    .map(([key]) => key);
  const toolDocs: Record<string, string> = {
    mcpCall: 'mcpCall: call a connected external tool/connector. Input: {skill, tool, input}',
    searchKnowledge: 'searchKnowledge: search Umbra\'s memory/knowledge graph. Input: {query}',
    webSearch: 'webSearch: search the web and return the top page text. Input: {query}',
    fileRead: 'fileRead: read a local file. Input: {path}',
    fileWrite: 'fileWrite: write a local file. Input: {path, content}',
    repoRun: 'repoRun: run a shell command inside the workspace. Input: {command, cwd?}',
  };
  const available = names.map(n => toolDocs[n] ?? `${n}: available tool`).join('\n');
  return `You are Umbra, an autonomous agent. Complete the user's task by choosing actions yourself.

AVAILABLE TOOLS:
${available || '(none — answer directly)'}

RULES:
- Work toward a complete, correct result. Prefer acting over guessing.
- Keep tool inputs compact; if a tool result is long, summarize the relevant part.
- When you are done, reply with ONLY a JSON object: {"answer": "your final answer"}.
- For every action, reply with ONLY a JSON object: {"action": "toolName", "action_input": { ... }}.
- Do NOT use markdown fences around the JSON. No prose outside the JSON.`;
}

function truncate(text: string, max = 2000): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]` : text;
}

export class InProcessAgent {
  private options: InProcessAgentOptions;
  private maxTurns: number;
  private timeoutMs: number;

  constructor(options: InProcessAgentOptions) {
    this.options = options;
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async run(prompt: string): Promise<InProcessAgentResult> {
    const started = Date.now();
    const tools = this.options.tools ?? {};
    const messages: LLMMessage[] = [
      { role: 'system', content: buildSystemPrompt(tools) },
      { role: 'user', content: prompt },
    ];

    const deadline = Date.now() + this.timeoutMs;
    let turns = 0;

    for (; turns < this.maxTurns; turns++) {
      if (Date.now() > deadline) {
        return { ok: false, output: '', turns, durationMs: Date.now() - started, timedOut: true, error: `Agent loop timed out after ${Math.round(this.timeoutMs / 1000)}s` };
      }

      const res = await this.options.llm.complete(messages, 'reasoning', {
        model: this.options.model,
        temperature: 0.2,
        maxTokens: 1200,
      });
      const reply = res.content.trim();

      const parsed = extractJsonObject(reply);
      if (!parsed) {
        // Model didn't follow the JSON contract — treat the raw reply as the answer.
        return { ok: true, output: truncate(reply, 4000), turns: turns + 1, durationMs: Date.now() - started };
      }
      if (parsed.answer !== undefined) {
        return { ok: true, output: truncate(String(parsed.answer), 4000), turns: turns + 1, durationMs: Date.now() - started };
      }
      const action = String(parsed.action || '').trim();
      const input = (parsed.action_input && typeof parsed.action_input === 'object' ? parsed.action_input : {}) as Record<string, unknown>;
      if (!action) {
        return { ok: true, output: truncate(reply, 4000), turns: turns + 1, durationMs: Date.now() - started };
      }

      const toolResult = await this.runTool(tools, action, input, deadline);
      messages.push({ role: 'assistant', content: reply });
      messages.push({
        role: 'user',
        content: `Tool result for ${action}:\n${truncate(toolResult, 3000)}\n\nContinue: either call another tool or reply {"answer": "..."}.`,
      });
    }

    return { ok: false, output: '', turns, durationMs: Date.now() - started, error: `Agent loop exceeded ${this.maxTurns} turns — giving up` };
  }

  private async runTool(tools: InProcessAgentTools, action: string, input: Record<string, unknown>, deadline: number): Promise<string> {
    if (Date.now() > deadline) return 'TIMED_OUT';
    try {
      switch (action) {
        case 'mcpCall': {
          if (!tools.mcpCall) return `Tool unavailable: ${action}`;
          const skill = String(input.skill || input.connector || '');
          const tool = String(input.tool || 'invoke');
          const callInput = (input.input && typeof input.input === 'object' ? input.input : {}) as Record<string, unknown>;
          if (!skill) return 'mcpCall requires action_input.skill';
          const r = await tools.mcpCall(skill, tool, callInput);
          return r.ok ? `OK: ${typeof r.output === 'string' ? r.output : JSON.stringify(r.output)}` : `ERROR: ${r.error || 'call failed'}`;
        }
        case 'searchKnowledge': {
          if (!tools.searchKnowledge) return `Tool unavailable: ${action}`;
          const q = String(input.query || '');
          if (!q) return 'searchKnowledge requires action_input.query';
          const r = await tools.searchKnowledge(q);
          return `OK: ${JSON.stringify(r)}`;
        }
        case 'webSearch': {
          if (!tools.webSearch) return `Tool unavailable: ${action}`;
          const q = String(input.query || '');
          if (!q) return 'webSearch requires action_input.query';
          return await tools.webSearch(q);
        }
        case 'fileRead': {
          if (!tools.fileRead) return `Tool unavailable: ${action}`;
          return await tools.fileRead(String(input.path || ''));
        }
        case 'fileWrite': {
          if (!tools.fileWrite) return `Tool unavailable: ${action}`;
          const r = await tools.fileWrite(String(input.path || ''), String(input.content ?? ''));
          return `OK: wrote ${r.bytes} bytes to ${r.path}`;
        }
        case 'repoRun': {
          if (!tools.repoRun) return `Tool unavailable: ${action}`;
          const r = await tools.repoRun(String(input.command || ''), input.cwd !== undefined ? String(input.cwd) : undefined);
          const out = [r.stdout, r.stderr].filter(Boolean).join('\n');
          return `Exit ${r.code}${out ? `:\n${truncate(out, 1500)}` : ''}`;
        }
        default:
          return `Unknown action: ${action}`;
      }
    } catch (err: any) {
      return `ERROR: ${err.message}`;
    }
  }
}
