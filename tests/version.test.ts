import { describe, expect, it, vi } from 'vitest';
import {
    getVersionMetadata,
    getVersionMetadataWithUpdate,
    getVersionUpdateStatus,
    _test,
} from '../src/shared/version.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
}

describe('version metadata', () => {
    it('should expose the Babel Pocket application version', () => {
        expect(getVersionMetadata()).toEqual({
            version: '0.1.0',
            repositoryUrl: 'https://github.com/0xH4KU/babel-pocket',
        });
    });

    it('should report outdated when the latest release tag is newer', async () => {
        _test.resetVersionUpdateCache();
        const fetchImpl = vi.fn(async () =>
            jsonResponse({
                tag_name: 'v0.1.3',
                html_url: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.3',
            }),
        );

        const update = await getVersionUpdateStatus({
            currentVersion: '0.1.0',
            fetchImpl,
            latestReleaseUrl: 'https://example.test/releases/latest',
            cacheTtlMs: 0,
        });

        expect(update).toEqual({
            status: 'outdated',
            latestVersion: '0.1.3',
            latestUrl: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.3',
        });
        expect(fetchImpl).toHaveBeenCalledWith('https://example.test/releases/latest', {
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'babel-pocket',
            },
        });
    });

    it('should report current when the latest release matches the app version', async () => {
        _test.resetVersionUpdateCache();
        const fetchImpl = vi.fn(async () =>
            jsonResponse({
                tag_name: 'v0.1.0',
                html_url: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.0',
            }),
        );

        const metadata = await getVersionMetadataWithUpdate({
            currentVersion: '0.1.0',
            fetchImpl,
            latestReleaseUrl: 'https://example.test/releases/latest',
            cacheTtlMs: 0,
        });

        expect(metadata).toEqual({
            version: '0.1.0',
            repositoryUrl: 'https://github.com/0xH4KU/babel-pocket',
            update: {
                status: 'current',
                latestVersion: '0.1.0',
                latestUrl: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.0',
            },
        });
    });

    it('should refresh the latest release lookup when forced before the cache TTL expires', async () => {
        _test.resetVersionUpdateCache();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));

        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    tag_name: 'v0.1.0',
                    html_url: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.0',
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    tag_name: 'v0.1.3',
                    html_url: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.3',
                }),
            );

        try {
            const first = await getVersionUpdateStatus({
                currentVersion: '0.1.0',
                fetchImpl,
                latestReleaseUrl: 'https://example.test/releases/latest',
            });

            const second = await getVersionUpdateStatus({
                currentVersion: '0.1.0',
                fetchImpl,
                latestReleaseUrl: 'https://example.test/releases/latest',
                forceRefresh: true,
            });

            expect(first).toEqual({
                status: 'current',
                latestVersion: '0.1.0',
                latestUrl: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.0',
            });
            expect(second).toEqual({
                status: 'outdated',
                latestVersion: '0.1.3',
                latestUrl: 'https://github.com/0xH4KU/babel-pocket/releases/tag/v0.1.3',
            });
            expect(fetchImpl).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('should return unknown when release lookup fails', async () => {
        _test.resetVersionUpdateCache();
        const fetchImpl = vi.fn(async () =>
            jsonResponse({ message: 'rate limited' }, { status: 403 }),
        );

        const update = await getVersionUpdateStatus({
            currentVersion: '0.1.0',
            fetchImpl,
            latestReleaseUrl: 'https://example.test/releases/latest',
            cacheTtlMs: 0,
        });

        expect(update).toEqual({ status: 'unknown' });
    });
});
