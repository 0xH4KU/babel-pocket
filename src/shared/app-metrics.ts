export interface ProviderMetricsSnapshot {
    successTotal: number;
    failureTotal: number;
    fallbackFromTotal: number;
    fallbackToTotal: number;
    lastLatencyMs: number | null;
    lastErrorType: string | null;
    lastError: string | null;
}

export interface LastProviderFallback {
    from: string;
    to: string;
    errorType: string;
    error: string;
    timestamp: number;
}

export interface AppMetricsSnapshot {
    translationsTotal: number;
    translationApiCallsTotal: number;
    translationCacheHitsTotal: number;
    translationFailuresTotal: number;
    budgetExceededTotal: number;
    webhookRecreateTotal: number;
    translationSuccessRate: number;
    translationFailureRate: number;
    translationCacheHitRate: number;
    translationApiCallRate: number;
    providers: Record<string, ProviderMetricsSnapshot>;
    providerFallbackTotal: number;
    lastProviderFallback: LastProviderFallback | null;
}

export interface AppMetricsCollector {
    recordTranslationSuccess(options?: { cached?: boolean }): void;
    recordTranslationApiCall(): void;
    recordTranslationFailure(): void;
    recordBudgetExceeded(): void;
    recordWebhookRecreate(): void;
    recordProviderSuccess(provider: string, options?: { latencyMs?: number }): void;
    recordProviderFailure(provider: string, options: { errorType: string; error: string }): void;
    recordProviderFallback(options: {
        from: string;
        to: string;
        errorType: string;
        error: string;
    }): void;
    snapshot(): AppMetricsSnapshot;
}

const EMPTY_APP_METRICS_SNAPSHOT: AppMetricsSnapshot = {
    translationsTotal: 0,
    translationApiCallsTotal: 0,
    translationCacheHitsTotal: 0,
    translationFailuresTotal: 0,
    budgetExceededTotal: 0,
    webhookRecreateTotal: 0,
    translationSuccessRate: 0,
    translationFailureRate: 0,
    translationCacheHitRate: 0,
    translationApiCallRate: 0,
    providers: {},
    providerFallbackTotal: 0,
    lastProviderFallback: null,
};

export function createEmptyAppMetricsSnapshot(): AppMetricsSnapshot {
    return { ...EMPTY_APP_METRICS_SNAPSHOT, providers: {} };
}

export class AppMetrics implements AppMetricsCollector {
    private translationsTotal = 0;
    private translationApiCallsTotal = 0;
    private translationCacheHitsTotal = 0;
    private translationFailuresTotal = 0;
    private budgetExceededTotal = 0;
    private webhookRecreateTotal = 0;
    private providers = new Map<string, ProviderMetricsSnapshot>();
    private providerFallbackTotal = 0;
    private lastProviderFallback: LastProviderFallback | null = null;

    recordTranslationSuccess(options?: { cached?: boolean }): void {
        this.translationsTotal += 1;

        if (options?.cached) {
            this.translationCacheHitsTotal += 1;
        }
    }

    recordTranslationApiCall(): void {
        this.translationApiCallsTotal += 1;
    }

    recordTranslationFailure(): void {
        this.translationFailuresTotal += 1;
    }

    recordBudgetExceeded(): void {
        this.budgetExceededTotal += 1;
    }

    recordWebhookRecreate(): void {
        this.webhookRecreateTotal += 1;
    }

    recordProviderSuccess(provider: string, options?: { latencyMs?: number }): void {
        const providerMetrics = this.providerMetrics(provider);

        providerMetrics.successTotal += 1;

        if (options?.latencyMs !== undefined) {
            providerMetrics.lastLatencyMs = options.latencyMs;
        }
    }

    recordProviderFailure(provider: string, options: { errorType: string; error: string }): void {
        const providerMetrics = this.providerMetrics(provider);

        providerMetrics.failureTotal += 1;
        providerMetrics.lastErrorType = options.errorType;
        providerMetrics.lastError = options.error;
    }

    recordProviderFallback(options: {
        from: string;
        to: string;
        errorType: string;
        error: string;
    }): void {
        const fromProviderMetrics = this.providerMetrics(options.from);
        const toProviderMetrics = this.providerMetrics(options.to);

        this.providerFallbackTotal += 1;
        fromProviderMetrics.fallbackFromTotal += 1;
        toProviderMetrics.fallbackToTotal += 1;
        this.lastProviderFallback = {
            from: options.from,
            to: options.to,
            errorType: options.errorType,
            error: options.error,
            timestamp: Date.now(),
        };
    }

    snapshot(): AppMetricsSnapshot {
        const completedTranslationAttempts = this.translationsTotal + this.translationFailuresTotal;

        return {
            translationsTotal: this.translationsTotal,
            translationApiCallsTotal: this.translationApiCallsTotal,
            translationCacheHitsTotal: this.translationCacheHitsTotal,
            translationFailuresTotal: this.translationFailuresTotal,
            budgetExceededTotal: this.budgetExceededTotal,
            webhookRecreateTotal: this.webhookRecreateTotal,
            translationSuccessRate:
                completedTranslationAttempts > 0
                    ? this.translationsTotal / completedTranslationAttempts
                    : 0,
            translationFailureRate:
                completedTranslationAttempts > 0
                    ? this.translationFailuresTotal / completedTranslationAttempts
                    : 0,
            translationCacheHitRate:
                this.translationsTotal > 0
                    ? this.translationCacheHitsTotal / this.translationsTotal
                    : 0,
            translationApiCallRate:
                this.translationsTotal > 0
                    ? this.translationApiCallsTotal / this.translationsTotal
                    : 0,
            providers: this.snapshotProviders(),
            providerFallbackTotal: this.providerFallbackTotal,
            lastProviderFallback:
                this.lastProviderFallback === null ? null : { ...this.lastProviderFallback },
        };
    }

    private providerMetrics(provider: string): ProviderMetricsSnapshot {
        const existingMetrics = this.providers.get(provider);

        if (existingMetrics !== undefined) {
            return existingMetrics;
        }

        const metrics = {
            successTotal: 0,
            failureTotal: 0,
            fallbackFromTotal: 0,
            fallbackToTotal: 0,
            lastLatencyMs: null,
            lastErrorType: null,
            lastError: null,
        };

        this.providers.set(provider, metrics);

        return metrics;
    }

    private snapshotProviders(): Record<string, ProviderMetricsSnapshot> {
        return Object.fromEntries(
            Array.from(this.providers.entries()).map(([provider, metrics]) => [
                provider,
                { ...metrics },
            ]),
        );
    }
}
