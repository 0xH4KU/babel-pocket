# Pocket Pending Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add disabled pending dashboard rows for unauthorized Babel Pocket user-install owners.

**Architecture:** Store pending owners separately from `allowedUserIds`. Record pending owners from the translation-service authorization block. Merge pending, allowed, and budget users in the dashboard API, then render enable toggles in the access UI.

**Tech Stack:** TypeScript, Vitest, Node `node:sqlite`, Express dashboard, vanilla dashboard JavaScript.

---

### Task 1: Persistence

**Files:**
- Modify: `src/persistence/sqlite-database.ts`
- Create: `src/modules/dashboard/pending-user-install-owner-repository.ts`
- Test: `tests/sqlite-database.test.ts`
- Test: `tests/pending-user-install-owner-repository.test.ts`

- [ ] Add migration `pending_user_install_owners` with `user_id`, `first_seen_at`, `last_seen_at`, `source`.
- [ ] Add repository methods `recordSeen(userId, options?)` and `listUserIds()`.
- [ ] Verify repository keeps the first seen timestamp and updates last seen timestamp.

### Task 2: Translation Recording

**Files:**
- Modify: `src/modules/translation/translation-service.ts`
- Test: `tests/translation-service.test.ts`

- [ ] Add optional `pendingUserInstallOwnerRepository` dependency.
- [ ] When authorization blocks a non-allowed `billingUserId`, call `recordSeen(billingUserId)`.
- [ ] Keep the response as `This user is not authorized.`

### Task 3: Dashboard API

**Files:**
- Modify: `src/types.ts`
- Modify: `src/modules/dashboard/dashboard.ts`
- Test: `tests/dashboard.test.ts`

- [ ] Add optional dashboard dependency for pending owner repository.
- [ ] Merge allowed, pending, and custom-budget user IDs in `/api/user-budgets`.
- [ ] Return `allowed` and `pending` on each budget row.
- [ ] Resolve Discord profiles for every merged ID.

### Task 4: Access UI

**Files:**
- Modify: `src/public/js/access.js`
- Modify: `docs/demo/js/access.js` after demo build

- [ ] Store the merged budget payload from `/api/user-budgets`.
- [ ] Render all merged users, not only the draft whitelist.
- [ ] Replace remove-only behavior with an enable/disable toggle that edits the draft `allowedUserIds`.
- [ ] Keep manual add behavior, with newly added IDs enabled in the draft.

### Task 5: Verification And Commit

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run demo:build`
- `git status --short`
- `git add ...`
- `git commit -m "feat: list pending pocket users"`
