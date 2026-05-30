import type { StructuredLogFields } from '../shared/structured-logger.js';
import { appLogger } from '../shared/structured-logger.js';
import type { AppMetricsCollector } from '../shared/app-metrics.js';
import type { TranslationProviderMode, TranslationResult } from '../types.js';

export interface TranslateOptions {
    logContext?: Pick<StructuredLogFields, 'requestId' | 'guildId' | 'userId' | 'command'>;
}

export interface TranslationProvider {
    /** Human-readable provider name for logging. */
    name: string;
    /** Translate a prompt. */
    translate(
        prompt: string,
        maxOutputTokens: number,
        options?: TranslateOptions,
    ): Promise<TranslationResult>;
    /** Whether the provider has enough config to attempt a call. */
    isConfigured(): boolean;
}

export interface ProviderOrchestratorResult extends TranslationResult {
    /** Which provider produced this result. */
    provider: string;
    /** Whether a fallback provider was used. */
    fallback: boolean;
}

export interface ProviderOrchestratorOptions {
    metrics?: AppMetricsCollector;
}

export class ProviderOrchestratorError extends Error {
    readonly provider: string;
    readonly errorType: string;

    constructor(
        message: string,
        options: {
            provider: string;
            errorType: string;
            cause?: Error;
        },
    ) {
        super(message, { cause: options.cause });
        this.name = 'ProviderOrchestratorError';
        this.provider = options.provider;
        this.errorType = options.errorType;
    }
}

function resolveProviderOrder(
    mode: TranslationProviderMode,
    providers: Map<string, TranslationProvider>,
): TranslationProvider[] {
    switch (mode) {
        case 'vertex':
            return [providers.get('vertex')].filter(Boolean) as TranslationProvider[];
        case 'openai':
            return [providers.get('openai')].filter(Boolean) as TranslationProvider[];
        case 'vertex+openai':
            return [providers.get('vertex'), providers.get('openai')].filter(
                Boolean,
            ) as TranslationProvider[];
        case 'openai+vertex':
            return [providers.get('openai'), providers.get('vertex')].filter(
                Boolean,
            ) as TranslationProvider[];
        default:
            return [providers.get('vertex')].filter(Boolean) as TranslationProvider[];
    }
}

export function classifyProviderError(error: Error | null): string {
    const message = error?.message ?? '';
    if (/429|rate/i.test(message)) return 'rate_limit';
    if (/401|403|auth|api key|not configured/i.test(message)) return 'auth';
    if (/timeout|aborted/i.test(message)) return 'timeout';
    if (/5\d\d|server/i.test(message)) return 'server_error';
    if (/budget/i.test(message)) return 'budget';
    return 'unknown';
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

export function createProviderOrchestrator(
    mode: TranslationProviderMode,
    providers: Map<string, TranslationProvider>,
    orchestratorOptions: ProviderOrchestratorOptions = {},
) {
    const logger = appLogger.child({ component: 'provider_orchestrator' });

    return {
        async translate(
            prompt: string,
            maxOutputTokens: number,
            options?: TranslateOptions,
        ): Promise<ProviderOrchestratorResult> {
            const ordered = resolveProviderOrder(mode, providers);
            const configured = ordered.filter((p) => p.isConfigured());

            if (configured.length === 0) {
                throw new Error(
                    'No translation provider is configured. Please complete setup in the dashboard.',
                );
            }

            let lastError: Error | null = null;
            let lastProvider: string | null = null;

            for (let i = 0; i < configured.length; i++) {
                const provider = configured[i]!;
                const isFallback = i > 0;

                try {
                    if (isFallback) {
                        orchestratorOptions.metrics?.recordProviderFallback({
                            from: configured[i - 1]!.name,
                            to: provider.name,
                            errorType: classifyProviderError(lastError),
                            error: lastError?.message ?? 'Unknown provider failure',
                        });
                        logger.warn('provider_orchestrator.fallback', {
                            from: configured[i - 1]!.name,
                            to: provider.name,
                            error: lastError?.message,
                            ...options?.logContext,
                        });
                    }

                    const result = await provider.translate(prompt, maxOutputTokens, options);
                    orchestratorOptions.metrics?.recordProviderSuccess(provider.name);
                    return {
                        ...result,
                        provider: provider.name,
                        fallback: isFallback,
                    };
                } catch (error) {
                    lastError = toError(error);
                    lastProvider = provider.name;
                    orchestratorOptions.metrics?.recordProviderFailure(provider.name, {
                        errorType: classifyProviderError(lastError),
                        error: lastError.message,
                    });
                    logger.error('provider_orchestrator.provider_failed', {
                        provider: provider.name,
                        error: lastError.message,
                        hasNextProvider: i < configured.length - 1,
                        ...options?.logContext,
                    });
                }
            }

            // All providers failed — preserve the last provider diagnostic for callers.
            throw new ProviderOrchestratorError(lastError?.message ?? 'Unknown provider failure', {
                provider: lastProvider ?? 'unknown',
                errorType: classifyProviderError(lastError),
                cause: lastError ?? undefined,
            });
        },
    };
}

export const _test = { resolveProviderOrder };
