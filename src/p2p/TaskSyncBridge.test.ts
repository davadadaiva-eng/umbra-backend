import { eventBus } from '../core/EventBus';
import { Task } from '../types';
import { TaskSyncBridge } from './TaskSyncBridge';

describe('TaskSyncBridge', () => {
  const makeTask = (id: string, status: Task['status']): Task => ({
    id,
    description: `task ${id}`,
    status,
    priority: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });

  it('broadcasts lifecycle events with a compact snapshot', () => {
    const sent: any[] = [];
    const bridge = new TaskSyncBridge({
      broadcast: msg => sent.push(msg),
      getTask: id => makeTask(id, 'executing'),
    });
    bridge.start();

    eventBus.emit('task:created', 't-1');
    eventBus.emit('task:progress', 't-1', 3);

    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      t: 'task-event',
      event: 'task:created',
      task: { id: 't-1', description: 'task t-1', status: 'executing' },
    });
    expect(sent[1]).toMatchObject({
      event: 'task:progress',
      task: { id: 't-1', progress: 3 },
    });

    bridge.stop();
  });

  it('carries the failure reason from the task:failed payload', () => {
    const sent: any[] = [];
    const bridge = new TaskSyncBridge({
      broadcast: msg => sent.push(msg),
      getTask: () => undefined,
    });
    bridge.start();

    eventBus.emit('task:failed', 't-2', 'plan limit reached');
    expect(sent[0]).toMatchObject({
      event: 'task:failed',
      task: { id: 't-2', error: 'plan limit reached' },
    });

    bridge.stop();
  });

  it('stops broadcasting after stop()', () => {
    const sent: any[] = [];
    const bridge = new TaskSyncBridge({ broadcast: msg => sent.push(msg) });
    bridge.start();
    bridge.stop();

    eventBus.emit('task:created', 't-3');
    expect(sent).toHaveLength(0);
  });
});
