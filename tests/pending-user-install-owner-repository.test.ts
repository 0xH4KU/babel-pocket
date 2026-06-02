import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { PendingUserInstallOwnerRepository } from '../src/modules/dashboard/pending-user-install-owner-repository.js';
import { createSqliteDatabase } from '../src/persistence/sqlite-database.js';

describe('PendingUserInstallOwnerRepository', () => {
    let db: DatabaseSync | undefined;

    afterEach(() => {
        if (db?.isOpen) {
            db.close();
        }
    });

    it('should record pending user-install owners and preserve first seen time', () => {
        db = createSqliteDatabase(':memory:');
        const repository = new PendingUserInstallOwnerRepository({ db });

        repository.recordSeen(' owner-1 ', {
            now: new Date('2026-06-02T10:00:00.000Z'),
        });
        repository.recordSeen('owner-2', {
            now: new Date('2026-06-02T10:01:00.000Z'),
            source: 'unauthorized_translation',
        });
        repository.recordSeen('owner-1', {
            now: new Date('2026-06-02T10:02:00.000Z'),
        });
        repository.recordSeen('   ', {
            now: new Date('2026-06-02T10:03:00.000Z'),
        });

        expect(repository.listUserIds()).toEqual(['owner-1', 'owner-2']);
        expect(repository.list()).toEqual([
            {
                userId: 'owner-1',
                firstSeenAt: '2026-06-02T10:00:00.000Z',
                lastSeenAt: '2026-06-02T10:02:00.000Z',
                source: 'unauthorized_translation',
            },
            {
                userId: 'owner-2',
                firstSeenAt: '2026-06-02T10:01:00.000Z',
                lastSeenAt: '2026-06-02T10:01:00.000Z',
                source: 'unauthorized_translation',
            },
        ]);
    });
});
