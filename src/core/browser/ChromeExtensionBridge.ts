import { VectorMemory } from '../memory/VectorMemory';
import { KnowledgeGraph } from '../../knowledge/KnowledgeGraph';
import { PrivacyGuard } from '../privacy/PrivacyGuard';
import { getLogger } from '../Logger';
import { eventBus } from '../EventBus';

export interface ChromeTelemetryEvent {
  type: string;
  ts?: number;
  sessionId?: string;
  tabId?: number;
  url?: string;
  title?: string;
  prevUrl?: string;
  action?: string;
  fieldCount?: number;
  hasPassword?: boolean;
  hasUsername?: boolean;
  hasValue?: boolean;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  path?: string;
  expires?: number;
  session?: boolean;
  provider?: string;
  domainCount?: number;
  cookieCount?: number;
  scrollY?: number;
  viewportHeight?: number;
  linkCount?: number;
  formCount?: number;
  isLoginLike?: boolean;
  frameId?: number;
}

export interface CookieSnapshot {
  [domain: string]: Array<{
    name: string;
    hasValue: boolean;
    secure: boolean;
    httpOnly: boolean;
    sameSite: string;
    path: string;
    expires: number;
    session: boolean;
  }>;
}

interface ChromeExtensionBridgeConfig {
  dataDir: string;
}

/**
 * Receives batched telemetry from the Umbra Browser Link Chrome extension,
 * filters it through the PrivacyGuard, and stores it in the recall system
 * (VectorMemory) so the ActivityWatcher, KnowledgeGraph, and agent loop
 * can reason about browser-level activity.
 */
export class ChromeExtensionBridge {
  private recall: VectorMemory;
  private knowledge: KnowledgeGraph;
  private privacy: PrivacyGuard;
  private config: ChromeExtensionBridgeConfig;
  private sessionId: string = '';
  private eventCount: number = 0;
  private lastFlushAt: number = Date.now();
  private cookieDomains: Set<string> = new Set();
  private loginEvents: Array<{ url: string; provider: string; ts: number }> = [];
  private activeSessions: Map<string, { startedAt: number; eventCount: number; cookieDomains: number }> = new Map();

  constructor(
    recall: VectorMemory,
    knowledge: KnowledgeGraph,
    privacy: PrivacyGuard,
    config: ChromeExtensionBridgeConfig,
  ) {
    this.recall = recall;
    this.knowledge = knowledge;
    this.privacy = privacy;
    this.config = config;
  }

  /**
   * Process a batch of telemetry events from the Chrome extension.
   */
  async handleTelemetry(events: ChromeTelemetryEvent[], sessionId: string, cookieSnapshot: CookieSnapshot): Promise<{
    processed: number;
    filtered: number;
    sessionId: string;
  }> {
    if (!this.sessionId) this.sessionId = sessionId;

    let filtered = 0;
    for (const event of events) {
      const processed = await this.processEvent(event, sessionId);
      if (!processed) filtered++;
    }

    // Update cookie snapshot
    if (cookieSnapshot) {
      this.cookieDomains = new Set(Object.keys(cookieSnapshot));
    }

    // Track session stats
    const session = this.activeSessions.get(sessionId) || {
      startedAt: Date.now(),
      eventCount: 0,
      cookieDomains: 0,
    };
    session.eventCount += events.length;
    session.cookieDomains = this.cookieDomains.size;
    this.activeSessions.set(sessionId, session);

    this.eventCount += events.length;

    // Emit bus event so the UI can show Chrome extension activity
    eventBus.emit('chrome:telemetry', {
      sessionId,
      eventCount: events.length,
      totalEvents: this.eventCount,
    });

    getLogger().debug({
      sessionId,
      events: events.length,
      filtered,
      total: this.eventCount,
    }, 'Chrome extension telemetry received');

    return {
      processed: events.length - filtered,
      filtered,
      sessionId,
    };
  }

  private async processEvent(event: ChromeTelemetryEvent, sessionId: string): Promise<boolean> {
    const privacyCheck = this.privacy.inspectUrl(event.url || '');
    if (!privacyCheck.allowed) return false;

    const ts = event.ts || Date.now();

    switch (event.type) {
      case 'session:start':
        this.sessionId = sessionId;
        getLogger().info({ sessionId }, 'Chrome extension session started');
        return true;

      case 'cookies:sweep':
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: '',
          action: 'cookie_sweep',
          contextTags: `cookies,domain_count:${event.domainCount},cookie_count:${event.cookieCount}`,
          durationSec: 0,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });
        return true;

      case 'tab:created':
      case 'tab:removed':
      case 'tab:activate':
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: '',
          action: event.type,
          targetUrl: event.url,
          contextTags: 'browser,tab',
          durationSec: 0,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });
        return true;

      case 'tab:navigate':
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: event.title || '',
          action: 'navigate',
          targetUrl: event.url,
          contextTags: 'browser,navigation',
          durationSec: 0,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });
        return true;

      case 'oauth:detected':
        this.loginEvents.push({ url: event.url || '', provider: event.provider || 'unknown', ts });
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: '',
          action: 'oauth_flow',
          targetUrl: event.url,
          contextTags: `browser,oauth,provider:${event.provider}`,
          durationSec: 0,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });

        // Also record as a knowledge node for the agent to reason about
        await this.knowledge.addOrUpdate(
          `browser/oauth/${event.provider}-${ts}`,
          `OAuth Login: ${event.provider}`,
          `User initiated an OAuth flow with ${event.provider}.\nURL: ${event.url}\nPrevious: ${event.prevUrl}\nTime: ${new Date(ts).toISOString()}`,
          ['browser', 'oauth', event.provider || 'unknown', 'login'],
          ['browser-activity'],
          'system',
        ).catch(() => {});
        return true;

      case 'login:detected':
      case 'login:submitted':
        this.loginEvents.push({ url: event.url || '', provider: event.provider || 'unknown', ts });
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: '',
          action: event.type === 'login:submitted' ? 'login_submit' : 'login_detected',
          targetUrl: event.url,
          contextTags: `browser,login,provider:${event.provider || 'unknown'},has_password:${event.hasPassword}`,
          durationSec: 0,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });
        return true;

      case 'form:submit':
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: '',
          action: event.isLoginLike ? 'login_form_submit' : 'form_submit',
          targetUrl: event.url,
          contextTags: `browser,form${event.isLoginLike ? ',login' : ''}`,
          durationSec: 0,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });
        return true;

      case 'nav:complete':
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: '',
          action: 'page_load',
          targetUrl: event.url,
          contextTags: 'browser,navigation',
          durationSec: 0,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });
        return true;

      case 'activity:heartbeat':
        this.recall.logUserActivity({
          appName: 'chrome-extension',
          windowTitle: event.title || '',
          action: 'heartbeat',
          targetUrl: event.url,
          contextTags: `browser,heartbeat,links:${event.linkCount || 0},forms:${event.formCount || 0}`,
          durationSec: 30,
          keystrokeCount: 0,
          clickCount: 0,
          scrollCount: 0,
          isActive: true,
          sessionId,
          hourOfDay: new Date(ts).getHours(),
          dayOfWeek: new Date(ts).getDay(),
        });
        return true;

      case 'tab:title':
        // Lightweight — don't log every title change
        return true;

      default:
        getLogger().debug({ type: event.type }, 'Unknown Chrome extension event type');
        return false;
    }
  }

  /**
   * Get status for the API endpoint.
   */
  getStatus(): {
    active: boolean;
    eventCount: number;
    sessionCount: number;
    loginEvents: number;
    cookieDomains: number;
    sessions: Record<string, { startedAt: number; eventCount: number; cookieDomains: number }>;
  } {
    return {
      active: this.eventCount > 0 && (Date.now() - this.lastFlushAt) < 60_000,
      eventCount: this.eventCount,
      sessionCount: this.activeSessions.size,
      loginEvents: this.loginEvents.length,
      cookieDomains: this.cookieDomains.size,
      sessions: Object.fromEntries(this.activeSessions),
    };
  }

  /**
   * Get login events (provider, timestamp).
   */
  getLoginEvents(): Array<{ url: string; provider: string; ts: number }> {
    return [...this.loginEvents];
  }
}
