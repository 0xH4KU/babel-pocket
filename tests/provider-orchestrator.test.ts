import { describe, expect, it, vi } from 'vitest';
import {
    createProviderOrchestrator,
    type TranslationProvider,
} from '../src/infra/provider-orchestrator.js';
import { AppMetrics } from '../src/shared/app-metrics.js';

function provider(name: string, behavior: 'ok' | 'fail'): TranslationProvider {
    return {
        name,
        isConfigured: () => true,
        translate: vi.fn(async () => {
            if (behavior === 'fail') throw new Error(`${name} failed`);
            return { text: `${name} result`, inputTokens: 1, outputTokens: 1 };
        }),
    };
}

describe('ProviderOrchestrator diagnostics', () => {
    it('records primary provider success', async () => {
        const metrics = new AppMetrics();
        const orchestrator = createProviderOrchestrator(
            'vertex',
            new Map([['vertex', provider('vertex', 'ok')]]),
            { metrics },
        );

        await orchestrator.translate('prompt', 100);

        expect(metrics.snapshot().providers.vertex.successTotal).toBe(1);
        expect(metrics.snapshot().providerFallbackTotal).toBe(0);
    });

    it('records fallback after primary failure', async () => {
        const metrics = new AppMetrics();
        const orchestrator = createProviderOrchestrator(
            'vertex+openai',
            new Map([
                ['vertex', provider('vertex', 'fail')],
                ['openai', provider('openai', 'ok')],
            ]),
            { metrics },
        );

        const result = await orchestrator.translate('prompt', 100);

        expect(result.provider).toBe('openai');
        expect(result.fallback).toBe(true);
        expect(metrics.snapshot().providers.vertex.failureTotal).toBe(1);
        expect(metrics.snapshot().providers.vertex.fallbackFromTotal).toBe(1);
        expect(metrics.snapshot().providers.openai.fallbackToTotal).toBe(1);
        expect(metrics.snapshot().providerFallbackTotal).toBe(1);
    });

    it('records all provider failures', async () => {
        const metrics = new AppMetrics();
        const orchestrator = createProviderOrchestrator(
            'vertex+openai',
            new Map([
                ['vertex', provider('vertex', 'fail')],
                ['openai', provider('openai', 'fail')],
            ]),
            { metrics },
        );

        await expect(orchestrator.translate('prompt', 100)).rejects.toThrow('openai failed');

        expect(metrics.snapshot().providers.vertex.failureTotal).toBe(1);
        expect(metrics.snapshot().providers.openai.failureTotal).toBe(1);
        expect(metrics.snapshot().providerFallbackTotal).toBe(1);
    });
});
