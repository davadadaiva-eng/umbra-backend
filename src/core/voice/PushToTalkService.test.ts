import { PushToTalkService } from './PushToTalkService';
import type { PushToTalkDeps } from './PushToTalkService';

function makeDeps(overrides: Partial<PushToTalkDeps> = {}): PushToTalkDeps {
  return {
    recorder: {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(Buffer.from('fake-audio-bytes')),
    },
    stt: { transcribe: jest.fn().mockResolvedValue({ text: 'book a flight to paris' }) },
    router: { route: jest.fn().mockResolvedValue(null) },
    submitTask: jest.fn().mockResolvedValue('task-1'),
    confirm: jest.fn(),
    ...overrides,
  };
}

describe('PushToTalkService', () => {
  it('captures on start and submits the routed intent on stop', async () => {
    const deps = makeDeps();
    const svc = new PushToTalkService(deps);

    await svc.start();
    expect(svc.isCapturing).toBe(true);
    expect(deps.recorder.start).toHaveBeenCalledTimes(1);

    await svc.stop();
    expect(svc.isCapturing).toBe(false);
    expect(deps.recorder.stop).toHaveBeenCalledTimes(1);
    expect(deps.stt.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ audio: expect.any(Buffer), format: 'wav' }),
    );
    expect(deps.router.route).toHaveBeenCalledWith('book a flight to paris');
    expect(deps.submitTask).toHaveBeenCalledWith('book a flight to paris');
    expect(deps.confirm).toHaveBeenCalledTimes(1);
  });

  it('uses the routed description when the router returns one', async () => {
    const deps = makeDeps({ router: { route: jest.fn().mockResolvedValue('travel:book_flight') } });
    const svc = new PushToTalkService(deps);

    await svc.start();
    await svc.stop();
    expect(deps.submitTask).toHaveBeenCalledWith('travel:book_flight');
  });

  it('submits the raw transcript when routing fails', async () => {
    const deps = makeDeps({ router: { route: jest.fn().mockRejectedValue(new Error('router down')) } });
    const svc = new PushToTalkService(deps);

    await svc.start();
    await svc.stop();
    expect(deps.submitTask).toHaveBeenCalledWith('book a flight to paris');
    expect(deps.confirm).toHaveBeenCalledTimes(1);
  });

  it('skips submission on an empty transcript', async () => {
    const deps = makeDeps({ stt: { transcribe: jest.fn().mockResolvedValue({ text: '   ' }) } });
    const svc = new PushToTalkService(deps);

    await svc.start();
    await svc.stop();
    expect(deps.recorder.stop).toHaveBeenCalledTimes(1);
    expect(deps.router.route).not.toHaveBeenCalled();
    expect(deps.submitTask).not.toHaveBeenCalled();
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  it('skips submission when no audio was captured', async () => {
    const deps = makeDeps({
      recorder: { start: jest.fn(), stop: jest.fn().mockResolvedValue(Buffer.alloc(0)) },
    });
    const svc = new PushToTalkService(deps);

    await svc.start();
    await svc.stop();
    expect(deps.stt.transcribe).not.toHaveBeenCalled();
    expect(deps.submitTask).not.toHaveBeenCalled();
  });

  it('ignores stop without a preceding start', async () => {
    const deps = makeDeps();
    const svc = new PushToTalkService(deps);

    await svc.stop();
    expect(deps.recorder.stop).not.toHaveBeenCalled();
    expect(deps.submitTask).not.toHaveBeenCalled();
  });

  it('recovers when capture fails to start', async () => {
    const deps = makeDeps({
      recorder: { start: jest.fn().mockRejectedValue(new Error('no audio device')), stop: jest.fn() },
    });
    const svc = new PushToTalkService(deps);

    await svc.start();
    expect(svc.isCapturing).toBe(false);
    await svc.stop();
    expect(deps.recorder.stop).not.toHaveBeenCalled();
  });
});
