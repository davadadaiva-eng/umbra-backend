import { InProcessAgent, extractJsonObject } from './InProcessAgent';

function fakeLlm(responses: string[]) {
  let i = 0;
  return {
    complete: async () => {
      const content = responses[Math.min(i, responses.length - 1)];
      i++;
      return { content, modelUsed: 'fake', totalTokens: 10, finishReason: 'stop' };
    },
  };
}

describe('extractJsonObject', () => {
  it('parses a plain object', () => {
    expect(extractJsonObject('{"answer":"hi"}')).toEqual({ answer: 'hi' });
  });
  it('parses a fenced json block', () => {
    expect(extractJsonObject('```json\n{"action":"webSearch","action_input":{"query":"x"}}\n```')).toEqual({
      action: 'webSearch',
      action_input: { query: 'x' },
    });
  });
  it('returns null for non-object text', () => {
    expect(extractJsonObject('just words')).toBeNull();
  });
});

describe('InProcessAgent', () => {
  it('answers directly when the model returns an answer', async () => {
    const agent = new InProcessAgent({ llm: fakeLlm(['{"answer":"done"}']) });
    const res = await agent.run('do a thing');
    expect(res.ok).toBe(true);
    expect(res.output).toBe('done');
    expect(res.turns).toBe(1);
  });

  it('chains tool calls and finishes with an answer', async () => {
    const toolResults: string[] = [];
    const agent = new InProcessAgent({
      llm: fakeLlm([
        '{"action":"webSearch","action_input":{"query":"q1"}}',
        '{"action":"mcpCall","action_input":{"skill":"search-research","tool":"invoke","input":{"q":"x"}}}',
        '{"answer":"found it"}',
      ]),
      tools: {
        webSearch: async q => {
          toolResults.push(q);
          return `results for ${q}`;
        },
        mcpCall: async (_s, _t) => {
          toolResults.push('mcp');
          return { ok: true, output: { hits: 3 } };
        },
      },
    });
    const res = await agent.run('research');
    expect(res.ok).toBe(true);
    expect(res.output).toBe('found it');
    expect(toolResults).toEqual(['q1', 'mcp']);
    expect(res.turns).toBe(3);
  });

  it('surfaces tool errors back to the model and keeps going', async () => {
    const agent = new InProcessAgent({
      llm: fakeLlm([
        '{"action":"webSearch","action_input":{"query":"q"}}',
        '{"answer":"recovered"}',
      ]),
      tools: {
        webSearch: async () => {
          throw new Error('boom');
        },
      },
    });
    const res = await agent.run('t');
    expect(res.ok).toBe(true);
    expect(res.output).toBe('recovered');
  });

  it('returns the raw reply when the model breaks the JSON contract', async () => {
    const agent = new InProcessAgent({ llm: fakeLlm(['I will just tell you: 42']) });
    const res = await agent.run('t');
    expect(res.ok).toBe(true);
    expect(res.output).toContain('42');
  });

  it('gives up after maxTurns', async () => {
    const agent = new InProcessAgent({
      llm: fakeLlm(['{"action":"webSearch","action_input":{"query":"q"}}']),
      maxTurns: 3,
      tools: { webSearch: async () => 'more results' },
    });
    const res = await agent.run('loop');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('turns');
  });

  it('honors the wall-clock timeout', async () => {
    const agent = new InProcessAgent({
      llm: {
        complete: async () => {
          await new Promise(r => setTimeout(r, 200));
          return { content: '{"action":"webSearch","action_input":{"query":"q"}}', modelUsed: 'f', totalTokens: 1, finishReason: 'stop' };
        },
      },
      timeoutMs: 50,
      maxTurns: 10,
      tools: { webSearch: async () => 'x' },
    });
    const res = await agent.run('slow');
    expect(res.ok).toBe(false);
    expect(res.timedOut).toBe(true);
  });
});
