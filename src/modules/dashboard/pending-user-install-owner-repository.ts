import type { DatabaseSync } from 'node:sqlite';
import { getSqliteDatabase } from '../../persistence/sqlite-database.js';

export interface PendingUserInstallOwner {
    userId: string;
    firstSeenAt: string;
    lastSeenAt: string;
    source: string;
}

interface PendingUserInstallOwnerRepositoryOptions {
    db?: DatabaseSync;
}

interface PendingUserInstallOwnerRow {
    userId: string;
    firstSeenAt: string;
    lastSeenAt: string;
    source: string;
}

export class PendingUserInstallOwnerRepository {
    private readonly db: DatabaseSync;

    constructor({ db = getSqliteDatabase() }: PendingUserInstallOwnerRepositoryOptions = {}) {
        this.db = db;
    }

    recordSeen(
        userId: string,
        {
            now = new Date(),
            source = 'unauthorized_translation',
        }: { now?: Date; source?: string } = {},
    ): void {
        const normalizedUserId = String(userId).trim();
        if (!normalizedUserId) {
            return;
        }

        const seenAt = now.toISOString();
        this.db
            .prepare(
                `
                INSERT INTO pending_user_install_owners (
                    user_id,
                    first_seen_at,
                    last_seen_at,
                    source
                )
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    last_seen_at = excluded.last_seen_at,
                    source = excluded.source
            `,
            )
            .run(normalizedUserId, seenAt, seenAt, source);
    }

    list(): PendingUserInstallOwner[] {
        const rows = this.db
            .prepare(
                `
                SELECT
                    user_id as userId,
                    first_seen_at as firstSeenAt,
                    last_seen_at as lastSeenAt,
                    source
                FROM pending_user_install_owners
                ORDER BY first_seen_at ASC, user_id ASC
            `,
            )
            .all() as unknown as PendingUserInstallOwnerRow[];

        return rows;
    }

    listUserIds(): string[] {
        return this.list().map((owner) => owner.userId);
    }
}
