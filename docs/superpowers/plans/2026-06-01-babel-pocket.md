# Babel Pocket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork Babel into Babel Pocket, a self-hosted user-install Discord translator controlled by user whitelist and per-user budgets.

**Architecture:** Keep the existing Discord client, translation pipeline, provider orchestration, dashboard, SQLite store, cache, cooldown, and runtime limiter. Replace server-scoped access and budget concepts with user-scoped equivalents; remove public webhook slash translation from the active product surface. The message context menu command is renamed to `Babel Pocket` and is registered as a user-install command.

**Tech Stack:** TypeScript, discord.js 14, Node 22, SQLite via `node:sqlite`, Express dashboard, Vitest.

---

## File Structure

- `package.json`, `README.md`, deployment docs, and UI text: rename product from Babel server bot to Babel Pocket.
- `scripts/register.ts`: register `Babel Pocket`, `setlang`, `mylang`, and `help` with `USER_INSTALL` and contexts `[GUILD, BOT_DM, PRIVATE_CHANNEL]`; omit `/translate`.
- `src/index.ts`: route `Babel Pocket` message context menu; stop wiring `/translate` webhook behavior.
- `src/types.ts`: add user budget and user usage fields; keep legacy guild fields only where needed during migration if deleting them is too broad.
- `src/persistence/store-defaults.ts`, `src/repositories/store-data-normalizer.ts`, `src/store.ts`, `src/persistence/sqlite-database.ts`: add allowed users, default user budget, per-user budgets, per-user usage and history.
- `src/modules/usage/user-budget-repository.ts`, `src/modules/usage/usage-repository.ts`, `src/modules/usage/usage.ts`: user budget enforcement and accounting.
- `src/modules/translation/translation-service.ts`: authorize by user install owner, not guild ID; bill user owner ID.
- `src/commands/babel.ts`: pass user-install owner ID to the service and use the `Babel Pocket` command label.
- `src/modules/dashboard/dashboard.ts`, `src/public/js/access.js`, `src/public/js/dashboard.js`, related HTML/CSS/demo fixtures: rename Access from guilds to users and expose user budgets.
- Tests under `tests/`: update and add coverage for command registration payloads, user authorization, user budgets, usage accounting, store persistence, and dashboard user access APIs.

---

### Task 1: Product Rename And Command Registration

**Files:**
- Modify: `package.json`
- Modify: `scripts/register.ts`
- Modify: `src/index.ts`
- Modify: `src/commands/babel.ts`
- Test: `tests/register.test.ts`
- Test: `tests/babel-command.test.ts`

- [ ] Step 1: Add a failing test for user-install command payloads in `tests/register.test.ts`.

```ts
import { describe, expect, it } from 'vitest';
import { commands } from '../scripts/register.js';

describe('register commands', () => {
    it('registers Babel Pocket as a user-install message command', () => {
        const command = commands.find((item) => item.name === 'Babel Pocket');

        expect(command).toEqual(
            expect.objectContaining({
                name: 'Babel Pocket',
                type: 3,
                integration_types: [1],
                contexts: [0, 1, 2],
            }),
        );
    });

    it('does not register the public translate slash command', () => {
        expect(commands.some((item) => item.name === 'translate')).toBe(false);
    });
});
```

- [ ] Step 2: Run the register test and verify RED.

Run: `npm test tests/register.test.ts`
Expected: FAIL because `scripts/register.ts` does not export `commands` and still registers `Babel` / `/translate`.

- [ ] Step 3: Update `scripts/register.ts`.

Use these constants and export the command array:

```ts
const INTEGRATION_USER_INSTALL = 1;
const CONTEXT_GUILD = 0;
const CONTEXT_BOT_DM = 1;
const CONTEXT_PRIVATE_CHANNEL = 2;

export interface DiscordCommand {
    name: string;
    type: number;
    description?: string;
    integration_types?: number[];
    contexts?: number[];
    options?: DiscordCommandOption[];
}

const USER_INSTALL_COMMAND_CONTEXT = {
    integration_types: [INTEGRATION_USER_INSTALL],
    contexts: [CONTEXT_GUILD, CONTEXT_BOT_DM, CONTEXT_PRIVATE_CHANNEL],
};

export const commands: DiscordCommand[] = [
    {
        name: 'Babel Pocket',
        type: 3,
        ...USER_INSTALL_COMMAND_CONTEXT,
    },
    {
        name: 'setlang',
        type: 1,
        description: 'Set your preferred translation language',
        ...USER_INSTALL_COMMAND_CONTEXT,
        options: [...existing language option...],
    },
    {
        name: 'help',
        type: 1,
        description: 'Show how to use Babel Pocket',
        ...USER_INSTALL_COMMAND_CONTEXT,
    },
    {
        name: 'mylang',
        type: 1,
        description: 'Check your current translation language',
        ...USER_INSTALL_COMMAND_CONTEXT,
    },
];
```

Guard the network registration code so importing the file in tests does not call Discord:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
    await registerCommands();
}
```

- [ ] Step 4: Update `src/index.ts` so only `Babel Pocket` routes to `handleBabel`; leave `/setlang`, `/mylang`, and `/help` active; remove `/translate` routing and webhook service wiring.

- [ ] Step 5: Update `tests/babel-command.test.ts` expected command label from `Babel (context menu)` to `Babel Pocket (context menu)`.

- [ ] Step 6: Run tests.

Run: `npm test tests/register.test.ts tests/babel-command.test.ts`
Expected: PASS.

- [ ] Step 7: Commit.

```bash
git add package.json scripts/register.ts src/index.ts src/commands/babel.ts tests/register.test.ts tests/babel-command.test.ts
git commit -m "feat: register Babel Pocket user install commands"
```

### Task 2: User Access And Budget Data Model

**Files:**
- Modify: `src/types.ts`
- Modify: `src/persistence/store-defaults.ts`
- Modify: `src/repositories/store-data-normalizer.ts`
- Modify: `src/persistence/sqlite-database.ts`
- Modify: `src/store.ts`
- Test: `tests/store.test.ts`

- [ ] Step 1: Add failing store tests for allowed users, user budgets, and user usage.

Add to `tests/store.test.ts`:

```ts
it('should support allowed user config values', async () => {
    const store = createTestStore();

    expect(store.get('allowedUserIds')).toEqual([]);
    store.set('allowedUserIds', ['user-1', 'user-2']);

    const runtimeConfig = store.getConfigValues(['allowedUserIds', 'defaultUserDailyBudgetUsd']);
    expect(runtimeConfig.allowedUserIds).toEqual(['user-1', 'user-2']);
    expect(runtimeConfig.defaultUserDailyBudgetUsd).toBe(0);
});

it('should support direct user budget operations', async () => {
    const store = createTestStore();

    expect(store.getUserBudget('user-1')).toBeNull();
    store.setUserBudget('user-1', 1.25);
    expect(store.getUserBudget('user-1')).toEqual({ dailyBudgetUsd: 1.25 });
    expect(store.get('userBudgets')).toEqual({ 'user-1': { dailyBudgetUsd: 1.25 } });
    expect(store.clearUserBudget('user-1')).toBe(true);
    expect(store.getUserBudget('user-1')).toBeNull();
});

it('should support per-user usage persistence', async () => {
    const store = createTestStore();
    const usage = { date: '2026-06-01', inputTokens: 10, outputTokens: 5, requests: 1 };

    store.saveUserDailyUsage('user-1', usage);
    expect(store.getUserDailyUsage('user-1')).toEqual(usage);
    expect(store.get('userTokenUsage')).toEqual({ 'user-1': usage });

    store.saveUserUsageHistory('user-1', [usage]);
    expect(store.getUserUsageHistory('user-1')).toEqual([usage]);
    expect(store.get('userUsageHistory')).toEqual({ 'user-1': [usage] });
});
```

- [ ] Step 2: Run store tests and verify RED.

Run: `npm test tests/store.test.ts`
Expected: FAIL because user fields and methods do not exist.

- [ ] Step 3: Update `src/types.ts`.

Add:

```ts
export interface UserBudgetConfig {
    dailyBudgetUsd: number;
}
```

Add to `StoreData`:

```ts
allowedUserIds: string[];
defaultUserDailyBudgetUsd: number;
userBudgets: Record<string, UserBudgetConfig>;
userTokenUsage: Record<string, TokenUsage>;
userUsageHistory: Record<string, UsageHistoryEntry[]>;
```

- [ ] Step 4: Update `src/persistence/store-defaults.ts` defaults and config keys.

Defaults:

```ts
allowedUserIds: [],
defaultUserDailyBudgetUsd: 0,
userBudgets: {},
userTokenUsage: {},
userUsageHistory: {},
```

Add `allowedUserIds` and `defaultUserDailyBudgetUsd` to `CONFIG_VALUE_KEYS`.

- [ ] Step 5: Update normalizer with user clones mirroring guild clones.

Add `cloneUserBudgets`, `cloneUserDailyUsage`, `cloneUserUsageHistory`, and include the new fields in `normalizeStoreData`.

- [ ] Step 6: Add SQLite migration id 3.

In `src/persistence/sqlite-database.ts`, create:

```sql
CREATE TABLE IF NOT EXISTS user_budgets (
    user_id TEXT PRIMARY KEY,
    daily_budget_usd REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS user_daily_usage (
    user_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    requests INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_usage_history (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    requests INTEGER NOT NULL,
    PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_history_lookup
    ON user_usage_history (user_id, date);
```

Add the three tables to `STORE_TABLES`.

- [ ] Step 7: Update `src/store.ts` with user budget and usage methods mirroring guild methods.

Add public methods:

```ts
getUserBudget(userId: string): UserBudgetConfig | null
setUserBudget(userId: string, dailyBudgetUsd: number): void
clearUserBudget(userId: string): boolean
getUserDailyUsage(userId: string): TokenUsage | null
saveUserDailyUsage(userId: string, usage: TokenUsage): void
getUserUsageHistory(userId: string): UsageHistoryEntry[]
saveUserUsageHistory(userId: string, history: UsageHistoryEntry[]): void
```

Add private aggregate readers and replacement methods for `userBudgets`, `userTokenUsage`, `userUsageHistory`.

- [ ] Step 8: Run store tests.

Run: `npm test tests/store.test.ts`
Expected: PASS.

- [ ] Step 9: Commit.

```bash
git add src/types.ts src/persistence/store-defaults.ts src/repositories/store-data-normalizer.ts src/persistence/sqlite-database.ts src/store.ts tests/store.test.ts
git commit -m "feat: add user-scoped access and usage storage"
```

### Task 3: User Budget Enforcement

**Files:**
- Create: `src/modules/usage/user-budget-repository.ts`
- Modify: `src/modules/usage/usage-repository.ts`
- Modify: `src/modules/usage/usage.ts`
- Test: `tests/usage.test.ts`

- [ ] Step 1: Add failing usage tests for per-user budget behavior.

Add tests mirroring guild budget tests:

```ts
it('should record user usage when userId is provided', () => {
    usage.record(100, 50, { userId: 'user-1' });

    const userUsage = mockData.userTokenUsage as Record<string, TokenUsage>;
    expect(userUsage['user-1']).toMatchObject({ inputTokens: 100, outputTokens: 50, requests: 1 });
});

it('should block requests when the user budget is exceeded', () => {
    mockData.userBudgets = { 'user-1': { dailyBudgetUsd: 1.0 } };
    mockData.inputPricePerMillion = 1;
    usage.record(1_000_000, 0, { userId: 'user-1' });

    expect(usage.isBudgetExceeded({ userId: 'user-1' })).toBe(true);
});

it('should use the default user budget when no custom user budget exists', () => {
    mockData.defaultUserDailyBudgetUsd = 1.0;
    mockData.inputPricePerMillion = 1;
    usage.record(1_000_000, 0, { userId: 'user-2' });

    expect(usage.isBudgetExceeded({ userId: 'user-2' })).toBe(true);
});
```

- [ ] Step 2: Run usage tests and verify RED.

Run: `npm test tests/usage.test.ts`
Expected: FAIL because `record` and `isBudgetExceeded` do not accept user scope and user repositories are missing.

- [ ] Step 3: Create `src/modules/usage/user-budget-repository.ts`.

Implement store-backed `getBudget`, `listBudgets`, `setBudget`, `clearBudget` for user IDs.

- [ ] Step 4: Extend `src/modules/usage/usage-repository.ts`.

Add user daily usage and user history methods mirroring guild methods.

- [ ] Step 5: Change `UsageTracker` signatures in `src/modules/usage/usage.ts`.

Use a scope object:

```ts
export interface UsageScope {
    guildId?: string | null;
    userId?: string | null;
}

record(inputTokens: number, outputTokens: number, scope: UsageScope = {}): void
isBudgetExceeded(scope: UsageScope = {}): boolean
wouldExceedBudget(estimate: { estimatedInputTokens: number; estimatedOutputTokens: number } & UsageScope): boolean
```

Budget priority:
1. user budget if `userId` and custom budget exists
2. default user daily budget if `userId`
3. guild budget if `guildId` and custom budget exists
4. global shared daily budget

- [ ] Step 6: Run usage tests.

Run: `npm test tests/usage.test.ts`
Expected: PASS.

- [ ] Step 7: Commit.

```bash
git add src/modules/usage/user-budget-repository.ts src/modules/usage/usage-repository.ts src/modules/usage/usage.ts tests/usage.test.ts
git commit -m "feat: enforce per-user translation budgets"
```

### Task 4: User-Install Authorization In Translation Service

**Files:**
- Modify: `src/modules/translation/translation-service.ts`
- Modify: `src/commands/babel.ts`
- Test: `tests/translation-service.test.ts`
- Test: `tests/babel-command.test.ts`

- [ ] Step 1: Add failing tests for user whitelist authorization.

Add to `tests/translation-service.test.ts`:

```ts
it('should allow whitelisted user-install owners without a guild id', async () => {
    const { service, usageTracker } = createService({
        storeOverrides: {
            allowedGuildIds: [],
            allowedUserIds: ['user-owner'],
            userLanguagePrefs: { 'user-owner': 'ja' },
        },
    });

    const result = await service.process({
        command: 'babel',
        commandLabel: 'Babel Pocket (context menu)',
        guildId: null,
        userId: 'user-owner',
        billingUserId: 'user-owner',
        userTag: 'owner#0001',
        locale: 'en-US',
        text: 'Hello',
    });

    expect(result.status).toBe('success');
    expect(usageTracker.record).toHaveBeenCalledWith(12, 6, { guildId: null, userId: 'user-owner' });
});

it('should block user-install owners that are not whitelisted', async () => {
    const { service } = createService({
        storeOverrides: {
            allowedGuildIds: [],
            allowedUserIds: ['user-allowed'],
        },
    });

    const result = await service.process({
        command: 'babel',
        commandLabel: 'Babel Pocket (context menu)',
        guildId: null,
        userId: 'user-blocked',
        billingUserId: 'user-blocked',
        userTag: 'blocked#0001',
        locale: 'en-US',
        text: 'Hello',
    });

    expect(result.status).toBe('blocked');
});
```

- [ ] Step 2: Run translation service tests and verify RED.

Run: `npm test tests/translation-service.test.ts`
Expected: FAIL because `allowedUserIds` and `billingUserId` are unsupported and no guild is blocked.

- [ ] Step 3: Update `TranslationServiceRequest` with `billingUserId?: string | null`.

- [ ] Step 4: Update authorization logic.

Use:

```ts
const billingUserId = request.billingUserId ?? request.userId;
const allowedUsers = runtimeConfig.allowedUserIds;
const isGuildAllowed = !!request.guildId && runtimeConfig.allowedGuildIds.includes(request.guildId);
const isUserAllowed = !!billingUserId && allowedUsers.includes(billingUserId);

if (!isGuildAllowed && !isUserAllowed) {
    return { status: 'blocked', message: discordMessages.unauthorizedUser() };
}
```

Add `unauthorizedUser()` to `src/shared/messages/discord-messages.ts`.

Use `billingUserId` for budget checks, runtime limiter user accounting, translator log context, and usage record. Keep `request.userId` for cooldown and user preference unless product decision changes to owner preference.

- [ ] Step 5: Update `src/commands/babel.ts` to compute user-install owner.

Use Discord integration owner key `"1"`:

```ts
function getUserInstallOwnerId(interaction: MessageContextMenuCommandInteraction): string {
    return interaction.authorizingIntegrationOwners?.['1'] ?? interaction.user.id;
}
```

Pass `billingUserId` to `translationService.process`.

- [ ] Step 6: Run focused tests.

Run: `npm test tests/translation-service.test.ts tests/babel-command.test.ts`
Expected: PASS.

- [ ] Step 7: Commit.

```bash
git add src/modules/translation/translation-service.ts src/commands/babel.ts src/shared/messages/discord-messages.ts tests/translation-service.test.ts tests/babel-command.test.ts
git commit -m "feat: authorize Babel Pocket by whitelisted users"
```

### Task 5: Dashboard User Access Surface

**Files:**
- Modify: `src/modules/dashboard/dashboard.ts`
- Modify: `src/public/js/access.js`
- Modify: `src/public/js/dashboard.js`
- Modify: `src/public/index.html`
- Test: `tests/dashboard.test.ts`

- [ ] Step 1: Add failing dashboard API tests for users.

Add to `tests/dashboard.test.ts`:

```ts
it('should update allowed user ids from the access API', async () => {
    const { app, agent } = await createAuthenticatedDashboard();

    const res = await agent
        .put('/api/config')
        .set('x-csrf-token', csrfToken)
        .send({ allowedUserIds: ['user-1', 'user-2'] });

    expect(res.status).toBe(200);
    expect(store.get('allowedUserIds')).toEqual(['user-1', 'user-2']);
});

it('should set and clear user budgets', async () => {
    const { agent } = await createAuthenticatedDashboard();

    const setRes = await agent
        .put('/api/user-budgets/user-1')
        .set('x-csrf-token', csrfToken)
        .send({ dailyBudgetUsd: 1.5 });
    expect(setRes.status).toBe(200);
    expect(store.getUserBudget('user-1')).toEqual({ dailyBudgetUsd: 1.5 });

    const clearRes = await agent
        .delete('/api/user-budgets/user-1')
        .set('x-csrf-token', csrfToken);
    expect(clearRes.status).toBe(200);
    expect(store.getUserBudget('user-1')).toBeNull();
});
```

Adapt helper names to existing dashboard test helpers.

- [ ] Step 2: Run dashboard tests and verify RED.

Run: `npm test tests/dashboard.test.ts`
Expected: FAIL because user budget endpoints do not exist.

- [ ] Step 3: Update dashboard config sanitization to include `allowedUserIds` and `defaultUserDailyBudgetUsd`; remove or hide guild-specific fields from responses used by UI.

- [ ] Step 4: Add API routes:

```ts
app.put('/api/user-budgets/:userId', auth.requireAuth, ...)
app.delete('/api/user-budgets/:userId', auth.requireAuth, ...)
app.get('/api/user-budgets', auth.requireAuth, ...)
```

Each route validates Discord snowflake-like IDs with `/^\d{5,32}$/` or a local permissive test-safe helper, validates budgets as finite numbers >= 0, and uses `userBudgetRepository`.

- [ ] Step 5: Update frontend Access tab text and calls from guilds to users.

Replace server whitelist textarea with user whitelist textarea. Replace per-server budget rows with per-user rows derived from `allowedUserIds` plus `userBudgets`.

- [ ] Step 6: Run dashboard tests.

Run: `npm test tests/dashboard.test.ts`
Expected: PASS.

- [ ] Step 7: Commit.

```bash
git add src/modules/dashboard/dashboard.ts src/public/js/access.js src/public/js/dashboard.js src/public/index.html tests/dashboard.test.ts
git commit -m "feat: manage user access and budgets in dashboard"
```

### Task 6: Documentation And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/deployment.md`
- Modify: `docs/operations/docker.md`
- Modify: `docs/operations/railway.md`
- Modify: `docs/demo/**` as needed
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Step 1: Rename package metadata.

Set:

```json
{
  "name": "babel-pocket",
  "description": "Self-hosted user-install Discord translator for you and friends",
  "repository": {
    "type": "git",
    "url": "https://github.com/0xH4KU/babel-pocket"
  }
}
```

Run `npm install --package-lock-only` to update lock metadata.

- [ ] Step 2: Rewrite README sections around Babel Pocket.

Include:
- User-install app setup
- Default install settings: User Install with `applications.commands`
- Command registration for `Babel Pocket`
- User whitelist and per-user budget model
- Explicit statement that server install, public `/translate`, and webhooks are not part of Babel Pocket

- [ ] Step 3: Update operation docs and demo fixtures enough that dashboard text does not describe guild/server access as primary product behavior.

- [ ] Step 4: Run full verification.

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass.

- [ ] Step 5: Commit.

```bash
git add README.md docs package.json package-lock.json
git commit -m "docs: rename project to Babel Pocket"
```

---

## Self-Review

Spec coverage:
- Fork isolation covered by creating `/Users/HAKU/github/babel-pocket`; implementation happens only there.
- Name and command distinction covered by Task 1 and Task 6.
- User whitelist and user budget covered by Tasks 2-5.
- Server-to-user product conversion covered by Tasks 1, 3, 4, 5, and docs in Task 6.
- Dashboard continuity covered by Task 5.

Placeholder scan:
- No `TBD` or intentionally unresolved requirements remain.
- The plan includes some broad frontend/doc updates because exact generated text depends on existing markup; behavior-critical API and tests are explicit.

Type consistency:
- `allowedUserIds`, `defaultUserDailyBudgetUsd`, `userBudgets`, `userTokenUsage`, `userUsageHistory`, `billingUserId`, and `UsageScope` are used consistently across tasks.
