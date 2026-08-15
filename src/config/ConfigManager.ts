import * as fs from 'fs';
import * as path from 'path';
import { UmbraConfig, ModelProvider, McpConnectorConfig } from '../types';
import { getLogger } from '../core/Logger';
import { MCP_CATALOG, McpCatalogEntry } from '../core/mcp/McpCatalog';
import { DEFAULT_ROUTING } from '../core/metering/ModelRouter';

const DEFAULT_CONFIG: UmbraConfig = {
  provider: 'ollama',
  models: {
    provider: 'ollama',
    reasoning: 'qwen2.5:14b',
    vision: 'qwen2.5-vl:7b',
    fast: 'qwen2.5:7b',
  },
  hotkeys: {
    overlay: 'Cmd+K',
    pause: 'Ctrl+Shift+Space',
    togglePreview: 'Ctrl+Shift+P',
  },
  workspace: {
    maxSwarmDisplays: 4,
    displayWidth: 1920,
    displayHeight: 1080,
    displayFps: 60,
    cpuLimit: 80,
    gpuLimit: 80,
  },
  paths: {
    dataDir: '',
    knowledgeDir: '',
    recallDb: '',
    vaultDir: '',
    logsDir: '',
  },
  audio: {
    enabled: true,
    gestureCooldownMs: 2000,
  },
  realDesktop: {
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    cdpPort: 9224,
    windowWidth: 1280,
    windowHeight: 800,
    enabled: true,
  },
  repos: [],
  logging: {
    level: 'info',
    prettyPrint: true,
  },
  p2p: {
    enabled: true,
    webPort: 9443,
    signalingPort: 9444,
    stunServers: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
    ],
    relayFps: 10,
  },
  devices: {
    enabled: true,
    hubPort: 8788,
    hubUrl: '',
    name: 'Umbra Desktop',
    role: 'desktop',
  },
  plan: {
    tier: 'free',
    apiCreditPool: 0,
    imagesMonthly: 0,
    videoMonthly: 0,
    routing: { ...DEFAULT_ROUTING },
  },
  graphify: {
    enabled: true,
    maxContextTokens: 12000,
    summaryTokens: 300,
    chunkTokens: 400,
  },
  compiler: {
    enabled: true,
    backend: 'node',
    outputDir: '',
  },
  mcp: {
    enabled: true,
    connectors: [],
  },
  shadow: {
    enabled: true,
    capture: 'gdi',
    fps: 15,
  },
  meeting: {
    enabled: false,
    stt: 'none',
    tts: 'none',
    loopbackEnabled: true,
    chunkSec: 12,
    ordersEnabled: true,
    screenShare: true,
    audioCable: 'none',
    routeMic: false,
  },
  awareness: {
    enabled: true,
    watch: true,
    watchIntervalMs: 1000,
    followCursor: true,
  },
  telco: {
    enabled: false,
    provider: 'telnyx',
    fromNumber: '',
  },
  docker: {
    enabled: false,
    socketPath: '',
    defaultCpus: 2,
    defaultMemoryMb: 2048,
  },
  image: {
    enabled: false,
    provider: 'huggingface',
    model: 'black-forest-labs/FLUX.1-schnell',
    apiKey: '',
  },
  voice: {
    enabled: false,
    sttProvider: 'none',
    sttEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
    sttApiKey: '',
    sttModel: 'whisper-1',
    vibevoiceVoice: 'Carter',
    vibevoiceLanguage: 'en',
    vibevoiceModel: 'microsoft/VibeVoice-Realtime-0.5B',
    vibevoiceDevice: 'auto',
    voiceboxUrl: 'http://127.0.0.1:17493',
    voiceboxProfile: '',
    voiceboxEngine: 'qwen',
    asrProvider: 'none',
    vibevoiceAsrUrl: 'http://127.0.0.1:17500',
    vibevoiceAsrModel: 'microsoft/VibeVoice-ASR',
    vibevoiceAsrContext: '',
  },
  hermes: {
    enabled: true,
    bin: '',
    taskTimeoutMs: 300_000,
    autoDelegate: true,
  },
};

export class ConfigManager {
  private config: UmbraConfig;
  private configPath: string;

  constructor(dataDir?: string) {
    const baseDir = dataDir || path.join(process.env.USERPROFILE || '~', '.umbra');
    this.config = { ...DEFAULT_CONFIG };
    this.config.paths.dataDir = baseDir;
    this.config.paths.knowledgeDir = path.join(baseDir, 'knowledge');
    this.config.paths.recallDb = path.join(baseDir, 'recall.db');
    this.config.paths.vaultDir = path.join(baseDir, 'vault');
    this.config.paths.logsDir = path.join(baseDir, 'logs');
    this.config.compiler.outputDir = path.join(baseDir, 'compiled');
    this.configPath = path.join(baseDir, 'config.json');
  }

  async initialize(): Promise<void> {
    this.ensureDirectories();
    await this.loadConfig();
  }

  private ensureDirectories(): void {
    for (const dir of [
      this.config.paths.dataDir,
      this.config.paths.knowledgeDir,
      this.config.paths.vaultDir,
      this.config.paths.logsDir,
    ]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async loadConfig(): Promise<UmbraConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8').replace(/^\uFEFF/, '');
        const parsed = JSON.parse(raw);
        this.config = this.mergeConfig(DEFAULT_CONFIG, parsed);
      } else {
        await this.saveConfig();
      }
    } catch (e) {
      getLogger().warn({ err: (e as Error).message }, 'Config file invalid — using defaults (file NOT overwritten)');
    }
    return this.config;
  }

  async saveConfig(): Promise<void> {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  async updateProvider(provider: ModelProvider, models: Partial<UmbraConfig['models']>): Promise<void> {
    this.config.provider = provider;
    this.config.models.provider = provider;
    if (models.reasoning) this.config.models.reasoning = models.reasoning;
    if (models.vision) this.config.models.vision = models.vision;
    if (models.fast) this.config.models.fast = models.fast;
    await this.saveConfig();
  }

  async updateProviderCredentials(provider: ModelProvider, creds: { endpoint?: string; apiKey?: string }): Promise<void> {
    const key = provider === 'openai-compatible' ? 'openaiCompatible' : provider;
    if (key === 'openaiCompatible') {
      this.config.openaiCompatible = {
        ...this.config.openaiCompatible,
        ...creds,
        endpoint: creds.endpoint || this.config.openaiCompatible?.endpoint || '',
      };
    } else {
      (this.config as any)[key] = { ...(this.config as any)[key], ...creds };
    }
    await this.saveConfig();
  }

  async updateHotkeys(hotkeys: Partial<UmbraConfig['hotkeys']>): Promise<void> {
    Object.assign(this.config.hotkeys, hotkeys);
    await this.saveConfig();
  }

  /**
   * Reactivate every catalog connector into config (enabled: false) so the UI
   * can list all of them. Pre-existing entries keep their enabled/baseUrl.
   */
  async syncConnectorCatalog(): Promise<void> {
    let changed = false;
    for (const entry of MCP_CATALOG) {
      const existing = this.config.mcp.connectors.find(c => c.id === entry.id);
      if (!existing) {
        this.config.mcp.connectors.push(this.fromCatalog(entry));
        changed = true;
      }
    }
    if (changed) await this.saveConfig();
  }

  /** Persist (or update) a connector in config, keeping its catalog defaults. */
  async upsertMcpConnector(id: string, patch: Partial<McpConnectorConfig>): Promise<McpConnectorConfig> {
    const entry = MCP_CATALOG.find(c => c.id === id);
    const base = entry ? this.fromCatalog(entry) : undefined;
    let connector = this.config.mcp.connectors.find(c => c.id === id);
    if (!connector) {
      connector = { ...(base ?? { id, name: id, category: 'Custom', baseUrl: '', authType: 'none', enabled: false }) };
      this.config.mcp.connectors.push(connector);
    }
    Object.assign(connector, patch);
    await this.saveConfig();
    return connector;
  }

  private fromCatalog(entry: McpCatalogEntry): McpConnectorConfig {
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      baseUrl: entry.baseUrl,
      authType: entry.authType,
      apiKeyHeader: entry.apiKeyHeader,
      credentialKey: entry.credentialKey,
      tool: entry.tool,
      enabled: false,
    };
  }

  get raw(): UmbraConfig {
    return this.config;
  }

  private mergeConfig(base: UmbraConfig, override: Partial<UmbraConfig>): UmbraConfig {
    const merged = { ...base };
    for (const key of Object.keys(override) as (keyof UmbraConfig)[]) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        (merged as any)[key] = { ...(base[key] as any), ...(override[key] as any) };
      } else if (override[key] !== undefined) {
        (merged as any)[key] = override[key];
      }
    }
    return merged;
  }
}
