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
import { TaskStore } from './core/agent/TaskStore';
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
import { ImageGenerator } from './core/image/ImageGenerator';
import { SpeechToText } from './core/voice/SpeechToText';
import { ScreenAwareness } from './core/awareness/ScreenAwareness';
import { MeetingCompanion } from './core/meeting/MeetingCompanion';
import { detectMeetingProvider, meetingShareScript, meetingStopShareScript, ShareTarget } from './core/meeting/MeetingScreenShare';
import { WindowsTts } from './core/audio/WindowsTts';
import { VibeVoiceTts } from './core/voice/VibeVoiceTts';
import { VoiceboxClient } from './core/voice/VoiceboxClient';
import { LoopbackRecorder } from './core/audio/LoopbackRecorder';
import { CommandHUD } from './overlay/CommandHUD';
import { GlobalHotkey } from './overlay/GlobalHotkey';
import { ApiServer } from './api/ApiServer';
import { PairingManager } from './p2p/PairingManager';
import { P2PConnectionManager, P2PConnectionManagerOptions } from './p2p/P2PConnectionManager';
import { DeviceRegistry } from './p2p/DeviceRegistry';
import { DeviceHub } from './p2p/DeviceHub';
import { DeviceClient } from './p2p/DeviceClient';
import { PwaServer } from './mobile/PwaServer';
import { GraphifyContextEngine } from './core/graphify/GraphifyContextEngine';
import { SkillCompiler } from './core/skill/SkillCompiler';
import { SkillRecorder } from './core/skill/SkillRecorder';
import { SkillRouter } from './core/skill/SkillRouter';
import { McpRegistry } from './core/mcp/McpRegistry';
import { McpRouter } from './core/mcp/McpRouter';
import { McpHttpConnector } from './core/mcp/McpHttpConnector';
import { McpServerEndpoint } from './core/mcp/McpServerEndpoint';
import { ExternalRegistrySync } from './core/mcp/ExternalRegistrySync';
import { CredentialVault } from './core/vault/CredentialVault';
import { LiveShadowEngine } from './core/shadow/LiveShadowEngine';
import { MeetingAgent } from './core/meeting/MeetingAgent';
import { TelnyxClient } from './core/telco/TelnyxClient';
import { DockerDaemon } from './core/docker/DockerDaemon';
import { MeteringService } from './core/metering/MeteringService';
import { ModelRouter, DEFAULT_ROUTING } from './core/metering/ModelRouter';
import { RoutedLLMConnector } from './core/metering/RoutedLLMConnector';
import { ModelProvider, PlanTier } from './types';
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
  private taskStore!: TaskStore;
  private headless: boolean = false;
  private role: 'desktop' | 'cloud' = 'desktop';
  private displayManager!: VirtualDisplayManager;
  private inputGuard!: InputGuard;
  private swarm!: SwarmManager;
  private healer!: SelfHealingGuard;
  private memory!: VectorMemory;
  private watcher?: ActivityWatcher;
  private macros!: MacroSynthesizer;
  private vault!: AuditVault;
  private privacy!: PrivacyGuard;
  private screenReader?: ScreenReader;
  private journal!: JournalGenerator;
  private topicIndexer!: TopicIndexer;
  private desktop2!: Desktop2Environment;
  private realDesktop?: RealDesktop2;
  private agentDesktop?: AgentDesktop;
  private audio!: NoiseCancellationEngine;
  private streamer?: PreviewStreamer;
  private hud?: CommandHUD;
  private hotkey?: GlobalHotkey;
  private openmontage!: OpenMontageBridge;
  private videoProducer!: VideoProducer;
  private imageGen!: ImageGenerator;
  private speechToText?: SpeechToText;
  private api!: ApiServer;
  private pairing?: PairingManager;
  private p2p?: P2PConnectionManager;
  private pwa?: PwaServer;
  private deviceRegistry?: DeviceRegistry;
  private deviceHub?: DeviceHub;
  private deviceClient?: DeviceClient;
  private graphify!: GraphifyContextEngine;
  private skillCompiler!: SkillCompiler;
  private skillRecorder!: SkillRecorder;
  private skillRouter!: SkillRouter;
  private mcpRegistry!: McpRegistry;
  private mcpRouter!: McpRouter;
  private mcpExternal!: ExternalRegistrySync;
  private mcpServer!: McpServerEndpoint;
  private hermes!: HermesAgentBridge;
  private credVault!: CredentialVault;
  private shadow?: LiveShadowEngine;
  private meetings!: MeetingAgent;
  private meetingCompanion?: MeetingCompanion;
  private loopbackRecorder?: LoopbackRecorder;
  private windowsTts?: WindowsTts;
  private vibeVoiceTts?: VibeVoiceTts;
  private voiceboxClient?: VoiceboxClient;
  private awareness?: ScreenAwareness;
  private telnyx!: TelnyxClient;
  private dockerDaemon!: DockerDaemon;
  private metering!: MeteringService;
  private modelRouter!: ModelRouter;
  private startedAt: number = Date.now();
  private resumedTasks: number = 0;

  private initialized: boolean = false;

  async initialize(dataDir?: string): Promise<void> {
    console.log('🌘 Umbra OS v0.1.0 — initializing...');

    const configManager = new ConfigManager(dataDir);
    await configManager.initialize();
    this.configManager = configManager;
    const config = configManager.raw;

    // ── Execution mode: desktop (full, the user's PC) vs cloud (headless) ──
    //    Cloud runs the core (API, agent loop, MCP, memory, routing) without
    //    Windows-native subsystems, so it stays small on a 4 GB box.
    this.role = process.env.UMBRA_ROLE === 'cloud' ? 'cloud' : 'desktop';
    this.headless = process.env.UMBRA_HEADLESS === '1' || this.role === 'cloud';
    if (this.headless) {
      getLogger().info({ role: this.role }, 'Running in headless/cloud mode — desktop subsystems disabled');
    }

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
    this.modelRouter = new ModelRouter({
      config,
      persistPath: path.join(config.paths.dataDir, 'routing-usage.json'),
    });

    // ── LLM (routed + metered: tier selection, rate limits, circuit
    //    breaker, token accounting, plan gate) ────────────────────────
    this.llm = new RoutedLLMConnector(config, this.metering, this.modelRouter);

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
    if (!this.headless) {
      this.screenReader = new ScreenReader(this.privacy, { ocrPoolSize: 2 });
      this.screenReader.setLLM(this.llm);
    }

    // ── Screen Awareness (sees the screen + cursor, answers about it) ──
    //    `watch` keeps the latest frame + cursor trail live so mid-task asks
    //    are answered instantly and Umbra always follows the cursor.
    if (!this.headless && this.screenReader && config.awareness.enabled) {
      this.awareness = new ScreenAwareness({
        llm: this.llm,
        screenReader: this.screenReader,
        watchIntervalMs: config.awareness.watchIntervalMs,
        followCursor: config.awareness.followCursor,
      });
      if (config.awareness.watch !== false) {
        this.awareness.startWatching(config.awareness.watchIntervalMs);
      }
    }

    // ── Recall (everything is logged here, vector-indexed) ───
    this.memory = new VectorMemory(config.paths.recallDb, { enableVec: true });
    this.memory.setEmbedder(text => this.llm.createEmbedding(text));
    this.memory.initialize();

    // ── Journal Generator (hourly/daily organized brain) ─────
    this.journal = new JournalGenerator(this.memory, this.knowledge, this.privacy, config.paths.knowledgeDir);
    this.journal.initialize();
    this.topicIndexer = new TopicIndexer(config.paths.knowledgeDir);
    this.topicIndexer.initialize();

    // ── Activity Watcher (watches your every move) — desktop only ──
    if (!this.headless && this.screenReader) {
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
    }

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

    // ── Agent Desktop (persistent agent Chrome with CDP) — desktop only ──
    if (!this.headless) {
      this.agentDesktop = new AgentDesktop(this.consent, path.join(config.paths.dataDir, 'workspace'), {
        path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        cdpPort: 9223,
        profileDir: path.join(config.paths.dataDir, 'chrome-agent-profile'),
      });
    }

    // ── RealDesktop2 — "human mode": real apps + real Chrome on a 2nd desktop ──
    if (!this.headless && this.screenReader) {
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
    }

    // ── Fast Engine (browser-use bridge in the user's Chrome) ──
    this.fastEngine = new BrowserUseBridge(
      path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe'),
      path.join(__dirname, '..', 'scripts', 'browser-use', 'bridge.py'),
    );
    const engine = process.env['UMBRA_ENGINE'] || 'browseruse';
    if (engine === 'browseruse' && !this.headless) {
      await this.fastEngine.start();
    } else if (engine === 'browseruse') {
      getLogger().info('Fast engine disabled (headless) — cloud tasks use the step loop / built-in reasoning engine');
    } else {
      getLogger().info('Fast engine disabled (UMBRA_ENGINE=desktop2) — using Desktop 2 loop');
    }

    // ── Video production (Remotion + OpenMontage tool registry) ──
    this.openmontage = new OpenMontageBridge();
    this.videoProducer = new VideoProducer(this.llm, this.openmontage);
    this.imageGen = new ImageGenerator(config);
    this.speechToText = new SpeechToText(config);
    this.vibeVoiceTts = new VibeVoiceTts({
      repoDir: path.join(__dirname, '..', 'external', 'VibeVoice'),
      python: path.join(__dirname, '..', 'external', 'VibeVoice', '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python'),
      model: config.voice.vibevoiceModel,
      device: config.voice.vibevoiceDevice,
      outputDir: path.join(config.paths.dataDir, 'tts'),
    });
    this.voiceboxClient = new VoiceboxClient({ baseUrl: config.voice.voiceboxUrl });
    if (!this.openmontage.isInstalled()) {
      getLogger().warn('OpenMontage not installed — video production disabled (external/OpenMontage)');
    }

    // ── Agent Systems ────────────────────────────────────────
    this.taskPlanner = new TaskPlanner(this.knowledge, this.llm, this.memory);
    this.repos = new ReposManager(config.repos);
    // Durable task queue — in-flight tasks survive restarts, and a cloud node
    // can resume the PC's queue when it shares this directory.
    this.taskStore = new TaskStore(path.join(config.paths.dataDir, 'task-queue'));
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
      autoDelegate: config.hermes.autoDelegate,
      taskStore: this.taskStore,
      nodeRole: this.role,
    });

    // ── Deep Understanding (LLM-powered research & expansion) ─
    this.deepEngine = new DeepUnderstandingEngine(this.memory, this.knowledge);
    this.deepEngine.setLLM(this.llm);

    // ── Proactive Agent (acts without being asked) — desktop only ──
    if (!this.headless && this.watcher) {
      this.proactive = new ProactiveAgent(this.memory, this.knowledge, this.watcher, this.bridge, this.deepEngine);
      this.proactive.setAgent(this.agent);
      this.proactive.setLLM(this.llm);
    }

    // ── Macro Synthesizer ────────────────────────────────────
    this.macros = new MacroSynthesizer(this.memory);
    this.macros.setLLM(this.llm);
    this.macros.setAgent(this.agent);

    // ── Audio DSP ────────────────────────────────────────────
    this.audio = new NoiseCancellationEngine(config.audio.gestureCooldownMs);

    // ── Preview Streamer (real frames from Desktop 2 via ws) — desktop only ──
    if (!this.headless) {
      this.streamer = new PreviewStreamer({
        enabled: true,
        port: 9090,
        fps: 5,
      });
      this.streamer.setFrameProvider(() => this.realDesktop?.captureWindow() ?? this.desktop2.screenshot());
      const ghostEngine = (process.env['UMBRA_ENGINE'] || 'browseruse') !== 'browseruse';
      this.streamer.setCommandHandler((action, params) =>
        ghostEngine ? this.executeGhost(action, params) : this.desktop2.executeAction(action, params),
      );
    }

    // ── Command HUD — desktop only ────────────────────────────
    if (!this.headless) {
      this.hud = new CommandHUD();
      this.hud.registerSubsystems({
        agent: this.agent,
        macros: this.macros,
        config: this.configManager,
        knowledge: this.knowledge,
        screenAsk: (q, intent) => this.screenAsk(q, intent),
      });

      // Global hotkey (Ctrl+Shift+Space) toggles the ask overlay. The
      // listener polls GetAsyncKeyState through the NativeCore daemon and
      // emits overlay:toggle, which the HUD handles.
      const hudHotkey = config.hotkeys.pause || 'Ctrl+Shift+Space';
      if (hudHotkey) {
        this.hotkey = new GlobalHotkey({ combo: hudHotkey, pollMs: 200 });
        this.hotkey.start();
      }
    }

    // ── API Server (REST + WS for the read-only UI) ──────────
    this.api = new ApiServer({
      getStatus: () => this.getApiStatus(),
      submitTask: (description, priority) => this.submitTask(description, priority),
      chat: (message, target) => this.dispatchTask(message, target || 'auto'),
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
      getModelStatus: () => this.getModelStatus(),
      testLlm: () => this.testLlm(),
      configureProvider: patch => this.configureProvider(patch),
      activatePlan: tier => this.activatePlan(tier),
      getProviderConfig: () => this.getProviderConfig(),
      listOpenMontageTools: () => this.listOpenMontageTools(),
      generateImage: (prompt, opts) => this.generateImage(prompt, opts),
      getVoiceStatus: () => this.getVoiceStatus(),
      transcribeAudio: (audio, opts) => this.transcribeAudio(audio, opts),
      speakText: (text, opts) => this.speakOut(text, opts),
      listTtsVoices: () => this.listTtsVoices(),
      recallMemory: q => this.recallMemory(q),
      rememberMemory: text => this.rememberMemory(text),
      screenAsk: (question, intent) => this.screenAsk(question, intent),
      screenState: () => this.screenState(),
      screenLive: () => this.screenLive(),
      screenWatch: enabled => this.screenWatch(enabled),
      meetingJoin: (url, opts) => this.meetingJoin(url, opts),
      meetingStartListening: () => this.meetingStartListening(),
      meetingStatus: () => this.meetingStatus(),
      meetingLeave: () => this.meetingLeave(),
      meetingExecute: (action, params) => this.meetingExecute(action, params),
      meetingFeedAudio: (audio, format) => this.meetingFeedAudio(audio, format),
      meetingShare: target => this.meetingShare(target),
      meetingStopShare: () => this.meetingStopShare(),
      meetingOrders: () => this.meetingOrders(),
      meetingSpeak: (text, opts) => this.meetingSpeak(text, opts),
      listDevices: () => this.getDevices(),
      createDeviceInvite: name => this.createDeviceInvite(name),
      joinDevice: (code, meta) => this.joinDevice(code, meta),
      revokeDevice: deviceId => this.revokeDevice(deviceId),
      sendToDevice: (deviceId, msg) => this.sendToDevice(deviceId, msg),
      delegateHermes: (description, opts) => this.agent.delegateTask(description, opts),
      generateJournalNow: () => this.generateJournalNow(),
      mcpHandle: message => this.mcpServer.handle(message),
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
    this.mcpRouter = new McpRouter(this.mcpRegistry, {
      connector: httpConnector,
      // Dynamically-dispatched native tools: OpenMontage registers itself by
      // tool name, so the resolver looks the binding up at call time.
      nativeResolver: binding => {
        if (binding.skill !== 'openmontage') return undefined;
        return async (input: Record<string, unknown>) => {
          const result = await this.openmontage.runTool(binding.tool, input);
          if (!result.success) throw new Error(result.error || `OpenMontage tool ${binding.tool} failed`);
          return result.data;
        };
      },
    });
    // Expose Umbra's connectors as an MCP server so the built-in reasoning
    // engine can call them through the same vault-gated router.
    this.mcpServer = new McpServerEndpoint(this.mcpRegistry, this.mcpRouter);
    this.mcpExternal = new ExternalRegistrySync(this.mcpRegistry, { dedupe: true });

    // ── P2P: pairing + signaling + PWA control plane — desktop only ──
    if (config.p2p.enabled && !this.headless) {
      this.pairing = new PairingManager({ dataDir: config.paths.dataDir });
      const pairing = this.pairing;
      const p2pOptions: P2PConnectionManagerOptions = {
        signalingPort: config.p2p.signalingPort,
        pairing,
        stunServers: config.p2p.stunServers,
        relayFps: config.p2p.relayFps,
      };
      const p2p = new P2PConnectionManager(p2pOptions);
      this.p2p = p2p;
      p2p.start();
      const pwa = new PwaServer({
        webPort: config.p2p.webPort,
        signalingPort: config.p2p.signalingPort,
        pairing,
        getStatus: () => {
          const status = p2p.getStatus();
          return {
            active: status.active,
            clients: status.clients,
            pairedDevices: status.pairedDevices,
          };
        },
        onChat: (message, target) => this.dispatchTask(message, target || 'auto'),
      });
      this.pwa = pwa;
      pwa.start();

      // Phone control plane drives the real desktop (or Desktop 2) and
      // streams live frames back to the PWA.
      p2p.setCommandHandler((action, params) =>
        (process.env['UMBRA_ENGINE'] || 'browseruse') !== 'browseruse'
          ? this.executeGhost(action, params)
          : this.executeDesktop2(action, params),
      );
      p2p.setFrameProvider(async () => this.realDesktop?.captureWindow() ?? this.desktop2.screenshot());
    }

    // ── Device mesh (always-on hub + auto-reconnecting client) ──
    //    Every node runs a DeviceHub so a phone can pair directly on the LAN
    //    or a cloud box can be the single always-on hub. When hubUrl is set,
    //    this node ALSO connects as a client to that remote hub and stays
    //    connected forever (auto-reconnect + persisted token).
    if (config.devices.enabled) {
      this.deviceRegistry = new DeviceRegistry({ dataDir: config.paths.dataDir });
      this.deviceHub = new DeviceHub({ registry: this.deviceRegistry, port: config.devices.hubPort });
      this.deviceHub.start();
      this.startDeviceClient();
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

    // ── OpenMontage tool registry (external video suite) ──────────
    // Discover the installed OpenMontage tools and expose each as a native
    // MCP tool so the agent loop can produce video through the same router.
    this.syncOpenMontageTools().catch(() => getLogger().debug('OpenMontage tool sync skipped'));
    this.agent.registerSubsystems({
      skillRouter: this.skillRouter,
      skillRecorder: this.skillRecorder,
      mcpRouter: this.mcpRouter,
      metering: this.metering,
      graphify: this.graphify,
    });

    // ── Live Shadowing (real screen watch + takeover) — desktop only ──
    if (!this.headless) {
      this.shadow = new LiveShadowEngine({
        captureIntervalMs: Math.round(1000 / config.shadow.fps),
        captureWindow: true,
      });
    }

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

    // ── Meeting Companion (join/hear/act/leave) — desktop only ──
    if (!this.headless) {
      this.loopbackRecorder = new LoopbackRecorder({ dataDir: config.paths.dataDir });
      this.windowsTts = new WindowsTts(config.paths.dataDir);
      this.meetingCompanion = new MeetingCompanion({
        stt: this.speechToText.available
          ? {
              transcribe: async (audio: Buffer, format?: string) => {
                const r = await this.speechToText!.transcribe({ audio, format: format as 'wav' | 'mp3' | 'webm' });
                return { text: r.text };
              },
            }
          : undefined,
        recorder: config.meeting.loopbackEnabled ? this.loopbackRecorder : undefined,
        onJoin: url =>
          this.realDesktop
            ? this.realDesktop.openChrome(url)
            : Promise.resolve('Real desktop unavailable — open the meeting URL manually'),
        onExecute: (action, params) => this.executeGhost(action, params),
        onShareScreen: target => this.shareScreenInMeeting(target),
        onStopShare: () => this.stopScreenShareInMeeting(),
        onSearch: query => this.searchForMeeting(query),
        onNote: text => this.noteForMeeting(text),
        onReminder: text => this.reminderForMeeting(text),
        onSpeak: (text, opts) => this.speakForMeeting(text, opts),
        summarize: async (transcript: string) => {
          const res = await this.llm.complete(
            [{ role: 'user', content: `Summarize this meeting in at most 300 tokens:\n\n${transcript}` }],
            'fast',
          );
          return res.content;
        },
        chunkSec: config.meeting.chunkSec,
        ordersEnabled: config.meeting.ordersEnabled !== false,
      });
    }

    // ── Start subsystems ─────────────────────────────────────
    await this.swarm.initialize();
    await this.desktop2.start();
    this.streamer?.start();
    this.api.start();

    // ── Hidden engine: expose the connector bridge to the agent CLI ──
    // Registers Umbra's /mcp server (all catalog connectors, vault-backed)
    // with the built-in reasoning engine's config, so delegated agentic work
    // can call every connector through Umbra. Idempotent and non-blocking.
    // Umbra's own LLM key is also provisioned to the engine so it runs with
    // the same credentials the app already uses.
    if (config.hermes.enabled) {
      const engineEnv: Record<string, string> = {};
      if (config.provider === 'openai' && config.openai?.apiKey) engineEnv['OPENAI_API_KEY'] = config.openai.apiKey;
      if (config.provider === 'anthropic' && config.anthropic?.apiKey) engineEnv['ANTHROPIC_API_KEY'] = config.anthropic.apiKey;
      if (config.provider === 'openai-compatible' && config.openaiCompatible?.apiKey) {
        engineEnv['OPENAI_API_KEY'] = config.openaiCompatible.apiKey;
      }
      this.hermes
        .registerMcpBridge(`http://127.0.0.1:8787/mcp`)
        .then(() => this.hermes.syncProviderCredentials(engineEnv))
        .catch(() => getLogger().debug('Agent engine bridge registration skipped'));
    }

    this.watcher?.start();
    this.healer.start(5000);
    this.audio.start();
    this.proactive?.start();

    // ── Live Shadowing (watch + takeover the real screen) ────
    if (config.shadow.enabled && this.shadow) {
      this.shadow.start();
    }

    // ── MCP connectors from config + full catalog (vault-backed credentials)
    //    Deploy the entire catalog into config so every connector is visiable
    //    and registered, and mark those the user has enabled as connected.
    await this.configManager.syncConnectorCatalog();
    const deployedConnectors = this.configManager.raw.mcp.connectors;
    for (const connector of deployedConnectors) {
      this.mcpRegistry.register(connector.id, connector.tool || 'invoke', {
        endpoint: connector.enabled && connector.baseUrl ? connector.baseUrl : undefined,
        credentialService: connector.credentialKey || connector.name,
        apiKeyHeader: connector.apiKeyHeader,
        authType: connector.authType,
      });
    }

    getLogger().info({ tools: this.mcpRegistry.list().length, connectors: deployedConnectors.length, engine: config.hermes.enabled }, 'MCP registry ready');

    // ── Agent browser: launch once at boot, reused by all tasks ──
    // (ghost/desktop2 modes own Chrome themselves — RealDesktop2 uses the
    //  user's REAL profile; let the agent-chrome instance start on demand)
    if ((process.env['UMBRA_ENGINE'] || 'browseruse') === 'browseruse') {
      this.agentDesktop?.ensure().catch(() => {});
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

    // ── Resume in-flight tasks from the durable queue ──────────
    //    Desktop always resumes its own queue; cloud resumes only for paid
    //    plans (cloud continuation is not part of the free plan).
    this.resumedTasks = await this.agent.resumePendingTasks(this.role, config.plan.tier);

    getLogger().info({
      provider: config.provider,
      model: config.models.reasoning,
      swarmSlots: config.workspace.maxSwarmDisplays,
      headless: this.headless,
      role: this.role,
      resumedTasks: this.resumedTasks,
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
      execution: {
        role: this.role,
        headless: this.headless,
        resumedTasks: this.resumedTasks,
        cloudContinuation: this.configManager.raw.plan.cloudContinuation === true,
        plan: this.configManager.raw.plan.tier,
      },
      devices: this.deviceHub ? this.deviceHub.getStatus() : null,
    };
  }

  async submitTask(description: string, priority?: number): Promise<string> {
    if (!this.initialized) throw new Error('Umbra OS not initialized');
    const task = await this.agent.submitTask(description, priority);
    return task.id;
  }

  /**
   * Talk to Umbra: dispatch a task and let it spin up agents wherever they
   * belong. `target` is 'auto' (route to an online desktop if one is
   * connected, else run here), 'cloud'/'local' (run on this node), or a
   * specific deviceId. Returns the assigned task id and where it runs.
   */
  async dispatchTask(description: string, target: string = 'auto'): Promise<{ taskId: string; target: string }> {
    if (target === 'auto') {
      const desktop = this.findOnlineDesktop();
      if (desktop && this.deviceHub) {
        const reply = await this.deviceHub.request(desktop, { t: 'task', description });
        return { taskId: String(reply.taskId || ''), target: desktop };
      }
      const taskId = await this.submitTask(description);
      return { taskId, target: this.role };
    }
    if (target === 'cloud' || target === 'local') {
      const taskId = await this.submitTask(description);
      return { taskId, target: this.role };
    }
    if (!this.deviceHub) throw new Error('Device mesh disabled');
    const reply = await this.deviceHub.request(target, { t: 'task', description });
    return { taskId: String(reply.taskId || ''), target };
  }

  private findOnlineDesktop(): string | null {
    if (!this.deviceRegistry || !this.deviceHub) return null;
    for (const d of this.deviceRegistry.listDevices()) {
      if (d.role === 'desktop' && this.deviceHub.isOnline(d.deviceId)) {
        return d.deviceId;
      }
    }
    return null;
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
    if (!this.realDesktop) throw new Error('Real desktop control unavailable in headless/cloud mode');
    return this.realDesktop.executeAction(action, params);
  }

  /** Capture the current Desktop-2 window as a base64 PNG (for telemetry/UI). */
  async captureGhost(): Promise<string | null> {
    if (!this.initialized || !this.realDesktop) return null;
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
    } else if (opts.baseUrl && opts.enabled && entry.authType !== 'none') {
      const cred = this.credVault.find(entry.credentialKey || entry.name);
      if (!cred) {
        getLogger().warn({ id }, 'Connector enabled without stored secret — authType expects one');
      }
    }
    // Re-register in the live registry so the router can dispatch immediately.
    if (opts.enabled && entry.baseUrl) {
      this.mcpRegistry.register(entry.id, entry.tool || 'invoke', {
        endpoint: entry.baseUrl,
        credentialService: entry.credentialKey || entry.name,
        apiKeyHeader: entry.apiKeyHeader,
        authType: entry.authType,
      });
    }
    return { connector: entry, registered: opts.enabled && Boolean(entry.baseUrl) };
  }

  async syncExternalConnectors(opts?: { maxPerSource?: number }): Promise<any> {
    const result = await this.mcpExternal.sync({ maxPerSource: opts?.maxPerSource ?? 100 });
    return result;
  }

  // ── Model routing / plans / BYOK ───────────────────────────

  async getModelStatus(): Promise<any> {
    const snap = this.modelRouter.snapshot();
    return {
      provider: this.configManager.raw.provider,
      models: this.configManager.raw.models,
      plan: snap.plan,
      planName: snap.planName,
      monthlyPriceUsd: snap.monthlyPriceUsd,
      budget: {
        monthlyBudgetUsd: snap.monthlyBudgetUsd,
        spentUsd: snap.spentUsd,
        remainingUsd: snap.remainingUsd,
        slotBudgets: snap.slotBudgets,
        spentBySlot: snap.spentBySlot,
      },
      routing: {
        enabled: snap.enabled,
        optimizations: snap.optimizations,
        maxOutputTokens: snap.maxOutputTokens,
        tiers: snap.tiers,
      },
      plans: snap.plans,
      metering: this.metering.snapshot(),
    };
  }

  /** Make a tiny live completion to validate the configured provider/key. */
  async testLlm(): Promise<any> {
    const started = Date.now();
    const res = await this.llm.complete(
      [{ role: 'user', content: 'Reply with the single word: ok' }],
      'fast',
      { maxTokens: 8, temperature: 0 },
    );
    return {
      ok: true,
      model: res.modelUsed,
      tokens: res.totalTokens,
      latencyMs: Date.now() - started,
      content: res.content.slice(0, 200),
    };
  }

  /**
   * Activate a paid plan after payment succeeds. This is the hook a billing
   * provider (Stripe / LemonSqueezy webhook or manual admin call) triggers
   * once a user pays — it flips the tier, enables routing + the token-saving
   * stack, and the $5/$10 monthly token budget (pre-split per model slot) is
   * applied automatically from the plan profile.
   */
  async activatePlan(tier: string): Promise<any> {
    const allowed: PlanTier[] = ['free', 'byok', 'pro', 'ultimate'];
    const t = tier as PlanTier;
    if (!allowed.includes(t)) throw new Error(`Unknown plan: ${tier}`);

    const cm = this.configManager;
    cm.raw.plan.tier = t;

    // Hosted plans turn on routing + the full token-saving stack.
    if (t === 'pro' || t === 'ultimate') {
      cm.raw.plan.routing = cm.raw.plan.routing ?? { ...DEFAULT_ROUTING };
      cm.raw.plan.routing.enabled = true;
      cm.raw.plan.routing.graphify = true;
      cm.raw.plan.routing.caveman = true;
      cm.raw.plan.routing.cacheHitRatio = cm.raw.plan.routing.cacheHitRatio || DEFAULT_ROUTING.cacheHitRatio;
    }
    // Cloud continuation (resuming in-flight tasks on the cloud node) is a
    // paid feature: paid tiers get it, free does not.
    cm.raw.plan.cloudContinuation = t !== 'free';
    await cm.saveConfig();

    this.metering.setTier(t);
    const config = cm.raw;
    this.llm.updateConfig(config);
    this.modelRouter.updateConfig(config);

    getLogger().info({ tier: t }, 'Plan activated — token budget assigned');
    return this.getModelStatus();
  }

  /** Bring-your-own-key: point Umbra at the user's provider + keys/models. */
  async configureProvider(patch: {
    provider?: string;
    endpoint?: string;
    apiKey?: string;
    models?: { reasoning?: string; vision?: string; fast?: string; embedding?: string };
    tier?: string;
  }): Promise<any> {
    const cm = this.configManager;
    if (patch.provider) {
      await cm.updateProvider(patch.provider as ModelProvider, {
        reasoning: patch.models?.reasoning,
        vision: patch.models?.vision,
        fast: patch.models?.fast,
        embedding: patch.models?.embedding,
      });
    }
    if (patch.endpoint || patch.apiKey) {
      const provider = (patch.provider || cm.raw.provider) as ModelProvider;
      const creds: { endpoint?: string; apiKey?: string } = {};
      if (patch.endpoint !== undefined) creds.endpoint = patch.endpoint;
      if (patch.apiKey !== undefined) creds.apiKey = patch.apiKey;
      await cm.updateProviderCredentials(provider, creds);
    }
    if (patch.tier) {
      cm.raw.plan.tier = patch.tier as PlanTier;
      await cm.saveConfig();
      this.metering.setTier(patch.tier as PlanTier);
    }
    const config = cm.raw;
    this.llm.updateConfig(config);
    this.modelRouter.updateConfig(config);
    return this.getProviderConfig();
  }

  async getProviderConfig(): Promise<any> {
    const c = this.configManager.raw;
    const mask = (k?: string) => (k ? (k.length <= 8 ? '••••' : `••••${k.slice(-4)}`) : undefined);
    return {
      provider: c.provider,
      models: c.models,
      endpoints: {
        ollama: c.ollama?.endpoint,
        openai: c.openai?.endpoint,
        anthropic: 'https://api.anthropic.com/v1/messages',
        openaiCompatible: c.openaiCompatible?.endpoint,
      },
      keys: {
        openai: mask(c.openai?.apiKey),
        anthropic: mask(c.anthropic?.apiKey),
        openaiCompatible: mask(c.openaiCompatible?.apiKey),
      },
      plan: c.plan.tier,
    };
  }

  // ── OpenMontage tool registry ──────────────────────────────

  async listOpenMontageTools(): Promise<any> {
    const installed = this.openmontage.isInstalled();
    const tools = installed ? await this.openmontage.listTools() : [];
    return { installed, repoDir: this.openmontage.repoDir, count: tools.length, tools };
  }

  // ── Image generation (Flux Schnell) ─────────────────────────

  async generateImage(prompt: string, opts?: { width?: number; height?: number; steps?: number }): Promise<any> {
    return this.imageGen.generate(prompt, {
      width: opts?.width,
      height: opts?.height,
      steps: opts?.steps,
    });
  }

  // ── Voice-to-text (STT) ───────────────────────────────────

  async getVoiceStatus(): Promise<any> {
    return {
      enabled: this.speechToText?.available ?? false,
      provider: this.speechToText?.provider ?? 'none',
      model: this.configManager.raw.voice.sttModel,
    };
  }

  async transcribeAudio(audioBase64: string, opts?: { format?: string; language?: string }): Promise<any> {
    if (!this.speechToText) throw new Error('Voice service not configured');
    const audio = Buffer.from(audioBase64, 'base64');
    const result = await this.speechToText.transcribe({
      audio,
      format: (opts?.format as 'wav' | 'mp3' | 'ogg' | 'webm' | 'flac' | 'm4a') || 'webm',
      language: opts?.language,
    });
    return { ...result };
  }

  // ── Persistent memory recall (past sessions / tasks) ──────────

  async recallMemory(query: string): Promise<any> {
    const similar = await this.memory.searchSimilar(query, { k: 10, kind: 'task' });
    const recent = this.memory.getRecentActivity(20);
    const facts = this.memory.getFacts(50);
    return {
      query,
      facts: facts.map(f => ({ text: f.text, createdAt: f.createdAt })),
      similar: similar.map(s => ({ text: s.text, distance: s.distance, createdAt: s.createdAt })),
      recent: recent.map(r => ({ description: r.description, status: r.status, createdAt: r.createdAt })),
    };
  }

  /** Store a permanent fact the user told the assistant about themselves. */
  async rememberMemory(text: string): Promise<any> {
    const id = this.memory.rememberFact(text);
    return { id, remembered: text, total: this.memory.getFacts().length };
  }

  // ── Screen awareness (see the screen + cursor, ask about it) ──

  async screenAsk(question: string, intent?: string): Promise<any> {
    if (!this.awareness) throw new Error('Screen awareness not available (headless/cloud mode)');
    return this.awareness.ask(question, intent === 'help' ? 'help' : 'answer');
  }

  async screenState(): Promise<any> {
    if (!this.awareness) throw new Error('Screen awareness not available (headless/cloud mode)');
    const s = await this.awareness.snapshot();
    return { snapshot: s ? s.snapshot : null };
  }

  /** Live screen view: latest frame metadata + cursor trail, no re-capture. */
  async screenLive(): Promise<any> {
    if (!this.awareness) throw new Error('Screen awareness not available (headless/cloud mode)');
    const latest = this.awareness.latest();
    return {
      watching: this.awareness.isWatching,
      snapshot: latest ? latest.snapshot : null,
      cursorTrail: this.awareness.cursorTrail(),
    };
  }

  /** Start/stop the always-on screen + cursor watch loop. */
  async screenWatch(enabled: boolean): Promise<any> {
    if (!this.awareness) throw new Error('Screen awareness not available (headless/cloud mode)');
    if (enabled) this.awareness.startWatching();
    else this.awareness.stopWatching();
    return { watching: this.awareness.isWatching };
  }

  // ── Meeting companion (join / hear / act / leave) ──────────

  async meetingJoin(url: string, opts?: { title?: string; topics?: string[] }): Promise<any> {
    if (!this.meetingCompanion) throw new Error('Meeting companion not available (headless/cloud mode)');
    return this.meetingCompanion.join(url, opts);
  }

  async meetingStartListening(): Promise<any> {
    if (!this.meetingCompanion) throw new Error('Meeting companion not available (headless/cloud mode)');
    this.meetingCompanion.startListening();
    return { status: this.meetingCompanion.status() };
  }

  async meetingStatus(): Promise<any> {
    return { meeting: this.meetingCompanion?.status() ?? null };
  }

  async meetingLeave(): Promise<any> {
    if (!this.meetingCompanion) throw new Error('No active meeting');
    return this.meetingCompanion.leave();
  }

  async meetingExecute(action: string, params: Record<string, unknown>): Promise<any> {
    if (!this.meetingCompanion) throw new Error('Meeting companion not available (headless/cloud mode)');
    return { result: await this.meetingCompanion.execute(action, params) };
  }

  async meetingFeedAudio(audioBase64: string, format?: string): Promise<any> {
    if (!this.meetingCompanion) throw new Error('Meeting companion not available (headless/cloud mode)');
    const segment = await this.meetingCompanion.feedAudio(Buffer.from(audioBase64, 'base64'), format || 'webm');
    return { segment };
  }

  async meetingShare(target?: string): Promise<any> {
    if (!this.meetingCompanion) throw new Error('Meeting companion not available (headless/cloud mode)');
    return { result: await this.meetingCompanion.shareScreen(target) };
  }

  async meetingStopShare(): Promise<any> {
    if (!this.meetingCompanion) throw new Error('Meeting companion not available (headless/cloud mode)');
    return { result: await this.meetingCompanion.stopShare() };
  }

  async meetingOrders(): Promise<any> {
    return { orders: this.meetingCompanion?.getOrders() ?? [] };
  }

  async meetingSpeak(text: string, opts?: { voice?: string; language?: string }): Promise<any> {
    if (!this.meetingCompanion) throw new Error('Meeting companion not available (headless/cloud mode)');
    return { result: await this.meetingCompanion.speak(text, opts) };
  }

  /** Speak in a meeting using the configured TTS provider (meeting.tts). */
  private async speakForMeeting(text: string, opts?: { voice?: string; language?: string }): Promise<string> {
    const tts = this.configManager.raw.meeting.tts;
    if (tts === 'voicebox') {
      if (!this.voiceboxClient || !(await this.voiceboxClient.isRunning())) {
        throw new Error('Voicebox is not running — start the Voicebox app (http://127.0.0.1:17493)');
      }
      const voice = this.configManager.raw.voice;
      await this.voiceboxClient.speak(text, {
        profile: opts?.voice || voice.voiceboxProfile || undefined,
        language: opts?.language,
        engine: voice.voiceboxEngine,
      });
      return 'Spoke (voicebox)'; 
    }
    if (tts === 'vibevoice') {
      if (!this.vibeVoiceTts?.installed) {
        throw new Error('VibeVoice not installed — run scripts/vibevoice-install.sh (needs Python 3.10+ and a GPU recommended)');
      }
      const res = await this.vibeVoiceTts.speak(text, {
        voice: opts?.voice || this.configManager.raw.voice.vibevoiceVoice,
        language: opts?.language || this.configManager.raw.voice.vibevoiceLanguage,
      });
      return `Spoke (${res.voice})`;
    }
    if (tts === 'local') {
      if (!this.windowsTts?.available) throw new Error('Windows TTS is only available on Windows');
      await this.windowsTts.speak(text);
      return 'Spoke';
    }
    throw new Error('Meeting TTS is disabled — set meeting.tts to local or vibevoice');
  }

  /** Speak on the PC (outside a meeting), optionally with a voice/language. */
  async speakOut(text: string, opts?: { voice?: string; language?: string; provider?: string; engine?: string }): Promise<any> {
    const v = this.configManager.raw.voice;
    const provider = opts?.provider ?? (this.vibeVoiceTts?.installed ? 'vibevoice' : 'windows');
    if (provider === 'voicebox') {
      if (!this.voiceboxClient || !(await this.voiceboxClient.isRunning())) {
        throw new Error('Voicebox is not running — start the Voicebox app (http://127.0.0.1:17493)');
      }
      await this.voiceboxClient.speak(text, {
        profile: opts?.voice || v.voiceboxProfile || undefined,
        language: opts?.language,
        engine: opts?.engine || v.voiceboxEngine,
      });
      return { result: 'Spoke (voicebox)', voice: opts?.voice || v.voiceboxProfile };
    }
    if (provider === 'vibevoice') {
      if (!this.vibeVoiceTts?.installed) {
        throw new Error('VibeVoice not installed — run scripts/vibevoice-install.sh');
      }
      const res = await this.vibeVoiceTts.speak(text, {
        voice: opts?.voice || v.vibevoiceVoice,
        language: opts?.language || v.vibevoiceLanguage,
      });
      return { result: `Spoke (${res.voice})`, voice: res.voice, language: res.language, path: res.path };
    }
    if (provider === 'windows' || provider === 'local') {
      if (!this.windowsTts?.available) throw new Error('Windows TTS is only available on Windows');
      await this.windowsTts.speak(text);
      return { result: 'Spoke (Windows SAPI)' };
    }
    throw new Error(`Unknown TTS provider: ${provider} (use voicebox, vibevoice or windows)`);
  }

  /** List the available TTS providers + voices (VibeVoice speakers, Voicebox profiles). */
  async listTtsVoices(): Promise<any> {
    let voiceboxRunning = false;
    let voiceboxProfiles: any[] = [];
    if (this.voiceboxClient) {
      voiceboxRunning = await this.voiceboxClient.isRunning().catch(() => false);
      voiceboxProfiles = voiceboxRunning ? await this.voiceboxClient.listProfiles().catch(() => []) : [];
    }
    return {
      windows: this.windowsTts?.available ?? false,
      vibevoice: {
        installed: this.vibeVoiceTts?.installed ?? false,
        model: this.configManager.raw.voice.vibevoiceModel,
        defaultVoice: this.configManager.raw.voice.vibevoiceVoice,
        defaultLanguage: this.configManager.raw.voice.vibevoiceLanguage,
        voices: this.vibeVoiceTts?.listVoices() ?? [],
      },
      voicebox: {
        running: voiceboxRunning,
        url: this.configManager.raw.voice.voiceboxUrl,
        defaultProfile: this.configManager.raw.voice.voiceboxProfile,
        profiles: voiceboxProfiles,
      },
    };
  }

  // ── Meeting screen-share + order helpers (best-effort DOM automation) ──

  private async shareScreenInMeeting(target?: string): Promise<string> {
    if (this.configManager.raw.meeting.screenShare === false) {
      throw new Error('Screen sharing is disabled (meeting.screenShare)');
    }
    const provider = detectMeetingProvider(this.meetingCompanion?.status()?.url || '');
    const shareTarget: ShareTarget = target === 'window' || target === 'tab' ? target : 'screen';
    try {
      return await this.meetingTabJs(meetingShareScript(provider, shareTarget));
    } catch (err: any) {
      return `Screen-share automation failed: ${err.message}. Click the Share button in the meeting yourself.`;
    }
  }

  private async stopScreenShareInMeeting(): Promise<string> {
    if (this.configManager.raw.meeting.screenShare === false) {
      throw new Error('Screen sharing is disabled (meeting.screenShare)');
    }
    const provider = detectMeetingProvider(this.meetingCompanion?.status()?.url || '');
    try {
      return await this.meetingTabJs(meetingStopShareScript(provider));
    } catch (err: any) {
      return `Stop-share automation failed: ${err.message}. Click "Stop sharing" yourself.`;
    }
  }

  /** Run a JS snippet in the meeting tab (the user's real Chrome). */
  private async meetingTabJs(expression: string): Promise<string> {
    if (!this.realDesktop) throw new Error('Real desktop control unavailable');
    return this.realDesktop.evaluate(expression);
  }

  /** Answer a search order without disturbing the meeting (LLM-grounded). */
  private async searchForMeeting(query: string): Promise<string> {
    const res = await this.llm.complete(
      [{ role: 'user', content: `Answer this question concisely (the user is in a meeting and needs a quick answer): ${query}` }],
      'fast',
      { maxTokens: 400 },
    );
    return res.content;
  }

  private async noteForMeeting(text: string): Promise<string> {
    if (text) this.memory.rememberFact(`Meeting note: ${text}`);
    return `Note recorded: ${text}`;
  }

  private async reminderForMeeting(text: string): Promise<string> {
    if (text) this.memory.rememberFact(`Reminder: ${text}`);
    return `Reminder set: ${text}`;
  }

  // ── Device mesh (always-on hub + auto-reconnecting client) ──

  /** Connect this node to a remote hub (the cloud) with its persisted token. */
  private startDeviceClient(): void {
    if (!this.configManager) return;
    const hubUrl = process.env.UMBRA_HUB_URL || this.configManager.raw.devices.hubUrl;
    const token = process.env.UMBRA_HUB_TOKEN || this.configManager.raw.devices.hubToken;
    if (!hubUrl) return;
    if (!token) {
      getLogger().warn('devices.hubUrl set without a hub token — call joinRemoteHub(code) to register this device');
      return;
    }
    const deviceId = process.env.UMBRA_HUB_DEVICE_ID || this.configManager.raw.devices.hubDeviceId;
    this.deviceClient?.stop();
    this.deviceClient = new DeviceClient({
      url: hubUrl,
      token,
      deviceId,
      name: this.configManager.raw.devices.name,
      role: this.configManager.raw.devices.role,
      capabilities: ['agent', 'desktop-control'],
      onMessage: (from, msg) => this.handleDeviceMessage(from, msg),
      onStatus: connected => getLogger().info({ connected }, 'Device client hub status'),
    });
    this.deviceClient.start();
  }

  /**
   * Bootstrap a fresh device into the mesh: call the cloud's join endpoint
   * with an invite code, persist the long-lived token, and connect. After this
   * the device auto-reconnects forever (the "scan a QR / open a link" step).
   */
  async joinRemoteHub(code: string, apiBase?: string): Promise<any> {
    const base = (apiBase || process.env.UMBRA_API_URL || '').replace(/\/$/, '');
    if (!base) throw new Error('UMBRA_API_URL (cloud API base) is required to join a remote hub');
    const c = this.configManager.raw.devices;
    const res = await fetch(`${base}/api/devices/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, name: c.name, role: c.role, capabilities: ['agent', 'desktop-control'] }),
    });
    if (!res.ok) throw new Error(`Join failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { join: { deviceId: string; token: string } };
    this.configManager.raw.devices.hubToken = body.join.token;
    this.configManager.raw.devices.hubDeviceId = body.join.deviceId;
    await this.configManager.saveConfig();
    this.startDeviceClient();
    return { deviceId: body.join.deviceId, connected: this.deviceClient?.isConnected ?? false };
  }

  /** Handle a message relayed to this device from another device (via the hub). */
  private async handleDeviceMessage(from: string, msg: Record<string, unknown>): Promise<void> {
    const type = String(msg.t || '');
    if (type === 'cmd') {
      const action = String(msg.action || '');
      const params = (msg.params as Record<string, unknown>) || {};
      const reqId = String(msg.reqId || '');
      let ok = true;
      let result: string;
      try {
        result = this.realDesktop
          ? await this.executeGhost(action, params)
          : await this.executeDesktop2(action, params);
      } catch (err: any) {
        ok = false;
        result = err.message || 'error';
      }
      this.deviceClient?.relay(from, { t: 'result', reqId, ok, result });
      return;
    }
    if (type === 'task') {
      const description = String(msg.description || '').trim();
      const reqId = String(msg.reqId || '');
      if (!description) {
        if (reqId) this.deviceClient?.reply(reqId, { t: 'task-error', error: 'description is required' });
        else this.deviceClient?.relay(from, { t: 'task-error', error: 'description is required' });
        return;
      }
      const taskId = await this.submitTask(description);
      if (reqId) this.deviceClient?.reply(reqId, { t: 'task-accepted', taskId });
      else this.deviceClient?.relay(from, { t: 'task-accepted', taskId });
    }
  }

  async getDevices(): Promise<any> {
    if (!this.deviceRegistry) return { registered: [], connected: [], hub: null };
    const online = (id: string) => this.deviceHub?.isOnline(id) ?? false;
    return {
      registered: this.deviceRegistry.listDevices().map(d => ({
        deviceId: d.deviceId,
        name: d.name,
        role: d.role,
        capabilities: d.capabilities,
        online: online(d.deviceId),
        lastSeen: d.lastSeen,
      })),
      hub: this.deviceHub?.getStatus() ?? null,
      thisNode: {
        role: this.role,
        connectedToHub: this.deviceClient?.isConnected ?? false,
        hubDeviceId: this.configManager?.raw.devices.hubDeviceId,
      },
    };
  }

  async createDeviceInvite(name: string): Promise<any> {
    if (!this.deviceRegistry) throw new Error('Device mesh disabled');
    const invite = this.deviceRegistry.createInvite(name || undefined);
    return {
      code: invite.code,
      expiresAt: invite.expiresAt,
      // Phone scans the QR (which encodes this payload); a PC opens joinUrl.
      joinUrl: `${this.publicBaseUrl()}/api/devices/join?code=${invite.code}`,
      hubWsUrl: this.hubWsUrl(),
    };
  }

  async joinDevice(code: string, meta: { name: string; role?: string; capabilities?: string[] }): Promise<any> {
    if (!this.deviceRegistry) throw new Error('Device mesh disabled');
    const roles = ['desktop', 'phone', 'server', 'other'] as const;
    const role = roles.includes(meta.role as any) ? (meta.role as 'desktop' | 'phone' | 'server' | 'other') : 'other';
    const result = this.deviceRegistry.redeemInvite(code, { name: meta.name, role, capabilities: meta.capabilities });
    return {
      deviceId: result.deviceId,
      token: result.token,
      name: result.device.name,
      role: result.device.role,
      hubWsUrl: this.hubWsUrl(),
    };
  }

  async revokeDevice(deviceId: string): Promise<any> {
    if (!this.deviceRegistry) throw new Error('Device mesh disabled');
    this.deviceRegistry.revokeDevice(deviceId);
    return { deviceId };
  }

  async sendToDevice(deviceId: string, msg: Record<string, unknown>): Promise<any> {
    if (!this.deviceHub) throw new Error('Device mesh disabled');
    const sent = this.deviceHub.send(deviceId, msg);
    return { deviceId, sent };
  }

  private publicBaseUrl(): string {
    return (process.env.UMBRA_PUBLIC_URL || `http://localhost:8787`).replace(/\/$/, '');
  }

  private hubWsUrl(): string {
    try {
      const u = new URL(this.publicBaseUrl());
      const proto = u.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${u.hostname}:${this.configManager.raw.devices.hubPort}/device-ws`;
    } catch {
      return `ws://localhost:${this.configManager.raw.devices.hubPort}/device-ws`;
    }
  }

  private async syncOpenMontageTools(): Promise<number> {
    if (!this.openmontage.isInstalled()) return 0;
    const tools = await this.openmontage.listTools();
    for (const tool of tools) {
      this.mcpRegistry.register('openmontage', tool.name.replace(/[^a-zA-Z0-9_-]/g, ''), { transport: 'native' });
    }
    if (tools.length) getLogger().info({ count: tools.length }, 'OpenMontage tools registered');
    return tools.length;
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
    this.watcher?.stop();
    this.proactive?.stop();
    this.audio.stop();
    this.healer.stop();
    this.streamer?.stop();
    this.shadow?.stop();
    this.awareness?.stopWatching();
    this.meetingCompanion?.stopListening();
    this.hotkey?.stop();
    this.p2p?.stop();
    this.pwa?.stop();
    this.deviceClient?.stop();
    this.deviceHub?.stop();
    this.repos.close();
    await this.fastEngine.stop();
    await this.api.stop();
    await this.desktop2.stop();
    await this.realDesktop?.stop();
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
      deviceRegistry: this.deviceRegistry,
      deviceHub: this.deviceHub,
      deviceClient: this.deviceClient,
      graphify: this.graphify,
      skillRecorder: this.skillRecorder,
      skillRouter: this.skillRouter,
      skillRepos: listSkillRepos(),
      mcpRegistry: this.mcpRegistry,
      mcpRouter: this.mcpRouter,
      credVault: this.credVault,
      shadow: this.shadow,
      awareness: this.awareness,
      meetings: this.meetings,
      meetingCompanion: this.meetingCompanion,
      windowsTts: this.windowsTts,
      vibeVoiceTts: this.vibeVoiceTts,
      voiceboxClient: this.voiceboxClient,
      telnyx: this.telnyx,
      dockerDaemon: this.dockerDaemon,
      metering: this.metering,
      modelRouter: this.modelRouter,
      openmontage: this.openmontage,
      imageGen: this.imageGen,
      speechToText: this.speechToText,
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
