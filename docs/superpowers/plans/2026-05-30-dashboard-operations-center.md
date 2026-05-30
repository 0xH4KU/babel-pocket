# Dashboard Operations Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight operations and diagnostics layer to the dashboard so an admin can quickly see provider health, fallback behavior, queue pressure, budget risk, and actionable translation failures.

**Architecture:** Extend the existing in-memory `AppMetrics` and `TranslationLog` models with provider/runtime diagnostic fields, expose them through the existing `/api/stats`, `/api/health`, and `/api/logs` endpoints, then render compact operational panels in the current vanilla HTML/CSS/JS dashboard. Keep this as an operations center, not a broad dashboard rewrite.

**Tech Stack:** TypeScript, Express 4, discord.js, vanilla browser JavaScript, existing CSS modules, Vitest.

---

## Scope

Build the first version of dashboard management improvements:

- Provider status cards for Vertex AI and OpenAI-compatible providers.
- Provider mode, active health, latency, and configuration state in the dashboard.
- Provider success/failure/fallback counters and last fallback detail.
- Runtime queue pressure summary using existing limiter snapshots.
- Budget risk summary with per-guild warning states.
- More useful error log diagnostics with request id, provider, error type, and a short suggested action.

Do not add alerting, persistent audit logs, model A/B testing, per-guild provider overrides, or a frontend framework in this pass.

## File Structure

- Modify `src/shared/app-metrics.ts`
  - Add provider-level counters and last fallback metadata.
  - Keep the collector in-memory and dependency-free.
- Modify `src/infra/provider-orchestrator.ts`
  - Accept optional metrics collector.
  - Record provider success, provider failure, and fallback events.
- Modify `src/modules/translation/translate.ts`
  - Pass the shared metrics collector into the orchestrator.
  - Add a test helper for resetting providers/metrics wiring if needed.
- Modify `src/modules/translation/translation-service.ts`
  - Pass metrics into the translator options so provider diagnostics can be recorded without global coupling where practical.
  - Enrich translation error log entries with request id, provider, and error type when available.
- Modify `src/shared/log.ts`
  - Add optional diagnostic fields to error log entries while preserving current behavior.
- Modify `src/types.ts`
  - Extend `ErrorLogEntry` and related translation option types with optional diagnostic fields.
- Modify `src/modules/dashboard/dashboard.ts`
  - Include provider diagnostics, runtime pressure, and budget warning summary in `/api/stats`.
  - Return provider configuration state in `/api/health` or `/api/stats`.
- Modify `src/public/index.html`
  - Add an operations panel to the Overview tab.
  - Add diagnostic filter controls to the Logs tab.
- Modify `src/public/js/dashboard.js`
  - Render provider cards, queue pressure, fallback summary, and budget risk.
- Modify `src/public/js/logs.js`
  - Render provider/error-type/request-id diagnostics and filters.
- Modify CSS files under `src/public/css/`
  - Add small, dashboard-native styles for operations cards and diagnostic badges.
- Test `tests/app-metrics.test.ts`
  - Cover provider counters and last fallback metadata.
- Test `tests/provider-orchestrator.test.ts`
  - Add metrics recording expectations for primary success, fallback success, and all-provider failure.
- Test `tests/dashboard.test.ts`
  - Cover new `/api/stats` fields and `/api/health` provider config state.
- Test `tests/log.test.ts`
  - Cover optional error diagnostic fields and filtering behavior if filters are extended server-side.

---

### Task 1: Provider Metrics Model

**Files:**
- Modify: `src/shared/app-metrics.ts`
- Test: `tests/app-metrics.test.ts`

- [ ] **Step 1: Write failing provider metric tests**

Add assertions to `tests/app-metrics.test.ts` that exercise provider counters and fallback metadata:

```ts
it('should record provider successes, failures, and fallback details', () => {
    const metrics = new AppMetrics();

    metrics.recordProviderSuccess('vertex', { latencyMs: 120 });
    metrics.recordProviderFailure('vertex', {
        errorType: 'rate_limit',
        error: 'Vertex AI 429',
    });
    metrics.recordProviderFallback({
        from: 'vertex',
        to: 'openai',
        errorType: 'rate_limit',
        error: 'Vertex AI 429',
    });
    metrics.recordProviderSuccess('openai', { latencyMs: 80 });

    expect(metrics.snapshot().providers).toEqual({
        vertex: {
            successTotal: 1,
            failureTotal: 1,
            fallbackFromTotal: 1,
            fallbackToTotal: 0,
            lastLatencyMs: 120,
            lastErrorType: 'rate_limit',
            lastError: 'Vertex AI 429',
        },
        openai: {
            successTotal: 1,
            failureTotal: 0,
            fallbackFromTotal: 0,
            fallbackToTotal: 1,
            lastLatencyMs: 80,
            lastErrorType: null,
            lastError: null,
        },
    });
    expect(metrics.snapshot().providerFallbackTotal).toBe(1);
    expect(metrics.snapshot().lastProviderFallback).toMatchObject({
        from: 'vertex',
        to: 'openai',
        errorType: 'rate_limit',
        error: 'Vertex AI 429',
    });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- tests/app-metrics.test.ts
```

Expected: FAIL because `recordProviderSuccess`, `recordProviderFailure`, `recordProviderFallback`, `providers`, `providerFallbackTotal`, and `lastProviderFallback` do not exist.

- [ ] **Step 3: Implement provider metrics**

Update `src/shared/app-metrics.ts` with explicit provider metric types and methods:

```ts
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
```

Extend `AppMetricsSnapshot`:

```ts
providers: Record<string, ProviderMetricsSnapshot>;
providerFallbackTotal: number;
lastProviderFallback: LastProviderFallback | null;
```

Extend `AppMetricsCollector`:

```ts
recordProviderSuccess(provider: string, options?: { latencyMs?: number }): void;
recordProviderFailure(provider: string, options: { errorType: string; error: string }): void;
recordProviderFallback(options: {
    from: string;
    to: string;
    errorType: string;
    error: string;
}): void;
```

Use a private helper:

```ts
private ensureProvider(provider: string): ProviderMetricsSnapshot {
    this.providerMetrics[provider] ??= {
        successTotal: 0,
        failureTotal: 0,
        fallbackFromTotal: 0,
        fallbackToTotal: 0,
        lastLatencyMs: null,
        lastErrorType: null,
        lastError: null,
    };
    return this.providerMetrics[provider]!;
}
```

- [ ] **Step 4: Run focused metrics tests**

Run:

```bash
npm test -- tests/app-metrics.test.ts
```

Expected: PASS. Existing snapshot tests must be updated to include empty provider fields:

```ts
providers: {},
providerFallbackTotal: 0,
lastProviderFallback: null,
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/app-metrics.ts tests/app-metrics.test.ts
git commit -m "feat: track provider metrics"
```

---

### Task 2: Provider Orchestrator Diagnostics

**Files:**
- Modify: `src/infra/provider-orchestrator.ts`
- Modify: `src/modules/translation/translate.ts`
- Test: `tests/provider-orchestrator.test.ts`

- [ ] **Step 1: Write failing orchestrator metrics tests**

Create `tests/provider-orchestrator.test.ts` if it does not exist. Cover three cases:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createProviderOrchestrator, type TranslationProvider } from '../src/infra/provider-orchestrator.js';
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
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- tests/provider-orchestrator.test.ts
```

Expected: FAIL because `createProviderOrchestrator` does not accept metrics options.

- [ ] **Step 3: Add metrics option to orchestrator**

Update `src/infra/provider-orchestrator.ts`:

```ts
import type { AppMetricsCollector } from '../shared/app-metrics.js';

export interface ProviderOrchestratorOptions {
    metrics?: AppMetricsCollector;
}
```

Change the factory signature:

```ts
export function createProviderOrchestrator(
    mode: TranslationProviderMode,
    providers: Map<string, TranslationProvider>,
    options: ProviderOrchestratorOptions = {},
) {
```

Record failures in the catch block:

```ts
const errorType = classifyProviderError(lastError);
options.metrics?.recordProviderFailure(provider.name, {
    errorType,
    error: lastError.message,
});
```

Record fallback before attempting fallback provider:

```ts
if (isFallback) {
    options.metrics?.recordProviderFallback({
        from: configured[i - 1]!.name,
        to: provider.name,
        errorType: classifyProviderError(lastError),
        error: lastError?.message ?? 'Unknown provider failure',
    });
}
```

Record success after provider returns:

```ts
options.metrics?.recordProviderSuccess(provider.name);
```

Add a local classifier:

```ts
function classifyProviderError(error: Error | null): string {
    const message = error?.message ?? '';
    if (/429|rate/i.test(message)) return 'rate_limit';
    if (/401|403|auth|api key|not configured/i.test(message)) return 'auth';
    if (/timeout|aborted/i.test(message)) return 'timeout';
    if (/5\d\d|server/i.test(message)) return 'server_error';
    if (/budget/i.test(message)) return 'budget';
    return 'unknown';
}
```

- [ ] **Step 4: Wire metrics into translate**

Update `src/modules/translation/translate.ts` so `translate` accepts optional metrics:

```ts
import type { AppMetricsCollector } from '../../shared/app-metrics.js';
```

Extend options:

```ts
metrics?: AppMetricsCollector;
```

Create orchestrator with metrics:

```ts
const orchestrator = createProviderOrchestrator(mode, getProviders(), {
    metrics: options?.metrics,
});
```

- [ ] **Step 5: Pass metrics from translation service**

Update the translator option type in `src/modules/translation/translation-service.ts`:

```ts
metrics?: AppMetricsCollector;
```

Pass metrics in both translator calls:

```ts
const result = await translator(originalText, targetLanguage, {
    metrics,
    logContext: {
        requestId,
        guildId: request.guildId ?? null,
        userId: request.userId,
        command: request.command,
    },
});
```

- [ ] **Step 6: Run orchestrator and translation service tests**

Run:

```bash
npm test -- tests/provider-orchestrator.test.ts tests/translation-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/infra/provider-orchestrator.ts src/modules/translation/translate.ts src/modules/translation/translation-service.ts tests/provider-orchestrator.test.ts
git commit -m "feat: record provider diagnostics"
```

---

### Task 3: Dashboard Stats Summary

**Files:**
- Modify: `src/modules/dashboard/dashboard.ts`
- Test: `tests/dashboard.test.ts`

- [ ] **Step 1: Write failing dashboard stats test**

Add a test to `tests/dashboard.test.ts` after authentication setup:

```ts
it('should include operations diagnostics in stats', async () => {
    metrics.recordProviderSuccess('vertex', { latencyMs: 42 });
    metrics.recordProviderFailure('openai', {
        errorType: 'auth',
        error: 'OpenAI 401',
    });

    const res = await request(server, 'GET', '/api/stats', {
        cookie: sessionCookie,
    });

    expect(res.status).toBe(200);
    expect(res.body!.operations).toMatchObject({
        providerMode: 'vertex',
        providers: {
            vertex: {
                enabled: true,
                configured: true,
                successTotal: expect.any(Number),
                failureTotal: expect.any(Number),
            },
            openai: {
                enabled: false,
                configured: false,
                failureTotal: expect.any(Number),
            },
        },
        runtimePressure: {
            inflight: expect.any(Number),
            queued: expect.any(Number),
            rejectedTotal: expect.any(Number),
        },
        budgetRisk: {
            warningCount: expect.any(Number),
            exceededCount: expect.any(Number),
        },
    });
});
```

Update the dashboard store mock config with OpenAI fields if missing:

```ts
openaiApiKey: '',
openaiBaseUrl: '',
openaiModel: '',
translationProvider: 'vertex',
```

- [ ] **Step 2: Run dashboard test and verify failure**

Run:

```bash
npm test -- tests/dashboard.test.ts
```

Expected: FAIL because `operations` is not returned.

- [ ] **Step 3: Add operations summary helpers**

In `src/modules/dashboard/dashboard.ts`, add helpers near validation constants:

```ts
function providerModeIncludes(mode: string, provider: 'vertex' | 'openai'): boolean {
    if (provider === 'vertex') return mode === 'vertex' || mode === 'vertex+openai' || mode === 'openai+vertex';
    return mode === 'openai' || mode === 'vertex+openai' || mode === 'openai+vertex';
}

function budgetRiskForGuilds(guildBudgetList: Array<{ budget: number; totalCost: number; exceeded: boolean }>) {
    const warningThreshold = 0.8;
    return {
        warningCount: guildBudgetList.filter(
            (g) => g.budget > 0 && !g.exceeded && g.totalCost / g.budget >= warningThreshold,
        ).length,
        exceededCount: guildBudgetList.filter((g) => g.exceeded).length,
    };
}
```

- [ ] **Step 4: Return operations from `/api/stats`**

Inside `/api/stats`, after `runtimeSnapshot` and `guildBudgetList` are available:

```ts
const cfg = configRepository.getRuntimeConfig();
const providerMode = cfg.translationProvider || 'vertex';
const providerMetrics = metricsSnapshot.providers;
const budgetRisk = budgetRiskForGuilds(guildBudgetList);
```

Add to response:

```ts
operations: {
    providerMode,
    providers: {
        vertex: {
            enabled: providerModeIncludes(providerMode, 'vertex'),
            configured: !!(cfg.vertexAiApiKey && cfg.gcpProject),
            ...(providerMetrics.vertex ?? createEmptyProviderMetricsSnapshot()),
        },
        openai: {
            enabled: providerModeIncludes(providerMode, 'openai'),
            configured: !!(cfg.openaiApiKey && cfg.openaiBaseUrl && cfg.openaiModel),
            ...(providerMetrics.openai ?? createEmptyProviderMetricsSnapshot()),
        },
    },
    fallbackTotal: metricsSnapshot.providerFallbackTotal,
    lastFallback: metricsSnapshot.lastProviderFallback,
    runtimePressure: {
        inflight: runtimeSnapshot.inflight,
        queued: runtimeSnapshot.queued,
        rejectedTotal: runtimeSnapshot.rejectedTotal,
        rejectionCounts: runtimeSnapshot.rejectionCounts,
        limits: runtimeSnapshot.limits,
    },
    budgetRisk,
},
```

Export `createEmptyProviderMetricsSnapshot()` from `src/shared/app-metrics.ts` in Task 1 or create an equivalent local helper in dashboard.

- [ ] **Step 5: Run dashboard stats test**

Run:

```bash
npm test -- tests/dashboard.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard/dashboard.ts tests/dashboard.test.ts
git commit -m "feat: expose dashboard operations summary"
```

---

### Task 4: Diagnostic Error Logs

**Files:**
- Modify: `src/types.ts`
- Modify: `src/shared/log.ts`
- Modify: `src/modules/translation/translation-service.ts`
- Modify: `src/modules/dashboard/dashboard.ts`
- Test: `tests/log.test.ts`
- Test: `tests/translation-service.test.ts`

- [ ] **Step 1: Write failing log test**

Add to `tests/log.test.ts`:

```ts
it('should retain optional diagnostic fields on error logs', () => {
    const log = new TranslationLog();

    log.addError({
        guildId: 'guild-1',
        guildName: 'Guild One',
        userId: 'user-1',
        userTag: 'User#0001',
        error: 'OpenAI 429',
        command: 'translate',
        requestId: 'req_123',
        provider: 'openai',
        errorType: 'rate_limit',
        suggestedAction: 'Provider is rate limited. Try fallback mode or lower traffic.',
    });

    expect(log.getRecent(1)[0]).toMatchObject({
        type: 'error',
        requestId: 'req_123',
        provider: 'openai',
        errorType: 'rate_limit',
        suggestedAction: 'Provider is rate limited. Try fallback mode or lower traffic.',
    });
});
```

- [ ] **Step 2: Run log test and verify failure**

Run:

```bash
npm test -- tests/log.test.ts
```

Expected: FAIL because diagnostic fields are not accepted or retained.

- [ ] **Step 3: Extend error log types**

Update `ErrorLogEntry` in `src/types.ts`:

```ts
requestId?: string;
provider?: string;
errorType?: string;
suggestedAction?: string;
```

Update `TranslationLog.addError` params in `src/shared/log.ts` with the same optional fields and include them in the pushed entry.

- [ ] **Step 4: Add diagnostic classifier in translation service**

In `src/modules/translation/translation-service.ts`, add:

```ts
function classifyTranslationError(message: string): { errorType: string; suggestedAction: string } {
    if (/429|rate/i.test(message)) {
        return {
            errorType: 'rate_limit',
            suggestedAction: 'Provider rate limit reached. Try fallback mode or reduce concurrency.',
        };
    }
    if (/401|403|auth|api key|not configured/i.test(message)) {
        return {
            errorType: 'auth',
            suggestedAction: 'Check provider API key and provider configuration.',
        };
    }
    if (/timeout|aborted/i.test(message)) {
        return {
            errorType: 'timeout',
            suggestedAction: 'Provider timed out. Check provider status or use fallback mode.',
        };
    }
    if (/budget/i.test(message)) {
        return {
            errorType: 'budget',
            suggestedAction: 'Review global or server budget limits.',
        };
    }
    return {
        errorType: 'unknown',
        suggestedAction: 'Check structured logs for this request id.',
    };
}
```

In the catch block:

```ts
const diagnostic = classifyTranslationError(message);
log.addError({
    guildId: request.guildId,
    guildName: request.guildName,
    userId: request.userId,
    userTag: request.userTag,
    error: message,
    command: request.commandLabel,
    requestId,
    errorType: diagnostic.errorType,
    suggestedAction: diagnostic.suggestedAction,
});
```

Provider extraction can stay out of this task unless provider errors become structured. The UI can show `provider` as `-` when absent.

- [ ] **Step 5: Add optional server-side log filters**

In `/api/logs`, keep `filter` behavior and add optional `errorType` filtering:

```ts
const errorType = req.query.errorType as string | undefined;
let entries = log.getRecent(count, filter);
if (errorType) {
    entries = entries.filter((entry) => entry.type === 'error' && entry.errorType === errorType);
}
res.json(entries);
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- tests/log.test.ts tests/translation-service.test.ts tests/dashboard.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/shared/log.ts src/modules/translation/translation-service.ts src/modules/dashboard/dashboard.ts tests/log.test.ts tests/translation-service.test.ts tests/dashboard.test.ts
git commit -m "feat: add translation error diagnostics"
```

---

### Task 5: Overview Operations UI

**Files:**
- Modify: `src/public/index.html`
- Modify: `src/public/js/dashboard.js`
- Modify: `src/public/css/dashboard.css`
- Modify: `src/public/css/components.css` if badge styles are shared

- [ ] **Step 1: Add static operations panel markup**

In `src/public/index.html`, inside `#tab-overview` after the budget card and before the stats grid, add:

```html
<div class="operations-panel" id="operations-panel">
    <div class="operations-header">
        <h3>Operations</h3>
        <span class="sub-info" id="ops-provider-mode">-</span>
    </div>
    <div class="operations-grid">
        <div class="operation-card" id="ops-provider-vertex"></div>
        <div class="operation-card" id="ops-provider-openai"></div>
        <div class="operation-card" id="ops-runtime"></div>
        <div class="operation-card" id="ops-budget-risk"></div>
    </div>
</div>
```

- [ ] **Step 2: Add renderer helpers**

In `src/public/js/dashboard.js`, add:

```js
function renderProviderCard(providerName, provider) {
    const enabled = provider.enabled ? 'Enabled' : 'Disabled';
    const configured = provider.configured ? 'Configured' : 'Missing config';
    const statusClass = !provider.enabled ? 'muted' : provider.configured ? 'ok' : 'warn';
    const latency = provider.lastLatencyMs == null ? '-' : provider.lastLatencyMs + 'ms';
    return `<div class="operation-title">
        <span>${providerName}</span>
        <span class="ops-pill ${statusClass}">${enabled}</span>
    </div>
    <div class="operation-main">${configured}</div>
    <div class="operation-meta">
        ${provider.successTotal || 0} ok · ${provider.failureTotal || 0} fail · ${provider.fallbackToTotal || 0} fallback in · ${latency}
    </div>`;
}

function renderOperations(operations) {
    if (!operations) return;
    document.getElementById('ops-provider-mode').textContent = operations.providerMode || '-';
    document.getElementById('ops-provider-vertex').innerHTML = renderProviderCard('Vertex AI', operations.providers.vertex);
    document.getElementById('ops-provider-openai').innerHTML = renderProviderCard('OpenAI', operations.providers.openai);

    const runtime = operations.runtimePressure || {};
    document.getElementById('ops-runtime').innerHTML = `<div class="operation-title">
        <span>Runtime Queue</span>
        <span class="ops-pill ${runtime.queued > 0 ? 'warn' : 'ok'}">${runtime.queued || 0} queued</span>
    </div>
    <div class="operation-main">${runtime.inflight || 0} inflight</div>
    <div class="operation-meta">${runtime.rejectedTotal || 0} rejected total</div>`;

    const risk = operations.budgetRisk || {};
    document.getElementById('ops-budget-risk').innerHTML = `<div class="operation-title">
        <span>Budget Risk</span>
        <span class="ops-pill ${(risk.exceededCount || risk.warningCount) ? 'warn' : 'ok'}">${risk.warningCount || 0} warning</span>
    </div>
    <div class="operation-main">${risk.exceededCount || 0} exceeded</div>
    <div class="operation-meta">${operations.fallbackTotal || 0} provider fallbacks</div>`;
}
```

Call it inside `loadStats()` after reading `d`:

```js
renderOperations(d.operations);
```

- [ ] **Step 3: Add CSS**

In `src/public/css/dashboard.css`:

```css
.operations-panel {
    margin-bottom: 16px;
}

.operations-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.operations-header h3 {
    margin: 0;
    font-size: 16px;
}

.operations-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
}

.operation-card {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    background: var(--surface-color);
    min-height: 96px;
}

.operation-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
}

.operation-main {
    margin-top: 10px;
    font-size: 18px;
    font-weight: 700;
}

.operation-meta {
    margin-top: 6px;
    color: var(--text-muted);
    font-size: 12px;
}

.ops-pill {
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    white-space: nowrap;
}

.ops-pill.ok {
    background: rgba(67, 181, 129, 0.12);
    color: #2f9e68;
}

.ops-pill.warn {
    background: rgba(250, 166, 26, 0.14);
    color: #b87503;
}

.ops-pill.muted {
    background: rgba(116, 127, 141, 0.12);
    color: var(--text-muted);
}
```

Add responsive rule in `src/public/css/responsive.css`:

```css
.operations-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 640px) {
    .operations-grid {
        grid-template-columns: 1fr;
    }
}
```

If `responsive.css` already uses media blocks, place these rules inside the matching block instead of duplicating conflicting selectors.

- [ ] **Step 4: Run static validation**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS. Frontend JS is not TypeScript, so manually inspect browser console in Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/public/index.html src/public/js/dashboard.js src/public/css/dashboard.css src/public/css/responsive.css src/public/css/components.css
git commit -m "feat: show operations summary on dashboard"
```

---

### Task 6: Logs Diagnostics UI

**Files:**
- Modify: `src/public/index.html`
- Modify: `src/public/js/logs.js`
- Modify: `src/public/css/dashboard.css`

- [ ] **Step 1: Add error-type filter controls**

In the Logs tab filter area in `src/public/index.html`, add buttons after `Errors`:

```html
<button class="log-filter-btn" data-error-filter="rate_limit" onclick="setErrorTypeFilter('rate_limit')">
    Rate Limit
</button>
<button class="log-filter-btn" data-error-filter="auth" onclick="setErrorTypeFilter('auth')">
    Auth
</button>
<button class="log-filter-btn" data-error-filter="timeout" onclick="setErrorTypeFilter('timeout')">
    Timeout
</button>
```

- [ ] **Step 2: Update log loader filters**

In `src/public/js/logs.js`, add state:

```js
let currentErrorTypeFilter;
```

Add:

```js
function setErrorTypeFilter(errorType) {
    currentLogFilter = 'error';
    currentErrorTypeFilter = currentErrorTypeFilter === errorType ? undefined : errorType;
    loadLogs();
}
```

Update `setLogFilter` to clear error type when switching away:

```js
if (filter !== 'error') currentErrorTypeFilter = undefined;
```

Update `loadLogs()`:

```js
const params = new URLSearchParams({ count: '200' });
if (currentLogFilter) params.set('filter', currentLogFilter);
if (currentErrorTypeFilter) params.set('errorType', currentErrorTypeFilter);
const res = await api('/logs?' + params.toString());
```

- [ ] **Step 3: Render diagnostic columns**

Update logs table header to:

```html
<th>Time</th><th>Type</th><th>Server</th><th>User</th><th>Detail</th><th>Diagnostic</th>
```

For error rows:

```js
const requestId = e.requestId ? `<span class="mono dim">${e.requestId}</span>` : '';
const diagnostic = [
    e.provider ? `<span class="badge badge-yellow">${escapeHtml(e.provider)}</span>` : '',
    e.errorType ? `<span class="badge badge-red">${escapeHtml(e.errorType)}</span>` : '',
    requestId,
].filter(Boolean).join(' ');
const suggestion = e.suggestedAction ? `<div class="log-suggestion">${escapeHtml(e.suggestedAction)}</div>` : '';
```

Display suggestion beneath the error text:

```js
<td style="max-width:260px">
    <div class="log-error-text" title="${errMsg}">${errMsg}</div>
    ${suggestion}
</td>
<td>${diagnostic}</td>
```

Add a local helper if not already available:

```js
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
```

- [ ] **Step 4: Add CSS for diagnostic log text**

In `src/public/css/dashboard.css`:

```css
.log-error-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.log-suggestion {
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 12px;
    white-space: normal;
}
```

- [ ] **Step 5: Run static validation**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/public/index.html src/public/js/logs.js src/public/css/dashboard.css
git commit -m "feat: show dashboard log diagnostics"
```

---

### Task 7: Visual and End-to-End Verification

**Files:**
- No source changes unless verification finds issues.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm run typecheck
npm run lint
npm test
```

Expected: all commands PASS.

- [ ] **Step 2: Build production assets**

Run:

```bash
npm run build
```

Expected: PASS and `dist/src/public` exists.

- [ ] **Step 3: Start local dev server**

Run:

```bash
npm run dev
```

Expected: process starts. If real Discord credentials are unavailable, use the existing test harness or run the dashboard app through a small local script in a follow-up task. Do not commit local credential changes.

- [ ] **Step 4: Browser QA**

Open `http://localhost:3000` in the in-app browser. Verify:

- Login still works.
- Overview renders provider cards without console errors.
- Provider mode text is visible.
- Runtime queue and budget risk cards fit at desktop and mobile widths.
- Logs tab renders existing translation and error rows.
- Error-type filters do not break existing All / Translations / Errors filters.

- [ ] **Step 5: Fix any visual or console issues**

If text overflows, cards overlap, or console errors appear, adjust only the affected HTML/CSS/JS and rerun:

```bash
npm run lint
```

- [ ] **Step 6: Final commit**

```bash
git add src/public src/shared src/modules src/infra tests
git commit -m "test: verify dashboard operations center"
```

Skip this commit if no source files changed during verification.

---

## Self-Review

- Spec coverage: The plan covers provider status, fallback metrics, runtime queue pressure, budget risk, and actionable log diagnostics.
- Scope control: Alerting, persistent audit logs, per-guild provider override, and major dashboard redesign are intentionally excluded.
- Test coverage: Metrics, orchestrator, dashboard API, logs, and translation service behavior receive focused tests before implementation.
- Type consistency: Provider diagnostic data flows from `AppMetrics` to `/api/stats` to `dashboard.js`; error diagnostic data flows from `TranslationLog` to `/api/logs` to `logs.js`.
