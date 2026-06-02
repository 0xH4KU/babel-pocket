# Discord User Profile Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cached Discord user profile metadata so dashboard user rows show names and avatars instead of only numeric IDs.

**Architecture:** Add a SQLite-backed `DiscordUserProfileRepository`, a dashboard resolver that refreshes missing profiles through `client.users.fetch`, and API response metadata consumed by the Access tab. Keep user ID as the authorization key and treat profile metadata as best-effort display data.

**Tech Stack:** TypeScript, Node.js `node:sqlite`, discord.js v14, Express, Vitest, browser JavaScript.

---

### Task 1: Persist Discord User Profiles

**Files:**
- Modify: `src/types.ts`
- Modify: `src/persistence/sqlite-database.ts`
- Create: `src/modules/dashboard/discord-user-profile-repository.ts`
- Test: `tests/discord-user-profile-repository.test.ts`
- Test: `tests/sqlite-database.test.ts`

- [ ] **Step 1: Write failing repository and migration tests**

Add tests that expect `discord_user_profiles` to exist and profile upsert/list behavior to work.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/discord-user-profile-repository.test.ts tests/sqlite-database.test.ts`

Expected: fails because repository file/table support does not exist.

- [ ] **Step 3: Add `DiscordUserProfile` type, migration, and repository**

Implement `DiscordUserProfile`, migration id 4, and a repository with `listProfiles(userIds)`, `upsertProfile(profile)`, and `upsertProfiles(profiles)`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/discord-user-profile-repository.test.ts tests/sqlite-database.test.ts`

Expected: pass.

### Task 2: Resolve Profiles For Dashboard APIs

**Files:**
- Create: `src/modules/dashboard/discord-user-profile-resolver.ts`
- Modify: `src/modules/dashboard/dashboard.ts`
- Test: `tests/dashboard.test.ts`

- [ ] **Step 1: Write failing dashboard API tests**

Add tests for `/api/user-prefs` returning `{ prefs, count, profiles }` and `/api/user-budgets` returning `{ budgets, profiles }`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/dashboard.test.ts`

Expected: fails because profile metadata is not returned.

- [ ] **Step 3: Implement resolver and wire dashboard routes**

Instantiate the repository in `createDashboardApp`. Use the resolver in user preference and user budget routes. Keep fetch failures non-fatal.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/dashboard.test.ts`

Expected: pass.

### Task 3: Render Profiles In Access UI

**Files:**
- Modify: `src/public/js/access.js`
- Modify: `src/public/css/dashboard.css` or `src/public/css/settings.css` if existing layout needs a small helper class
- Test: existing dashboard/API tests only unless a frontend unit harness exists

- [ ] **Step 1: Update data loading contract**

Load `profiles` from `/api/user-budgets` and `/api/user-prefs`.

- [ ] **Step 2: Add rendering helpers**

Add helper functions for escaping HTML, resolving profile display name, avatar URL fallback, and searchable profile text.

- [ ] **Step 3: Update whitelist and preferences rendering**

Rows should show avatar, display name, and ID. Search should include profile names.

- [ ] **Step 4: Run frontend-adjacent verification**

Run: `npm run typecheck && npm test -- tests/dashboard.test.ts`

Expected: pass.

### Task 4: Port Same Contract To Babel

**Files:**
- Apply equivalent backend and frontend changes to `../babel-discord-translator`
- Test equivalent files in `../babel-discord-translator/tests`

- [ ] **Step 1: Port Task 1 changes**

Add the same type, migration, repository, and tests.

- [ ] **Step 2: Port Task 2 changes**

Add resolver and `/api/user-prefs` profile response.

- [ ] **Step 3: Port Task 3 frontend user preference rendering**

Update Babel's Access tab user preference table to use profile display data.

- [ ] **Step 4: Run Babel verification**

Run from `../babel-discord-translator`: `npm run typecheck && npm test`

Expected: pass.

### Task 5: Full Verification

**Files:** all changed files.

- [ ] **Step 1: Run Babel Pocket verification**

Run: `npm run typecheck && npm test`

Expected: pass.

- [ ] **Step 2: Run Babel verification**

Run from `../babel-discord-translator`: `npm run typecheck && npm test`

Expected: pass.

- [ ] **Step 3: Review diffs**

Run: `git diff --stat` in both repos and inspect the changed files for accidental unrelated changes.
