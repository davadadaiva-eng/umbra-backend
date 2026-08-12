export type ModelProvider = 'ollama' | 'openai' | 'anthropic' | 'openai-compatible';

export interface ModelConfig {
  provider: ModelProvider;
  reasoning: string;
  vision: string;
  fast: string;
  embedding?: string;
}

export interface ProviderConfig {
  endpoint?: string;
  apiKey?: string;
}

export interface RepoConfig {
  name: string;
  path: string;
}

export type PlanTier = 'free' | 'byok' | 'pro' | 'ultimate';

export interface McpConnectorConfig {
  id: string;
  name: string;
  category: string;
  baseUrl: string;
  authType: 'none' | 'bearer' | 'apiKey' | 'oauth';
  apiKeyHeader?: string;
  credentialKey?: string;
  enabled: boolean;
}

export interface UmbraConfig {
  provider: ModelProvider;
  models: ModelConfig;
  ollama?: ProviderConfig;
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  openaiCompatible?: ProviderConfig & { endpoint: string };
  hotkeys: {
    overlay: string;
    pause: string;
    togglePreview: string;
  };
  workspace: {
    maxSwarmDisplays: number;
    displayWidth: number;
    displayHeight: number;
    displayFps: number;
    cpuLimit: number;
    gpuLimit: number;
  };
  paths: {
    dataDir: string;
    knowledgeDir: string;
    recallDb: string;
    vaultDir: string;
    logsDir: string;
  };
  audio: {
    enabled: boolean;
    gestureCooldownMs: number;
  };
  realDesktop: {
    chromePath: string;
    cdpPort: number;
    windowWidth: number;
    windowHeight: number;
    enabled: boolean;
  };
  repos: RepoConfig[];
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    prettyPrint: boolean;
  };
  p2p: {
    enabled: boolean;
    webPort: number;
    signalingPort: number;
    stunServers: string[];
    relayFps: number;
  };
  plan: {
    tier: PlanTier;
    apiCreditPool: number;
    imagesMonthly: number;
    videoMonthly: number;
  };
  graphify: {
    enabled: boolean;
    maxContextTokens: number;
    summaryTokens: number;
    chunkTokens: number;
  };
  compiler: {
    enabled: boolean;
    backend: 'none' | 'node' | 'tcc' | 'clang';
    outputDir: string;
  };
  mcp: {
    enabled: boolean;
    connectors: McpConnectorConfig[];
  };
  shadow: {
    enabled: boolean;
    capture: 'dxgi' | 'gdi';
    fps: number;
  };
  meeting: {
    enabled: boolean;
    stt: 'none' | 'local';
    tts: 'none' | 'local';
  };
  telco: {
    enabled: boolean;
    provider: 'telnyx';
    fromNumber: string;
  };
  docker: {
    enabled: boolean;
    socketPath: string;
    defaultCpus: number;
    defaultMemoryMb: number;
  };
  hermes: {
    enabled: boolean;
    /** Path override for the `hermes` CLI (auto-detected when empty). */
    bin: string;
    /** Max seconds a delegated task may run before it is killed. */
    taskTimeoutMs: number;
  };
}

export type TaskStatus = 'pending' | 'planning' | 'executing' | 'healing' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  assignedSwarmId?: number;
  result?: TaskResult;
  error?: string;
}

export interface TaskResult {
  summary: string;
  output: unknown;
  steps: TaskStep[];
  totalTimeMs: number;
}

export interface TaskStep {
  description: string;
  action: string;
  params: Record<string, unknown>;
  result?: string;
  error?: string;
  startedAt: Date;
  completedAt: Date;
}

export interface KnowledgeNode {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: string[];
  category: KnowledgeCategory;
  updatedAt: Date;
  embedding?: number[];
}

export type KnowledgeCategory =
  | 'social'
  | 'automation'
  | 'tool'
  | 'domain'
  | 'config'
  | 'system'
  | 'workflow';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  target: string;
  params: Record<string, unknown>;
  result: string;
  signature: string;
  previousHash: string;
  swarmId?: number;
}

export type DisplayStatus = 'idle' | 'allocated' | 'active' | 'error';
export type SwarmTaskType = 'browser' | 'render' | 'scrape' | 'file' | 'generic';
export type SwarmPriority = 'low' | 'normal' | 'high';
