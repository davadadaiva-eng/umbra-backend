import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRuntime } from './AgentRuntime';
import { TaskPlanner } from './TaskPlanner';
import { SkillRouter } from '../skill/SkillRouter';
import { SkillRecorder } from '../skill/SkillRecorder';
import { MeteringService } from '../metering/MeteringService';
import { GraphifyContextEngine } from '../graphify/GraphifyContextEngine';
import { McpRegistry } from '../mcp/McpRegistry';
import { McpRouter } from '../mcp/McpRouter';
import { Task } from '../../types';

const tmpDirs: string[] = [];

function makeTempDir(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  tmpDirs.push(dir);
  return dir;
}

function makeFakeLlm(overrides: any = {}) {
  return {
    complete: jest.fn(async () => ({ content: 'skill answer', modelUsed: 'fake', totalTokens: 42, finishReason: 'stop' })),
    createEmbedding: async () => [],
    updateConfig: () => {},
    ...overrides,
  };
}

function makeFakeKnowledge(overrides: any = {}) {
  return {
    search: jest.fn(async () => []),
    learnFromExecution: async () => {},
    ...overrides,
  };
}

function makeRuntime(patch: any = {}, overrides: any = {}): { runtime: AgentRuntime; llm: any } {
  const llm = makeFakeLlm(overrides.llm);
  const knowledge = makeFakeKnowledge(overrides.knowledge);
  const planner = new TaskPlanner(knowledge as any, llm as any);
  const runtime = new AgentRuntime(llm as any, knowledge, planner);
  runtime.registerSubsystems(patch);
  return { runtime, llm };
}

function makeTask(description: string): Task {
  return { id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, description, status: 'pending', priority: 0, createdAt: new Date() };
}

function makePlanned(action: string, params: Record<string, unknown>) {
  return { description: action, action, params, requiresKnowledge: [] };
}

afterAll(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe('AgentRuntime skill integration', () => {
  it('routes intent to a stack skill, dispatches MCP tool, and records invocation', async () => {
    const dataDir = makeTempDir('agent-skills');
    const registry = new McpRegistry();
    registry.register('sales.follow-up-drafting', 'execute', { transport: 'prompt' });

    const recorder = new SkillRecorder({ dataDir });
    const { runtime } = makeRuntime({
      skillRouter: new SkillRouter(),
      skillRecorder: recorder,
      mcpRouter: new McpRouter(registry),
    });

    const task = makeTask('draft a follow up email to the prospect');
    const step = await (runtime as any).executeStep(task, makePlanned('skill', { intent: 'please draft a follow up email to the prospect', tool: 'execute' }), 0);

    expect(step.result).toContain('sales.follow-up-drafting');
    expect(step.result).toContain('Tool sales.follow-up-drafting.execute');
    expect(step.result).toContain('skill answer');
    expect(recorder.stats()[0].skill).toBe('sales.follow-up-drafting');
  });

  it('reports no confident match and still records the failure', async () => {
    const dataDir = makeTempDir('agent-skills');
    const recorder = new SkillRecorder({ dataDir });
    const { runtime } = makeRuntime({ skillRouter: new SkillRouter(), skillRecorder: recorder });

    const task = makeTask('do something completely exotic');
    const step = await (runtime as any).executeStep(task, makePlanned('skill', { intent: 'do something completely exotic' }), 0);

    expect(step.result).toContain('No matching skill found');
    expect(recorder.stats()[0].skill).toBe('none');
    expect(recorder.stats()[0].errorRate).toBe(1);
  });

  it('skill_learn records a user-taught skill invocation', async () => {
    const dataDir = makeTempDir('agent-skills');
    const recorder = new SkillRecorder({ dataDir });
    const { runtime } = makeRuntime({ skillRecorder: recorder });

    const task = makeTask('learn');
    await (runtime as any).executeStep(task, makePlanned('skill_learn', { skill: 'personal.reminders', note: 'tracked' }), 0);

    expect(recorder.stats()[0].skill).toBe('personal.reminders');
  });

  it('blocks a task when the plan session limit is reached', async () => {
    const dataDir = makeTempDir('agent-skills');
    const metering = new MeteringService({ dataDir, tier: 'free' });
    metering.openSession();
    const { runtime } = makeRuntime({ metering });

    const task = makeTask('hello');
    await (runtime as any).executeTask(task);

    expect(task.status).toBe('failed');
    expect(task.error).toContain('Session limit reached');
  });

  it('lets a task run when a session is available and releases it after', async () => {
    const dataDir = makeTempDir('agent-skills');
    const metering = new MeteringService({ dataDir, tier: 'free' });
    const { runtime } = makeRuntime({ metering });

    const task = makeTask('hello');
    await (runtime as any).executeTask(task);
    expect(task.status).toBe('pending'); // unknown actions fall back to clarification
    expect(metering.snapshot().activeSessions).toBe(0);
  });

  it('graphifies large think-step context before the LLM call', async () => {
    const llm = makeFakeLlm();
    const knowledge = makeFakeKnowledge({ search: jest.fn(async () => [{ id: 'n1', title: 'T'.repeat(3000) }]) });
    const planner = new TaskPlanner(knowledge as any, llm as any);
    const runtime = new AgentRuntime(llm as any, knowledge, planner);
    runtime.registerSubsystems({
      graphify: new GraphifyContextEngine({ summarize: async text => text.substring(0, 100) }),
    });

    const result = await (runtime as any).thinkStep('think about X', {});
    expect(result).toBe('skill answer');

    const systemMsg: string = llm.complete.mock.calls[0][0][0].content;
    expect(systemMsg).toContain('[graphified:');

    const match = systemMsg.match(/\[graphified: (\d+)→(\d+) tokens/);
    expect(match).toBeTruthy();
    expect(match![1] === match![2]).toBe(false);
  });
});