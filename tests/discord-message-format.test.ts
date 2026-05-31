import { describe, expect, it } from 'vitest';
import {
    buildTranslationMessages,
    DISCORD_MESSAGE_LIMIT,
} from '../src/shared/discord-message-format.js';

describe('discord message formatting', () => {
    it('should split long translation output into Discord-safe chunks without diagnostics by default', () => {
        const translatedText = 'a'.repeat(DISCORD_MESSAGE_LIMIT * 2 + 120);

        const messages = buildTranslationMessages({
            originalText: 'Hello world',
            translatedText,
            targetLanguage: 'ja',
            cached: true,
            provider: 'vertex',
            inputTokens: 12,
            outputTokens: 34,
        });

        expect(messages.length).toBeGreaterThan(1);
        expect(messages.every((message) => message.length <= DISCORD_MESSAGE_LIMIT)).toBe(true);
        expect(messages.join('')).toBe(translatedText);
    });

    it('should include the original preview without diagnostics when requested', () => {
        const messages = buildTranslationMessages({
            originalText: 'line one\nline two',
            translatedText: 'こんにちは',
            targetLanguage: 'ja',
            cached: false,
            includeOriginalPreview: true,
        });

        expect(messages).toHaveLength(1);
        expect(messages[0]).toBe('> line one\n> line two\n\nこんにちは');
        expect(messages[0]).not.toContain('Target:');
        expect(messages[0]).not.toContain('Cache:');
        expect(messages[0]).not.toContain('Provider:');
        expect(messages[0]).not.toContain('Tokens:');
    });

    it('should return only the translated text for short output', () => {
        const messages = buildTranslationMessages({
            originalText: 'line one\nline two',
            translatedText: 'こんにちは',
            targetLanguage: 'ja',
            cached: false,
        });

        expect(messages).toHaveLength(1);
        expect(messages[0]).toBe('こんにちは');
    });
});
