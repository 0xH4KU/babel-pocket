# Babel Pocket Pending Users Design

**Goal:** When an unauthorized user-install owner tries Babel Pocket, record that owner so the dashboard can show them as disabled/pending until an admin enables them.

**Scope:** Babel Pocket only. Babel Discord Translator stays unchanged.

## Design

`allowedUserIds` keeps its current meaning: a user-install owner is authorized only when their ID is in this list. Unauthorized user-install attempts are written to a separate SQLite table, `pending_user_install_owners`, with `user_id`, `first_seen_at`, `last_seen_at`, and `source`.

The translation service records a pending owner only when the request is blocked because a `billingUserId` is not allowed and the guild is not allowed. The context menu command already passes `authorizingIntegrationOwners['1']` as `billingUserId`, so the stored ID is the user-install owner, not necessarily the actor ID.

The dashboard reads the union of:

- `allowedUserIds`
- pending user-install owners
- users with custom budgets

`/api/user-budgets` returns a row for each union member. Each row includes `allowed: boolean`, `pending: boolean`, `budget`, and `isCustom`. Existing profile resolution runs for every listed user so the UI can show names and avatars where Discord can resolve them.

The access UI renders all access users with an enable toggle. Toggling on adds the ID to the draft whitelist; toggling off removes it from the draft. Saving still posts only `allowedUserIds` to `/api/config`, so pending rows remain disabled until explicitly enabled.

## Non-Goals

- Do not auto-authorize newly seen users.
- Do not delete pending rows when they are enabled.
- Do not change budget enforcement semantics.
- Do not add this feature to Babel Discord Translator.

## Tests

- SQLite migration creates `pending_user_install_owners`.
- Repository upserts first/last seen timestamps and lists user IDs.
- Translation service records unauthorized user-install owners while preserving the blocked response.
- Dashboard `/api/user-budgets` includes pending users with `allowed: false` and `pending: true`.
- Existing allowed users still show as `allowed: true`.
