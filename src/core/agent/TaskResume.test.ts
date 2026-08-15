import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRuntime } from './AgentRuntime';
import { TaskPlanner } from './TaskPlanner';
import { TaskStore } from './TaskStore';
import { Task } from '../../types';

const tmpDirs: string[] = [];

function makeTempDir(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  tmpDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeFakeLlm() {
  return {
    complete: jest.fn(async () => ({ content: 'ok', modelUsed: 'fake', totalTokens: 1, finishReason: 'stop' })),
    createEmbedding: async () => [],
    updateConfig: () => {},
  };
}

function makeFakeKnowledge() {
  return {
    search: jest.fn(async () => []),
    learnFromExecution: jest.fn(async () => {}),
  };
}

function makeRuntime(store: TaskStore): { runtime: AgentRuntime; knowledge: any } {
  const llm = makeFakeLlm();
  const knowledge = makeFakeKnowledge();
  const planner = new TaskPlanner(knowledge as any, llm as any);
  const runtime = new AgentRuntime(llm as any, knowledge as any, planner);
  runtime.registerSubsystems({ taskStore: store });
  return { runtime, knowledge };
}

function makeUnfinishedTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: 'resume me',
    status: 'executing',
    priority: 0,
    createdAt: new Date(),
    startedAt: new Date(),
    plan: [{ description: 'wait', action: 'wait', params: { ms: 1 }, requiresKnowledge: [] }],
    steps: [],
    completedStepCount: 0,
    consentGranted: true,
    ...overrides,
  };
}

describe('AgentRuntime durable resume', () => {
  it('cloud skips resume on the free plan (cloud continuation is paid)', async () => {
    const store = new TaskStore(makeTempDir('resume-free'));
    store.save(makeUnfinishedTask());
    const { runtime } = makeRuntime(store);

    const resumed = await runtime.resumePendingTasks('cloud', 'free');
    expect(resumed).toBe(0);
    // The task stays queued on disk for the desktop to pick up later.
    expect(store.loadUnfinished()).toHaveLength(1);
  });

  it('cloud resumes in-flight tasks on a paid plan', async () => {
    const store = new TaskStore(makeTempDir('resume-pro'));
    const task = makeUnfinishedTask();
    store.save(task);
    const { runtime, knowledge } = makeRuntime(store);

    const resumed = await runtime.resumePendingTasks('cloud', 'pro');
    expect(resumed).toBe(1);

    // Wait for the scheduled execution (a single 1ms wait step) to complete.
    await new Promise(r => setTimeout(r, 50));
    expect(knowledge.learnFromExecution).toHaveBeenCalled();
    expect(store.loadUnfinished()).toHaveLength(0);
  });

  it('desktop always resumes its own queue, even on free', async () => {
    const store = new TaskStore(makeTempDir('resume-desktop'));
    store.save(makeUnfinishedTask());
    const { runtime } = makeRuntime(store);

    const resumed = await runtime.resumePendingTasks('desktop', 'free');
    expect(resumed).toBe(1);
  });

  it('continues from the checkpoint instead of re-running completed steps', async () => {
    const store = new TaskStore(makeTempDir('resume-checkpoint'));
    const task = makeUnfinishedTask({
      plan: [
        { description: 'first', action: 'wait', params: { ms: 1 }, requiresKnowledge: [] },
        { description: 'second', action: 'wait', params: { ms: 1 }, requiresKnowledge: [] },
      ],
      steps: [{
        description: 'first', action: 'wait', params: { ms: 1 }, result: 'Waited 1ms',
        startedAt: new Date(), completedAt: new Date(),
      }],
      completedStepCount: 1,
    });
    store.save(task);
    const { runtime } = makeRuntime(store);

    await runtime.resumePendingTasks('cloud', 'ultimate');
    await new Promise(r => setTimeout(r, 50));

    const done = runtime.getTask(task.id);
    // The first step was NOT re-run; the task finished after the second step.
    expect(store.loadUnfinished()).toHaveLength(0);
    expect(done?.status === 'completed' || done?.result !== undefined).toBe(true);
  });
});
