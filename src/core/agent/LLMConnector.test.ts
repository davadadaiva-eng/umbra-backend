import { LLMConnector } from './LLMConnector';

function configWith(provider: 'openai' | 'anthropic', extra: Record<string, unknown> = {}) {
  return {
    provider,
    models: { provider, reasoning: 'model-r', vision: 'model-v', fast: 'model-f' },
    openai: provider === 'openai' ? { endpoint: 'http://fake/v1', apiKey: 'sk-test' } : undefined,
    anthropic: provider === 'anthropic' ? { apiKey: 'sk-ant-test' } : undefined,
    ...extra,
  } as any;
}

describe('LLMConnector', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('adds an ephemeral cache_control on the Anthropic system prompt (prompt caching)', async () => {
    let body: any;
    global.fetch = (async (_url: any, init: any) => {
      body = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: 'text', text: 'ok' }],
          model: 'claude-x',
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: 'end_turn',
        }),
      };
    }) as any;

    const llm = new LLMConnector(configWith('anthropic'));
    await llm.complete(
      [
        { role: 'system', content: 'You are Umbra.' },
        { role: 'user', content: 'hi' },
      ],
      'reasoning',
    );

    expect(body.system).toEqual([
      { type: 'text', text: 'You are Umbra.', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('keeps the OpenAI payload cache-agnostic (natural prefix caching)', async () => {
    let body: any;
    global.fetch = (async (_url: any, init: any) => {
      body = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          model: 'gpt-x',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      };
    }) as any;

    const llm = new LLMConnector(configWith('openai'));
    await llm.complete([{ role: 'user', content: 'hi' }], 'fast');
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toBe('hi');
  });
});
