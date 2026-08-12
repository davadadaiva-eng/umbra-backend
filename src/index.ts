import * as path from 'path';
import { ConfigManager } from './config/ConfigManager';
import { KnowledgeGraph } from './knowledge/KnowledgeGraph';
import { RecallToKnowledgeBridge } from './knowledge/RecallToKnowledgeBridge';
import { BrowserUseBridge } from './core/browseruse/BrowserUseBridge';
import { DeepUnderstandingEngine } from './knowledge/DeepUnderstandingEngine';
import { eventBus } from './core/EventBus';
import { initializeLogger, getLogger } from './core/Logger';
import { LLMConnector } from './core/agent/LLMConnector';
import { TaskPlanner } from './core/agent/TaskPlanner';
import { AgentRuntime } from './core/agent/AgentRuntime';
import { HermesAgentBridge } from './core/agent/HermesAgent';
import { WorkspaceFiles } from './core/agent/WorkspaceFiles';
import { ReposManager } from './core/agent/ReposManager';
import { ConsentGate } from './core/agent/ConsentGate';
import { ProactiveAgent } from './core/agent/ProactiveAgent';
import { VirtualDisplayManager } from './core/workspace/VirtualDisplayManager';
import { InputGuard } from './core/workspace/InputGuard';
import { SwarmManager } from './core/workspace/SwarmManager';
import { AgentDesktop } from './core/workspace/AgentDesktop';
import { SelfHealingGuard } from './core/selfheal/SelfHealingGuard';
import { VectorMemory } from './core/memory/VectorMemory';
import { ActivityWatcher } from './core/recall/ActivityWatcher';
import { MacroSynthesizer } from './core/recall/MacroSynthesizer';
import { AuditVault } from './core/vault/AuditVault';
import { NoiseCancellationEngine } from './core/audio/NoiseCancellationEngine';
import { PrivacyGuard } from './core/privacy/PrivacyGuard';
import { ScreenReader } from './core/vision/ScreenReader';
import { JournalGenerator } from './knowledge/journal/JournalGenerator';
import { TopicIndexer } from './knowledge/journal/TopicIndexer';
import { Desktop2Environment } from './core/desktop2/Desktop2Environment';
import { RealDesktop2 } from './core/desktop2/RealDesktop2';
import { PreviewStreamer } from './mobile/PreviewStreamer';
import { OpenMontageBridge } from './core/video/OpenMontageBridge';
import { VideoProducer } from './core/video/VideoProducer';
import { CommandHUD } from './overlay/CommandHUD';
import { ApiServer } from './api/ApiServer';
import { PairingManager } from './p2p/PairingManager';
import { P2PConnectionManager, P2PConnectionManagerOptions } from './p2p/P2PConnectionManager';
import { PwaServer } from './mobile/PwaServer';
import { GraphifyContextEngine } from './core/graphify/GraphifyContextEngine';
import { SkillCompiler } from './core/skill/SkillCompiler';
import { SkillRecorder } from './core/skill/SkillRecorder';
import { SkillRouter } from './core/skill/SkillRouter';
import { McpRegistry } from './core/mcp/McpRegistry';
import { McpRouter } from './core/mcp/McpRouter';
import { McpHttpConnector } from './core/mcp/McpHttpConnector';
import { ExternalRegistrySync } from './core/mcp/ExternalRegistrySync';
import { CredentialVault } from './core/vault/CredentialVault';
import { LiveShadowEngine } from './core/shadow/LiveShadowEngine';
import { MeetingAgent } from './core/meeting/MeetingAgent';
import { TelnyxClient } from './core/telco/TelnyxClient';
import { DockerDaemon } from './core/docker/DockerDaemon';
import { MeteringService } from './core/metering/MeteringService';
import { MeteredLLMConnector } from './core/metering/MeteredLLMConnector';
import { ALL_SKILLS } from './core/skill/SkillStack';
import { listSkillRepos } from './core/skill/SkillRepos';

export class UmbraOS {
  private configManager!: ConfigManager;
  private knowledge!: KnowledgeGraph;
  private bridge!: RecallToKnowledgeBridge;
  private fastEngine!: BrowserUseBridge;
  private deepEngine!: DeepUnderstandingEngine;
  private llm!: LLMConnector;
  private taskPlanner!: TaskPlanner;
  private agent!: AgentRuntime;
  private repos!: ReposManager;
  private consent!: ConsentGate;
  private proactive!: ProactiveAgent;
  private displayManager!: VirtualDisplayManager;
  private inputGuard!: InputGuard;
  private swarm!: SwarmManager;
  private healer!: SelfHealingGuard;
  private memory!: VectorMemory;
  private watcher!: ActivityWatcher;
  private macros!: MacroSynthesizer;
  private vault!: AuditVault;
  private privacy!: PrivacyGuard;
  private screenReader!: ScreenReader;
  private journal!: JournalGenerator;
  private topicIndexer!: TopicIndexer;
  private desktop2!: Desktop2Environment;
  private realDesktop!: RealDesktop2;
  private agentDesktop!: AgentDesktop;
  private audio!: NoiseCancellationEngine;
  private streamer!: PreviewStreamer;
  private hud!: CommandHUD;
  private openmontage!: OpenMontageBridge;
  private videoProducer!: VideoProducer;
  private api!: ApiServer;
  private pairing!: PairingManager;
  private p2p!: P2PConnectionManager;
  private pwa!: PwaServer;
  private graphify!: GraphifyContextEngine;
  private skillCompiler!: SkillCompiler;
  private skillRecorder!: SkillRecorder;
  private skillRouter!: SkillRouter;
  private mcpRegistry!: McpRegistry;
  private mcpRouter!: McpRouter;
  private mcpExternal!: ExternalRegistrySync;
  private hermes!: HermesAgentBridge;
  private credVault!: CredentialVault;
  private shadow!: LiveShadowEngine;
  private meetings!: MeetingAgent;
  private telnyx!: TelnyxClient;
  private dockerDaemon!: DockerDaemon;
  private metering!: MeteringService;
  private startedAt: number = Date.now();

  private initialized: boolean = false;

  async initialize(dataDir?: string): Promise<void> {
    console.log('🌘 Umbra OS v0.1.0 — initializing...');

    const configManager = new ConfigManager(dataDir);
    await configManager.initialize();
    this.configManager = configManager;
    const config = configManager.raw;

    initializeLogger(config.paths.logsDir, config.logging.level, config.logging.prettyPrint);
    getLogger().info('Umbra OS starting...');

    // ── Knowledge Brain ──────────────────────────────────────
    this.knowledge = new KnowledgeGraph(config.paths.knowledgeDir);
    await this.knowledge.initialize();

    // ── Metering & Plan (tiers + circuit breakers) — created first so
    //    every LLM call is gated, budgeted, and token-accounted. ─────
    this.metering = new MeteringService({
      tier: config.plan.tier,
      dataDir: config.paths.dataDir,
    });

    // ── LLM (metered: circuit breaker + token accounting + plan gate) ─
    this.llm = new MeteredLLMConnector(config, this.metering);

    // ── Privacy Guard ────────────────────────────────────────
    this.privacy = new PrivacyGuard();

    // ── Consent Gate (approval + emergency stop) ─────────────
    this.consent = new ConsentGate({
      dataDir: config.paths.dataDir,
      promptTimeoutMs: 30000,
      askOncePerSession: true,
    });
    if (await this.consent.checkEmergencyStop()) {
      getLogger().warn('Consent gate: emergency-stop file present at startup — actions will be blocked');
    }

    // ── Screen Reader (OCR — reads everything, filters later) ─
    this.screenReader = new ScreenReader(this.privacy, { ocrPoolSize: 2 });
    this.screenReader.setLLM(this.llm);

    // ── Recall (everything is logged here, vector-indexed) ───
    this.memory = new VectorMemory(config.paths.recallDb, { enableVec: true });
    this.memory.setEmbedder(text => this.llm.createEmbedding(text));
    this.memory.initialize();

    // ── Journal Generator (hourly/daily organized brain) ─────
    this.journal = new JournalGenerator(this.memory, this.knowledge, this.privacy, config.paths.knowledgeDir);
    this.journal.initialize();
    this.topicIndexer = new TopicIndexer(config.paths.knowledgeDir);
    this.topicIndexer.initialize();

    // ── Activity Watcher (watches your every move) ───────────
    this.watcher = new ActivityWatcher(
      this.memory, this.knowledge, this.privacy,
      this.screenReader,
      {
        pollIntervalMs: 2000,
        captureIntervalMs: 2000,
        idleThresholdSec: 120,
        useScreenReader: true,
      },
    );

    // ── Knowledge Bridge (recall → brain) ────────────────────
    this.bridge = new RecallToKnowledgeBridge(this.memory, this.knowledge);
    this.bridge.setLLM(this.llm);

    // ── Virtual Desktop Infrastructure ───────────────────────
    this.displayManager = new VirtualDisplayManager({
      maxDisplays: config.workspace.maxSwarmDisplays,
      displayWidth: config.workspace.displayWidth,
      displayHeight: config.workspace.displayHeight,
      displayFps: config.workspace.displayFps,
    });
    this.inputGuard = new InputGuard();

    this.swarm = new SwarmManager(this.displayManager, this.inputGuard, {
      maxSlots: Math.max(1, config.workspace.maxSwarmDisplays - 1),
      cpuLimit: config.workspace.cpuLimit,
      gpuLimit: config.workspace.gpuLimit,
    });

    this.healer = new SelfHealingGuard(this.displayManager, this.inputGuard);
    this.healer.setLLM(this.llm);

    // ── Vault (crypto audit trail) ───────────────────────────
    this.vault = new AuditVault(config.paths.vaultDir);
    this.vault.initialize();

    // ── Desktop 2 — the isolated AI workspace ────────────────
    this.desktop2 = new Desktop2Environment(
      this.displayManager,
      this.inputGuard,
      this.privacy,
      this.vault,
      {
        width: config.workspace.displayWidth,
        height: config.workspace.displayHeight,
        fps: config.workspace.displayFps,
        browserPath: '',
        dataDir: config.paths.dataDir,
      },
      this.consent,
    );

    // ── Agent Desktop (persistent agent Chrome with CDP) ────
    this.agentDesktop = new AgentDesktop(this.consent, path.join(config.paths.dataDir, 'workspace'), {
      path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      cdpPort: 9223,
      profileDir: path.join(config.paths.dataDir, 'chrome-agent-profile'),
    });

    // ── RealDesktop2 — "human mode": real apps + real Chrome on a 2nd desktop ──
    this.realDesktop = new RealDesktop2(
      this.consent,
      this.privacy,
      this.vault,
      this.screenReader,
      {
        chromePath: config.realDesktop.chromePath,
        cdpPort: config.realDesktop.cdpPort,
        windowWidth: config.realDesktop.windowWidth,
        windowHeight: config.realDesktop.windowHeight,
        dataDir: config.paths.dataDir,
      },
    );

    // ── Fast Engine (browser-use bridge in the user's Chrome) ──
    this.fastEngine = new BrowserUseBridge(
      path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe'),
      path.join(__dirname, '..', 'scripts', 'browser-use', 'bridge.py'),
    );
    const engine = process.env['UMBRA_ENGINE'] || 'browseruse';
    if (engine === 'browseruse') {
      await this.fastEngine.start();
    } else {
      getLogger().info('Fast engine disabled (UMBRA_ENGINE=desktop2) — using Desktop 2 loop');
    }

    // ── Video production (Remotion + OpenMontage tool registry) ──
    this.openmontage = new OpenMontageBridge();
    this.videoProducer = new VideoProducer(this.llm, this.openmontage);
    if (!this.openmontage.isInstalled()) {
      getLogger().warn('OpenMontage not installed — video production disabled (external/OpenMontage)');
    }

    // ── Agent Systems ────────────────────────────────────────
    this.taskPlanner = new TaskPlanner(this.knowledge, this.llm);
    this.repos = new ReposManager(config.repos);
    this.agent = new AgentRuntime(
      this.llm,
      this.knowledge,
      this.taskPlanner,
      new WorkspaceFiles(path.join(config.paths.dataDir, 'workspace')),
    );
    this.hermes = new HermesAgentBridge({
      bin: config.hermes.bin || undefined,
      timeoutMs: config.hermes.taskTimeoutMs,
    });

    this.agent.registerSubsystems({
      swarm: this.swarm,
      healer: this.healer,
      memory: this.memory,
      vault: this.vault,
      consent: this.consent,
      desktop2: this.desktop2,
      realDesktop: this.realDesktop,
      agentDesktop: this.agentDesktop,
      bridge: this.fastEngine,
      openmontage: this.openmontage,
      videoProducer: this.videoProducer,
      repos: this.repos,
      hermes: this.hermes,
    });

    // ── Deep Understanding (LLM-powered research & expansion) ─
    this.deepEngine = new DeepUnderstandingEngine(this.memory, this.knowledge);
    this.deepEngine.setLLM(this.llm);

    // ── Proactive Agent (acts without being asked) ───────────
    this.proactive = new ProactiveAgent(this.memory, this.knowledge, this.watcher, this.bridge, this.deepEngine);
    this.proactive.setAgent(this.agent);
    this.proactive.setLLM(this.llm);

    // ── Macro Synthesizer ────────────────────────────────────
    this.macros = new MacroSynthesizer(this.memory);
    this.macros.setLLM(this.llm);
    this.macros.setAgent(this.agent);

    // ── Audio DSP ────────────────────────────────────────────
    this.audio = new NoiseCancellationEngine(config.audio.gestureCooldownMs);

    // ── Preview Streamer (real frames from Desktop 2 via ws) ──
    this.streamer = new PreviewStreamer({
      enabled: true,
      port: 9090,
      fps: 5,
    });
    this.streamer.setFrameProvider(() => this.realDesktop.captureWindow() ?? this.desktop2.screenshot());
    const ghostEngine = (process.env['UMBRA_ENGINE'] || 'browseruse') !== 'browseruse';
    this.streamer.setCommandHandler((action, params) =>
      ghostEngine ? this.executeGhost(action, params) : this.desktop2.executeAction(action, params),
    );

    // ── Command HUD ──────────────────────────────────────────
    this.hud = new CommandHUD();
    this.hud.registerSubsystems({
      agent: this.agent,
      macros: this.macros,
      config: this.configManager,
      knowledge: this.knowledge,
    });

    // ── API Server (REST + WS for the read-only UI) ──────────
    this.api = new ApiServer({
      getStatus: () => this.getApiStatus(),
      submitTask: (description, priority) => this.submitTask(description, priority),
      getTask: id => this.agent.getTask(id),
      getActiveTasks: () => this.agent.getActiveTasks(),
      executeDesktop2: (action, params) => this.executeDesktop2(action, params),
      executeGhost: (action, params) => this.executeGhost(action, params),
      captureGhost: () => this.captureGhost(),
      requestConsent: reason => this.requestConsent(reason),
      getConsentState: () => this.consent.getState(),
      isEmergencyStopArmed: () => this.consent.isEmergencyStopArmed(),
      armEmergencyStop: () => this.consent.armEmergencyStop(),
      disarmEmergencyStop: () => this.consent.disarmEmergencyStop(),
      searchKnowledge: q => this.searchKnowledge(q),
      getMacros: () => this.getMacros(),
      getSessions: () => this.getSessions(),
      getPrivacyStats: () => this.getPrivacyStats(),
      getActivitySummary: () => this.getActivitySummary(),
      getSwarmStatus: () => this.getSwarmStatus(),
      getAuditStats: () => this.getAuditStats(),
      getRepos: () => this.getRepos(),
      getMcpCatalog: () => this.getMcpCatalog(),
      connectMcp: (id, opts) => this.connectMcp(id, opts),
      syncExternalConnectors: opts => this.syncExternalConnectors(opts),
      delegateHermes: (description, opts) => this.agent.delegateTask(description, opts),
      generateJournalNow: () => this.generateJournalNow(),
      shutdown: () => {
        if (process.listenerCount('SIGINT') > 0) process.emit('SIGINT');
      },
    }, 8787);

    // ── Credential Vault (AES-256-GCM, HWID-bound) ────────────
    this.credVault = new CredentialVault({
      dataDir: config.paths.dataDir,
      hwid: process.env['UMBRA_HWID'] || 'local-machine',
    });
    try {
      this.credVault.unlock();
    } catch (err) {
      getLogger().warn({ err }, 'Credential vault locked — vault-backed connectors will be disabled');
    }

    // ── MCP registry + router (vault-backed HTTP connectors) ──
    this.mcpRegistry = new McpRegistry();
    const httpConnector = new McpHttpConnector({ vault: this.credVault });
    this.mcpRouter = new McpRouter(this.mcpRegistry, { connector: httpConnector });
    this.mcpExternal = new ExternalRegistrySync(this.mcpRegistry, { dedupe: true });

    // ── P2P: pairing + signaling + PWA control plane ──────────
    if (config.p2p.enabled) {
      this.pairing = new PairingManager({ dataDir: config.paths.dataDir });
      const p2pOptions: P2PConnectionManagerOptions = {
        signalingPort: config.p2p.signalingPort,
        pairing: this.pairing,
        stunServers: config.p2p.stunServers,
        relayFps: config.p2p.relayFps,
      };
      this.p2p = new P2PConnectionManager(p2pOptions);
      this.p2p.start();
      this.pwa = new PwaServer({
        webPort: config.p2p.webPort,
        signalingPort: config.p2p.signalingPort,
        pairing: this.pairing,
        getStatus: () => {
          const status = this.p2p.getStatus();
          return {
            active: status.active,
            clients: status.clients,
            pairedDevices: status.pairedDevices,
          };
        },
      });
      this.pwa.start();

      // Phone control plane drives the real desktop (or Desktop 2) and
      // streams live frames back to the PWA.
      this.p2p.setCommandHandler((action, params) =>
        (process.env['UMBRA_ENGINE'] || 'browseruse') !== 'browseruse'
          ? this.executeGhost(action, params)
          : this.executeDesktop2(action, params),
      );
      this.p2p.setFrameProvider(async () => this.realDesktop.captureWindow() ?? this.desktop2.screenshot());
    }

    // ── Graphify/Caveman — context compression pipeline ───────
    this.graphify = new GraphifyContextEngine({
      targetChunkTokens: config.graphify.chunkTokens,
      targetTokens: config.graphify.summaryTokens,
      summarize: async (text, maxTokens) => {
        const res = await this.llm.complete(
          [{ role: 'user', content: `Summarize the following in at most ${maxTokens ?? 300} tokens:\n\n${text}` }],
          'fast',
        );
        return res.content;
      },
    });

    // ── Master Skill Stack + compiler + recorder + router ─────
    this.skillRecorder = new SkillRecorder({ dataDir: config.paths.dataDir });
    this.skillRouter = new SkillRouter();
    this.skillCompiler = new SkillCompiler({
      outDir: config.compiler.outputDir,
      compileHot: config.compiler.enabled && config.compiler.backend !== 'none',
    });

    // Register the 100-skill catalog into the MCP registry so the skill
    // router can dispatch <skill>.execute through the McpRouter, and hand
    // the intelligence layer (skills / graphify / metering / mcp) to the
    // agent runtime for step execution.
    for (const skill of ALL_SKILLS) {
      this.mcpRegistry.register(skill.id, 'execute', { transport: 'prompt' });
    }
    this.agent.registerSubsystems({
      skillRouter: this.skillRouter,
      skillRecorder: this.skillRecorder,
      mcpRouter: this.mcpRouter,
      metering: this.metering,
      graphify: this.graphify,
    });

    // ── Live Shadowing (real screen watch + takeover) ─────────
    this.shadow = new LiveShadowEngine({
      captureIntervalMs: Math.round(1000 / config.shadow.fps),
      captureWindow: true,
    });

    // ── Meeting Agent + Telco (Telnyx) + Docker workers ───────
    this.meetings = new MeetingAgent({
      summarize: async (transcript: string) => {
        const res = await this.llm.complete(
          [{ role: 'user', content: `Summarize this meeting in at most 300 tokens:\n\n${transcript}` }],
          'fast',
        );
        return res.content;
      },
    });
    this.telnyx = new TelnyxClient({
      fromNumber: config.telco.fromNumber,
      vault: this.credVault,
    });
    this.dockerDaemon = new DockerDaemon({
      dryRun: !config.docker.enabled,
      registry: undefined,
    });

    // ── Start subsystems ─────────────────────────────────────
    await this.swarm.initialize();
    await this.desktop2.start();
    this.streamer.start();
    this.api.start();
    this.watcher.start();
    this.healer.start(5000);
    this.audio.start();
    this.proactive.start();

    // ── Live Shadowing (watch + takeover the real screen) ────
    if (config.shadow.enabled) {
      this.shadow.start();
    }

    // ── MCP connectors from config + full catalog (vault-backed credentials)
    //    Deploy the entire catalog into config so every connector is visiable
    //    and registered, and mark those the user has enabled as connected.
    await this.configManager.syncConnectorCatalog();
    const deployedConnectors = this.configManager.raw.mcp.connectors;
    for (const connector of deployedConnectors) {
      this.mcpRegistry.register(connector.id, 'invoke', {
        endpoint: connector.enabled && connector.baseUrl ? connector.baseUrl : undefined,
        credentialService: connector.credentialKey || connector.name,
      });
    }

    // ── Hermes Agent (Nous Research) — one-shot delegated tasks ──
    this.mcpRegistry.register('hermes-agent', 'execute', {
      transport: 'native',
      credentialService: undefined,
    });
    getLogger().info({ tools: this.mcpRegistry.list().length, connectors: deployedConnectors.length, hermes: config.hermes.enabled }, 'MCP registry ready');

    // ── Agent browser: launch once at boot, reused by all tasks ──
    // (ghost/desktop2 modes own Chrome themselves — RealDesktop2 uses the
    //  user's REAL profile; let the agent-chrome instance start on demand)
    if ((process.env['UMBRA_ENGINE'] || 'browseruse') === 'browseruse') {
      this.agentDesktop.ensure().catch(() => {});
    }

    // ── Generate initial journal for yesterday (catch up) ────
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.journal.generateDailyJournal(yesterday).catch(() => {});

    // ── Auto-journal every hour ──────────────────────────────
    setInterval(() => {
      this.journal.generateDailyJournal().catch(() => {});
      this.topicIndexer.rebuildIndex();
    }, 3600000);

    // ── Recall → knowledge bridge every 15 minutes ───────────
    setInterval(() => {
      this.bridge.ingestSince(new Date(Date.now() - 15 * 60 * 1000)).catch(() => {});
    }, 15 * 60 * 1000);

    // ── Macro synthesis pass every 30 minutes ────────────────
    setInterval(() => {
      this.macros.analyzePatterns().catch(() => {});
    }, 30 * 60 * 1000);

    this.initialized = true;
    eventBus.emit('app:ready');

    getLogger().info({
      provider: config.provider,
      model: config.models.reasoning,
      swarmSlots: config.workspace.maxSwarmDisplays,
    }, 'Umbra OS initialized');

    console.log('🌘 Umbra OS ready. Command HUD: Ctrl+Shift+Space');
    console.log('👁  Screen reader active — reads everything, filters private data');
    console.log('🔒 Privacy guard active — sensitive content masked before storage');
    console.log('📓 Journaling active — hourly organized notes in knowledge graph');
  }

  // ─── Public API ────────────────────────────────────────────

  private async getApiStatus(): Promise<Record<string, unknown>> {
    const streamerStatus = this.streamer?.getStreamStatus ? this.streamer.getStreamStatus() : null;
    const swarmStatus = this.swarm ? await this.swarm.getStatus() : null;
    return {
      initialized: this.initialized,
      uptimeMs: Date.now() - this.startedAt,
      consent: this.consent ? {
        ...this.consent.getState(),
        emergencyStopArmed: this.consent.isEmergencyStopArmed(),
      } : null,
      desktop2: this.desktop2 ? this.desktop2.getState() : null,
      realDesktop: this.realDesktop ? this.realDesktop.getState() : null,
      agentDesktop: this.agentDesktop ? { open: this.agentDesktop.isOpen() } : null,
      streamer: streamerStatus,
      agent: this.agent ? { activeTasks: this.agent.getActiveTasks().length } : null,
      swarm: swarmStatus,
      models: this.configManager.raw.models,
    };
  }

  async submitTask(description: string, priority?: number): Promise<string> {
    if (!this.initialized) throw new Error('Umbra OS not initialized');
    const task = await this.agent.submitTask(description, priority);
    return task.id;
  }

  async executeDesktop2(action: string, params: Record<string, unknown>): Promise<string> {
    if (!this.initialized) throw new Error('Umbra OS not initialized');
    return this.desktop2.executeAction(action, params);
  }

  /** Ghost API — drives the REAL desktop (Desktop 2): real apps, real Chrome
   *  with the user's profile/accounts, real mouse/keyboard input — while the
   *  user keeps using their own desktop. */
  async executeGhost(action: string, params: Record<string, unknown>): Promise<string> {
    if (!this.initialized) throw new Error('Umbra OS not initialized');
    return this.realDesktop.executeAction(action, params);
  }

  /** Capture the current Desktop-2 window as a base64 PNG (for telemetry/UI). */
  async captureGhost(): Promise<string | null> {
    if (!this.initialized) return null;
    const buf = await this.realDesktop.captureWindow();
    return buf ? buf.toString('base64') : null;
  }

  async requestConsent(reason: string): Promise<string> {
    if (!this.initialized) throw new Error('Umbra OS not initialized');
    return this.consent.request(reason);
  }

  async getConsentState(): Promise<any> {
    return this.consent.getState();
  }

  async armEmergencyStop(): Promise<void> {
    this.consent.armEmergencyStop();
  }

  async disarmEmergencyStop(): Promise<void> {
    this.consent.disarmEmergencyStop();
  }

  async getKnowledge(id: string): Promise<any> {
    return this.knowledge.getNode(id);
  }

  async searchKnowledge(query: string): Promise<any> {
    return this.knowledge.search(query);
  }

  async getSwarmStatus(): Promise<any> {
    return this.swarm.getStatus();
  }

  async getAuditStats(): Promise<any> {
    return this.vault.getStats();
  }

  async getRepos(): Promise<any> {
    return this.repos.statusAll();
  }

  async getMcpCatalog(): Promise<any> {
    await this.configManager.syncConnectorCatalog();
    const config = this.configManager.raw.mcp.connectors;
    const active = this.mcpRegistry.list().filter(t => t.transport === 'http').length;
    const entries = config.map(c => {
      const binding = this.mcpRegistry.resolve(c.id, 'invoke');
      return {
        ...c,
        connected: binding?.transport === 'http',
        registered: binding !== undefined,
        apiKeyConfigured: this.credVault.isUnlocked && typeof this.credVault.find(c.credentialKey || c.name) !== 'undefined',
      };
    });
    return { count: entries.length, active, entries };
  }

  async connectMcp(id: string, opts: { baseUrl?: string; apiKey?: string; enabled?: boolean }): Promise<any> {
    const entry = await this.configManager.upsertMcpConnector(id, {
      baseUrl: opts.baseUrl,
      enabled: opts.enabled,
    });
    if (opts.apiKey) {
      if (this.credVault.isUnlocked) {
        this.credVault.set({
          service: entry.credentialKey || entry.name,
          username: 'api-key',
          secret: opts.apiKey,
        });
      } else {
        getLogger().warn({ id }, 'Vault locked — API key not stored');
      }
    } else if (opts.baseUrl && opts.enabled) {
      const cred = this.credVault.find(entry.credentialKey || entry.name);
      if (!cred) {
        getLogger().warn({ id }, 'Connector enabled without stored secret — authType expects one');
      }
    }
    // Re-register in the live registry so the router can dispatch immediately.
    if (opts.enabled && entry.baseUrl) {
      this.mcpRegistry.register(entry.id, 'invoke', {
        endpoint: entry.baseUrl,
        credentialService: entry.credentialKey || entry.name,
      });
    }
    return { connector: entry, registered: opts.enabled && Boolean(entry.baseUrl) };
  }

  async syncExternalConnectors(opts?: { maxPerSource?: number }): Promise<any> {
    const result = await this.mcpExternal.sync({ maxPerSource: opts?.maxPerSource ?? 100 });
    return result;
  }

  async getMacros(): Promise<any> {
    return this.memory.getAllMacros();
  }

  async getActivitySummary(): Promise<any> {
    return this.memory.getActivitySummary();
  }

  async getLearnedPatterns(): Promise<any> {
    return this.memory.getHighConfidencePatterns();
  }

  async getSessions(): Promise<any> {
    return this.memory.getSessions();
  }

  async getPrivacyStats(): Promise<any> {
    return this.privacy.getStats();
  }

  async getPrivacyAudit(): Promise<any> {
    return this.privacy.getAuditLog();
  }

  async addPrivacyRule(type: 'app' | 'url', pattern: string): Promise<void> {
    if (type === 'app') this.privacy.addBlockedApp(pattern);
    else this.privacy.addBlockedUrl(pattern);
  }

  async getDesktop2State(): Promise<any> {
    return this.desktop2.getState();
  }

  async queryJournal(question: string): Promise<string> {
    if (!this.initialized) return 'Umbra OS not initialized';
    return this.journal.queryAgent(question);
  }

  async generateJournalNow(date?: Date): Promise<any> {
    return this.journal.generateDailyJournal(date || new Date());
  }

  async rebuildTopicIndex(): Promise<void> {
    this.topicIndexer.rebuildIndex();
  }

  async manuallingestKnowledge(): Promise<any> {
    return this.bridge.ingestSince(new Date(Date.now() - 86400000));
  }

  async getProactiveSuggestions(): Promise<any> {
    const context = this.memory.getUserActivityPatterns(15);
    return this.proactive['generateSuggestions'](context);
  }

  async analyzePatterns(): Promise<void> {
    await this.macros.analyzePatterns();
  }

  async shutdown(): Promise<void> {
    getLogger().info('Umbra OS shutting down...');
    eventBus.emit('app:shutdown');

    await this.journal.generateDailyJournal().catch(() => {});
    this.topicIndexer.rebuildIndex();
    this.watcher.stop();
    this.proactive.stop();
    this.audio.stop();
    this.healer.stop();
    this.streamer.stop();
    this.shadow?.stop();
    this.p2p?.stop();
    this.pwa?.stop();
    this.repos.close();
    await this.fastEngine.stop();
    await this.api.stop();
    await this.desktop2.stop();
    await this.realDesktop.stop();
    await this.swarm.shutdown();
    await this.displayManager.destroyAll();
    this.memory.close();

    this.initialized = false;
    getLogger().info('Umbra OS shutdown complete');
  }

  get subsystems() {
    return {
      config: this.configManager,
      knowledge: this.knowledge,
      bridge: this.bridge,
      llm: this.llm,
      agent: this.agent,
      consent: this.consent,
      proactive: this.proactive,
      watcher: this.watcher,
      privacy: this.privacy,
      journal: this.journal,
      topicIndexer: this.topicIndexer,
      screenReader: this.screenReader,
      desktop2: this.desktop2,
      realDesktop: this.realDesktop,
      swarm: this.swarm,
      healer: this.healer,
      recall: this.memory,
      vault: this.vault,
      audio: this.audio,
      streamer: this.streamer,
      hud: this.hud,
      pairing: this.pairing,
      p2p: this.p2p,
      pwa: this.pwa,
      graphify: this.graphify,
      skillRecorder: this.skillRecorder,
      skillRouter: this.skillRouter,
      skillRepos: listSkillRepos(),
      mcpRegistry: this.mcpRegistry,
      mcpRouter: this.mcpRouter,
      credVault: this.credVault,
      shadow: this.shadow,
      meetings: this.meetings,
      telnyx: this.telnyx,
      dockerDaemon: this.dockerDaemon,
      metering: this.metering,
    };
  }
}

async function main(): Promise<void> {
  const os = new UmbraOS();
  await os.initialize();

  process.on('SIGINT', async () => {
    await os.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await os.shutdown();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export default UmbraOS;
