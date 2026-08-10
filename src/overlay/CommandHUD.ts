import { eventBus } from '../core/EventBus';
import { AgentRuntime } from '../core/agent/AgentRuntime';
import { MacroSynthesizer } from '../core/recall/MacroSynthesizer';
import { ConfigManager } from '../config/ConfigManager';
import { KnowledgeGraph } from '../knowledge/KnowledgeGraph';
import { getLogger } from '../core/Logger';

export interface HUDCommand {
  input: string;
  type: 'text' | 'voice' | 'macro';
  timestamp: Date;
}

export interface HUDSuggestion {
  text: string;
  type: 'macro' | 'knowledge' | 'recent';
  confidence: number;
}

export class CommandHUD {
  private agent?: AgentRuntime;
  private macros?: MacroSynthesizer;
  private config?: ConfigManager;
  private knowledge?: KnowledgeGraph;
  private history: HUDCommand[] = [];
  private visible: boolean = false;
  private overlayProcess?: any;

  constructor() {
    eventBus.on('overlay:toggle', () => this.toggle());
    eventBus.on('overlay:command', (cmd) => this.handleCommand(cmd));
    eventBus.on('audio:gesture', (gesture) => {
      if (gesture === 'snap') this.toggle();
    });
  }

  registerSubsystems(subsystems: {
    agent?: AgentRuntime;
    macros?: MacroSynthesizer;
    config?: ConfigManager;
    knowledge?: KnowledgeGraph;
  }): void {
    if (subsystems.agent) this.agent = subsystems.agent;
    if (subsystems.macros) this.macros = subsystems.macros;
    if (subsystems.config) this.config = subsystems.config;
    if (subsystems.knowledge) this.knowledge = subsystems.knowledge;
  }

  show(): void {
    this.visible = true;
    getLogger().info('Command HUD shown');
  }

  hide(): void {
    this.visible = false;
    getLogger().info('Command HUD hidden');
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  async handleCommand(input: string): Promise<void> {
    const command: HUDCommand = {
      input,
      type: input.startsWith('/') ? 'macro' : 'text',
      timestamp: new Date(),
    };

    this.history.push(command);
    if (this.history.length > 100) this.history.shift();

    getLogger().info({ input, type: command.type }, 'HUD command received');

    if (command.type === 'macro') {
      const macroName = input.substring(1).trim();
      try {
        await this.macros?.executeMacro(macroName);
      } catch (err: any) {
        getLogger().warn({ macro: macroName, err: err.message }, 'Macro execution failed');
      }
      return;
    }

    if (this.agent) {
      await this.agent.submitTask(input);
    }
  }

  async getSuggestions(partial: string): Promise<HUDSuggestion[]> {
    const suggestions: HUDSuggestion[] = [];

    if (this.macros) {
      const macroSuggestions = await this.macros.intelligentlySuggestMacros();
      for (const m of macroSuggestions) {
        if (m.keyword.includes(partial.toLowerCase()) || m.description.includes(partial.toLowerCase())) {
          suggestions.push({ text: `/${m.keyword}`, type: 'macro', confidence: m.confidence });
        }
      }
    }

    if (this.history.length > 0) {
      const recent = this.history
        .filter(h => h.input.includes(partial))
        .slice(-5)
        .map(h => ({ text: h.input, type: 'recent' as const, confidence: 50 }));
      suggestions.push(...recent);
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  getHistory(): HUDCommand[] {
    return this.history;
  }
}
