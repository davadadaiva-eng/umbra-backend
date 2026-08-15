/**
 * RoutedLLMConnector — layers task-based model routing + rate limits on top of
 * the metered connector.
 *
 *   - routes each call to a task-appropriate slot (free / fast / reasoning /
 *     frontend / difficult),
 *   - enforces the plan's daily hosted-token cap, hard max-output-tokens, and
 *     the `difficult` monthly call cap,
 *   - automatically spills over to the free-model slot whenever a hosted slot
 *     cannot proceed (quota exhausted or provider failure) so work never
 *     simply runs out,
 *   - keeps every call behind the same circuit breaker + token accounting as
 *     MeteredLLMConnector.
 *
 * When `plan.routing.enabled` is false it degrades gracefully to the plain
 * metered path (plus the max-output-tokens safety cap).
 */

import { LLMCompletionOptions, LLMCompletionResult, LLMMessage } from '../agent/LLMConnector';
import { getLogger } from '../Logger';
import { MeteredLLMConnector } from './MeteredLLMConnector';
import { MeteringService } from './MeteringService';
import { ModelRouter } from './ModelRouter';
import { RoutingTier, UmbraConfig } from '../../types';

export class RoutedLLMConnector extends MeteredLLMConnector {
  private router: ModelRouter;

  constructor(config: UmbraConfig, metering: MeteringService, router: ModelRouter) {
    super(config, metering);
    this.router = router;
  }

  get routing(): ModelRouter {
    return this.router;
  }

  async complete(
    messages: LLMMessage[],
    role: 'reasoning' | 'vision' | 'fast' = 'reasoning',
    options: LLMCompletionOptions = {}
  ): Promise<LLMCompletionResult> {
    if (!this.router.enabled) {
      return super.complete(messages, role, this.capOutput(options));
    }

    const tier = this.router.resolveTier(role, options.task);
    try {
      return await this.runTier(tier, messages, role, options);
    } catch (err: any) {
      // Provider failure or quota: spill over to free models so we never
      // run out of capacity.
      if (tier !== 'free') {
        getLogger().warn({ tier, err: err.message }, 'Hosted slot unavailable — spilling over to free models');
        return await this.runTier('free', messages, role, options);
      }
      throw err;
    }
  }

  /** Clamp max output tokens to the plan's hard cap. */
  private capOutput(options: LLMCompletionOptions): LLMCompletionOptions {
    const max = this.router.maxOutputTokens();
    return { ...options, maxTokens: Math.min(options.maxTokens ?? max, max) };
  }

  private async runTier(
    tier: RoutingTier,
    messages: LLMMessage[],
    role: 'reasoning' | 'vision' | 'fast',
    options: LLMCompletionOptions,
  ): Promise<LLMCompletionResult> {
    const inputEstimate = this.router.estimateInput(messages);
    const outputEstimate = this.router.maxOutputTokens();

    // Hosted budget exhausted → transparently degrade to free models.
    if (tier !== 'free' && !this.router.canAffordTier(tier, inputEstimate, outputEstimate)) {
      getLogger().info({ tier }, 'Hosted token budget exhausted — spilling over to free models');
      return this.runTier('free', messages, role, options);
    }

    const cfg = this.router.tierConfig(tier);
    const effective = this.capOutput({ ...options, model: options.model || cfg.model });

    let result: LLMCompletionResult;
    if (cfg.provider === this.currentConfig.provider && !cfg.endpoint) {
      result = await super.complete(messages, role, effective);
    } else {
      // Different provider or a per-slot endpoint (e.g. the OpenRouter free
      // tier): build a metered connector over the overridden config.
      const altConfig: UmbraConfig = { ...this.currentConfig, provider: cfg.provider };
      if (cfg.endpoint) {
        if (cfg.provider === 'openai-compatible') {
          altConfig.openaiCompatible = { ...altConfig.openaiCompatible, endpoint: cfg.endpoint };
        } else if (cfg.provider === 'openai') {
          altConfig.openai = { ...altConfig.openai, endpoint: cfg.endpoint };
        } else if (cfg.provider === 'ollama') {
          altConfig.ollama = { ...altConfig.ollama, endpoint: cfg.endpoint };
        }
      }
      result = await new MeteredLLMConnector(altConfig, this.metering).complete(messages, role, effective);
    }

    const input = result.inputTokens ?? inputEstimate;
    const output = result.outputTokens ?? Math.max(0, result.totalTokens - inputEstimate);
    this.router.record(tier, input, output);
    return result;
  }
}
