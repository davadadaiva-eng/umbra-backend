/**
 * setup.ts — first-run Umbra setup. Collects the LLM provider, API key,
 * model names, and plan tier, writes them into ~/.umbra/config.json, and runs
 * a small live validation call so you know immediately whether the key works.
 *
 *   npm run setup                     # interactive
 *   npm run setup -- --provider openai --api-key sk-... --tier pro
 *   npm run setup -- --provider openai-compatible --endpoint https://... --api-key ... --model-reasoning gpt-4o --model-fast gpt-4o-mini
 *
 * Keys are stored in the local, git-ignored config (or can be moved to the
 * CredentialVault). Nothing is sent anywhere except the provider's own
 * validation endpoint.
 */
import * as readline from 'readline';
import * as path from 'path';
import { ConfigManager } from '../src/config/ConfigManager';
import { CredentialVault } from '../src/core/vault/CredentialVault';
import { DEFAULT_ROUTING } from '../src/core/metering/ModelRouter';
import { ModelProvider, PlanTier } from '../src/types';

const PROVIDERS: ModelProvider[] = ['ollama', 'openai', 'anthropic', 'openai-compatible'];

const PROVIDER_MODELS: Record<string, { reasoning: string; vision: string; fast: string }> = {
  ollama: { reasoning: 'qwen2.5:14b', vision: 'qwen2.5-vl:7b', fast: 'qwen2.5:7b' },
  openai: { reasoning: 'gpt-4o', vision: 'gpt-4o', fast: 'gpt-4o-mini' },
  anthropic: { reasoning: 'claude-sonnet-4-20250514', vision: 'claude-sonnet-4-20250514', fast: 'claude-haiku-4-5-20251001' },
  'openai-compatible': { reasoning: '', vision: '', fast: '' },
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return undefined;
}

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

function ask(rl: readline.Interface, question: string, def?: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(`${question}${def ? ` [${def}]` : ''} `, ans => resolve(ans.trim() || def || ''));
  });
}

async function validate(cfg: { provider: ModelProvider; models: { fast: string }; ollama?: { endpoint?: string }; openai?: { apiKey?: string }; anthropic?: { apiKey?: string }; openaiCompatible?: { endpoint: string; apiKey?: string } }): Promise<{ ok: boolean; message: string }> {
  const p = cfg.provider;
  try {
    if (p === 'ollama') {
      const ep = (cfg.ollama?.endpoint || 'http://localhost:11434').replace(/\/$/, '');
      const res = await fetch(`${ep}/api/tags`);
      return { ok: res.ok, message: res.ok ? `Ollama reachable at ${ep}` : `Ollama returned HTTP ${res.status}` };
    }
    if (p === 'openai') {
      const key = cfg.openai?.apiKey || '';
      if (!key) return { ok: false, message: 'No API key set' };
      const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      return { ok: res.ok, message: res.ok ? 'OpenAI key valid' : `OpenAI returned HTTP ${res.status}` };
    }
    if (p === 'anthropic') {
      const key = cfg.anthropic?.apiKey || '';
      if (!key) return { ok: false, message: 'No API key set' };
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: cfg.models.fast, max_tokens: 8, messages: [{ role: 'user', content: 'ok' }] }),
      });
      return { ok: res.ok, message: res.ok ? 'Anthropic key valid' : `Anthropic returned HTTP ${res.status}` };
    }
    if (p === 'openai-compatible') {
      const ep = (cfg.openaiCompatible?.endpoint || '').replace(/\/$/, '');
      const key = cfg.openaiCompatible?.apiKey || '';
      if (!ep) return { ok: false, message: 'No endpoint set' };
      const res = await fetch(`${ep}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
      return { ok: res.ok, message: res.ok ? 'Compatible endpoint reachable' : `Endpoint returned HTTP ${res.status}` };
    }
    return { ok: false, message: `Unknown provider: ${p}` };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'validation failed' };
  }
}

async function main(): Promise<void> {
  const dataDir = process.env.UMBRA_DATA_DIR || path.join(process.env.USERPROFILE || '~', '.umbra');
  const cm = new ConfigManager(dataDir);
  await cm.initialize();

  const nonInteractive = hasFlag('non-interactive') || !process.stdin.isTTY;
  const rl = nonInteractive ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

  const envKeys: Record<ModelProvider, string | undefined> = {
    ollama: undefined,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    'openai-compatible': process.env.OPENAI_API_KEY,
  };

  // ── Provider ──────────────────────────────────────────────
  let provider = (arg('provider') || process.env.UMBRA_PROVIDER || '') as ModelProvider;
  if (!PROVIDERS.includes(provider)) {
    provider = rl
      ? (await ask(rl, `Provider (${PROVIDERS.join('/')})`, 'ollama')) as ModelProvider
      : 'ollama';
  }
  if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider: ${provider}`);

  const defaults = PROVIDER_MODELS[provider];
  const endpointDefault = provider === 'ollama' ? 'http://localhost:11434' : undefined;
  const endpoint = arg('endpoint') || endpointDefault || '';
  const apiKey = arg('api-key') || envKeys[provider] || (rl ? await ask(rl, 'API key (optional for ollama)', '') : '');
  const modelReasoning = arg('model-reasoning') || (rl ? await ask(rl, 'Reasoning model', defaults.reasoning) : defaults.reasoning);
  const modelVision = arg('model-vision') || (rl ? await ask(rl, 'Vision model', defaults.vision) : defaults.vision);
  const modelFast = arg('model-fast') || (rl ? await ask(rl, 'Fast model', defaults.fast) : defaults.fast);
  const tier = (arg('tier') || 'free') as PlanTier;

  // ── Telco (Telnyx) — optional ───────────────────────────
  const telnyxKey = arg('telnyx-key') || process.env.TELNYX_API_KEY || (rl ? await ask(rl, 'Telnyx API key (optional, Enter to skip)', '') : '');
  const telnyxFrom = arg('telnyx-from') || (telnyxKey && rl ? await ask(rl, 'Telnyx from-number (E.164, e.g. +1234567890)', '') : '');
  const telnyxProfile = arg('telnyx-profile') || '';

  if (rl) rl.close();

  // ── Persist ───────────────────────────────────────────────
  await cm.updateProvider(provider, { reasoning: modelReasoning, vision: modelVision, fast: modelFast });
  await cm.updateProviderCredentials(provider, { endpoint: endpoint || undefined, apiKey: apiKey || undefined });
  cm.raw.plan.tier = tier;
  if (tier === 'pro' || tier === 'ultimate') {
    cm.raw.plan.routing = cm.raw.plan.routing ?? { ...DEFAULT_ROUTING };
    cm.raw.plan.routing.enabled = true;
    cm.raw.plan.cloudContinuation = true;
  } else {
    cm.raw.plan.cloudContinuation = false;
  }
  await cm.saveConfig();

  if (telnyxKey) {
    const vault = new CredentialVault({ dataDir, hwid: process.env.UMBRA_HWID || 'local-machine' });
    vault.unlock();
    const existing = vault.find('telnyx');
    vault.set({ service: 'telnyx', username: 'api-key', secret: telnyxKey }, existing?.id);
    await cm.updateTelco({ enabled: !!telnyxFrom, fromNumber: telnyxFrom || undefined, messagingProfileId: telnyxProfile || undefined });
  }

  console.log(`\n✔ Saved config to ${dataDir}/config.json`);
  console.log(`  provider : ${provider}`);
  console.log(`  models   : reasoning=${modelReasoning} vision=${modelVision} fast=${modelFast}`);
  console.log(`  tier     : ${tier}`);
  if (telnyxKey) console.log(`  telco    : Telnyx token stored${telnyxFrom ? `, from ${telnyxFrom}` : ''}`);

  // ── Live validation ───────────────────────────────────────
  console.log('\nValidating…');
  const result = await validate(cm.raw);
  if (result.ok) console.log(`✔ ${result.message}`);
  else console.log(`✖ ${result.message}`);

  console.log('\nNext: npm run dev   (or npm start after npm run build)');
  if (!result.ok) console.log('If the provider is unreachable, fix the key/endpoint in ~/.umbra/config.json and re-run setup.');
}

main().catch(err => {
  console.error(`Setup failed: ${err?.message || err}`);
  process.exit(1);
});
