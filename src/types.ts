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

/**
 * One tier of the model-routing ladder. `*PerM` fields are USD per 1M tokens.
 */
export interface ModelTierConfig {
  provider: ModelProvider;
  model: string;
  /** Optional per-slot endpoint override (e.g. OpenRouter for the free tier). */
  endpoint?: string;
  /** USD per 1M input tokens (cache miss). */
  inputPerM: number;
  /** USD per 1M input tokens (cache hit). */
  cacheHitPerM: number;
  /** USD per 1M output tokens. */
  outputPerM: number;
}

/**
 * The model slots the router can select between. Every slot is a distinct
 * model; the router maps (role, task) → slot and spills over to `free`
 * whenever a hosted slot's quota is exhausted.
 */
export type RoutingTier = 'free' | 'fast' | 'reasoning' | 'frontend' | 'difficult';

/**
 * Tiered model routing + rate limits. Optional so legacy configs keep working;
 * defaults are applied at runtime by the ModelRouter.
 */
export interface RoutingConfig {
  enabled: boolean;
  /** Assumed cache-hit ratio for cost estimation (0-1). Prompt caching. */
  cacheHitRatio: number;
  /** Compress input context before calls (Graphify). */
  graphify: boolean;
  /** Cap/densify outputs to the plan max (Caveman). */
  caveman: boolean;
  /** Free models — the spillover target and the free-plan default (cloud free models). */
  free: ModelTierConfig;
  /** Day-to-day quick/vision work (DeepSeek V4 Flash). */
  fast: ModelTierConfig;
  /** Day-to-day agentic/reasoning work (DeepSeek-R1). */
  reasoning: ModelTierConfig;
  /** Frontend / design work (Muse Spark 1.2). */
  frontend: ModelTierConfig;
  /** Difficult tasks (Claude Sonnet 5, hard-capped). */
  difficult: ModelTierConfig;
}

export interface McpConnectorConfig {
  id: string;
  name: string;
  category: string;
  baseUrl: string;
  authType: 'none' | 'bearer' | 'apiKey' | 'oauth';
  apiKeyHeader?: string;
  credentialKey?: string;
  /** Remote MCP tool name for this connector (e.g. DeepWiki's `ask_question`).
   *  Defaults to `invoke` for generic/REST connectors. */
  tool?: string;
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
  /**
   * Device mesh: an always-on hub (usually the cloud) that every device
   * stays connected to. QR/link joins issue a long-lived token; clients
   * auto-reconnect so the mesh survives restarts and network drops.
   */
  devices: {
    enabled: boolean;
    /** WebSocket port this node's DeviceHub listens on. */
    hubPort: number;
    /** Remote hub to connect to as a client (empty = this node is the hub). */
    hubUrl: string;
    /** Long-lived token issued by the remote hub after join (persisted). */
    hubToken?: string;
    /** Device id assigned by the remote hub after join (persisted). */
    hubDeviceId?: string;
    name: string;
    role: 'desktop' | 'phone' | 'server' | 'other';
  };
  plan: {
    tier: PlanTier;
    apiCreditPool: number;
    imagesMonthly: number;
    videoMonthly: number;
    /** Tiered model routing + rate limits (defaults applied at runtime). */
    routing?: RoutingConfig;
    /**
     * Allow in-flight tasks to resume on the cloud node after a restart.
     * Paid feature: activation flips this on; the free plan never resumes
     * on the cloud (the desktop always resumes its own local queue).
     */
    cloudContinuation?: boolean;
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
    /** Capture system audio (the call) via WASAPI loopback for live transcription. */
    loopbackEnabled: boolean;
    /** Seconds of meeting audio captured per transcription chunk. */
    chunkSec: number;
    /** Detect + auto-execute orders spoken in the meeting ("Hey Umbra, ..."). */
    ordersEnabled?: boolean;
    /** Allow screen-share actions (share/stop) during a meeting. */
    screenShare?: boolean;
  };
  /** Screen awareness: Umbra sees the live screen + cursor and answers questions about it. */
  awareness: {
    enabled: boolean;
    /** Continuously watch the screen + cursor (defaults true on desktop). */
    watch?: boolean;
    /** Milliseconds between live screen/cursor samples. */
    watchIntervalMs?: number;
    /** Track the cursor trail so answers know what you are pointing at. */
    followCursor?: boolean;
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
  image: {
    enabled: boolean;
    provider: 'huggingface' | 'replicate';
    /** Model id, e.g. black-forest-labs/FLUX.1-schnell (HF) or flux-schnell (Replicate). */
    model: string;
    apiKey: string;
    /** Optional API endpoint override. */
    endpoint?: string;
  };
  /** Voice-to-text (and TTS) — pluggable providers, free/local or cloud. */
  voice: {
    enabled: boolean;
    /**
     * STT backend: 'none' | 'openai' (Whisper API) | 'whisper-local'
     * (a whisper.cpp server, e.g. http://localhost:8080).
     */
    sttProvider: 'none' | 'openai' | 'whisper-local';
    /** For 'openai': the transcriptions endpoint. For 'whisper-local': the server base URL. */
    sttEndpoint: string;
    /** API key for the 'openai' backend (falls back to openai.apiKey). */
    sttApiKey: string;
    /** Whisper model id (e.g. whisper-1, or a whisper.cpp model). */
    sttModel: string;
  };
  hermes: {
    enabled: boolean;
    /** Path override for the `hermes` CLI (auto-detected when empty). */
    bin: string;
    /** Max seconds a delegated task may run before it is killed. */
    taskTimeoutMs: number;
    /** Route whole tasks through the built-in reasoning engine when available. */
    autoDelegate: boolean;
  };
}

export type TaskStatus = 'pending' | 'planning' | 'executing' | 'healing' | 'completed' | 'failed' | 'cancelled';

/** A single step in a task plan (mirrors TaskPlanner.PlannedStep). */
export interface TaskPlanStep {
  description: string;
  action: string;
  params: Record<string, unknown>;
  requiresKnowledge: string[];
}

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
  /** The plan, captured once planning succeeds — enables cross-restart resume. */
  plan?: TaskPlanStep[];
  /** Completed steps (checkpointed after every step). */
  steps?: TaskStep[];
  /** Index of the next plan step to run (== steps.length in the normal flow). */
  completedStepCount?: number;
  /** Consent was already granted for this task (so resume skips re-prompting). */
  consentGranted?: boolean;
  /** Which node last ran this task — 'desktop' or 'cloud'. */
  resumeNode?: 'desktop' | 'cloud';
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
