import { MeetingCompanion } from './MeetingCompanion';

function make(overrides: Partial<ConstructorParameters<typeof MeetingCompanion>[0]> = {}) {
  return new MeetingCompanion({
    stt: { transcribe: jest.fn().mockResolvedValue({ text: 'hello from meeting' }) },
    recorder: { record: jest.fn().mockResolvedValue(Buffer.from('wav')) },
    onJoin: jest.fn().mockResolvedValue('opened chrome'),
    onExecute: jest.fn().mockResolvedValue('did action'),
    summarize: jest.fn().mockResolvedValue('meeting summary'),
    ...overrides,
  } as any);
}

describe('MeetingCompanion', () => {
  it('joins a meeting and dispatches to the browser', async () => {
    const c = make();
    const s = await c.join('https://meet.example/abc');
    expect(s.status).toBe('joined');
    expect(s.url).toBe('https://meet.example/abc');
  });

  it('feeds audio into the live transcript', async () => {
    const c = make();
    await c.join('https://meet.example/abc');
    const seg = await c.feedAudio(Buffer.from('audio'), 'wav');
    expect(seg.text).toBe('hello from meeting');
    expect(c.status()!.transcript).toHaveLength(1);
  });

  it('executes a desktop action while in the meeting', async () => {
    const c = make();
    await c.join('https://meet.example/abc');
    const res = await c.execute('share_screen', {});
    expect(res).toBe('did action');
  });

  it('leaves and produces summary + action items from the transcript', async () => {
    const c = make({
      stt: { transcribe: jest.fn().mockResolvedValue({ text: 'I will send the report by Friday' }) },
    });
    await c.join('https://meet.example/abc');
    await c.feedAudio(Buffer.from('audio'), 'wav');
    const out = await c.leave();
    expect(out.summary).toBe('meeting summary');
    expect(out.session.status).toBe('left');
    expect(out.actionItems.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects a second join while already in a meeting', async () => {
    const c = make();
    await c.join('https://a.example');
    await expect(c.join('https://b.example')).rejects.toThrow(/Already in a meeting/);
  });

  it('requires an STT engine + recorder to start listening', async () => {
    const c = make({ stt: undefined, recorder: undefined });
    await c.join('https://meet.example/abc');
    expect(() => c.startListening()).toThrow(/needs a loopback recorder/);
  });

  it('executes orders heard in the transcript', async () => {
    const onShareScreen = jest.fn().mockResolvedValue('sharing now');
    const c = make({
      stt: { transcribe: jest.fn().mockResolvedValue({ text: 'Hey Umbra, share your screen' }) },
      onShareScreen,
    });
    await c.join('https://meet.example/abc');
    await c.feedAudio(Buffer.from('audio'), 'wav');
    expect(onShareScreen).toHaveBeenCalled();
    expect(c.status()!.sharing).toBe(true);
    const orders = c.getOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].intent).toBe('share_screen');
    expect(orders[0].status).toBe('done');
  });

  it('records a note order and keeps it in-session', async () => {
    const c = make({
      stt: { transcribe: jest.fn().mockResolvedValue({ text: 'Ok umbra take a note about the deadline' }) },
    });
    await c.join('https://meet.example/abc');
    await c.feedAudio(Buffer.from('audio'), 'wav');
    expect(c.getNotes()).toContain('take a note about the deadline');
  });

  it('does not execute orders when ordersEnabled is false', async () => {
    const onShareScreen = jest.fn().mockResolvedValue('sharing now');
    const c = make({
      stt: { transcribe: jest.fn().mockResolvedValue({ text: 'Hey Umbra, share your screen' }) },
      onShareScreen,
      ordersEnabled: false,
    });
    await c.join('https://meet.example/abc');
    await c.feedAudio(Buffer.from('audio'), 'wav');
    expect(onShareScreen).not.toHaveBeenCalled();
    expect(c.getOrders()).toHaveLength(0);
  });

  it('shares and stops sharing via explicit calls', async () => {
    const onShareScreen = jest.fn().mockResolvedValue('sharing now');
    const onStopShare = jest.fn().mockResolvedValue('stopped');
    const c = make({ onShareScreen, onStopShare });
    await c.join('https://meet.example/abc');
    expect(await c.shareScreen('screen')).toBe('sharing now');
    expect(c.status()!.sharing).toBe(true);
    expect(await c.stopShare()).toBe('stopped');
    expect(c.status()!.sharing).toBe(false);
  });

  it('falls back to onExecute for screen sharing when no onShareScreen is set', async () => {
    const onExecute = jest.fn().mockResolvedValue('did action');
    const c = make({ onExecute });
    await c.join('https://meet.example/abc');
    await c.shareScreen();
    expect(onExecute).toHaveBeenCalledWith('share_screen', { target: undefined });
  });
});
