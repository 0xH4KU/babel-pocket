import { describe, expect, it, vi } from 'vitest';
import { handleBabel } from '../src/commands/babel.js';

function createInteraction() {
    return {
        guildId: 'guild-1',
        guild: { name: 'Test Guild' },
        user: {
            id: 'user-1',
            tag: 'user#0001',
        },
        locale: 'en-US',
        targetMessage: {
            content: 'test',
        },
        reply: vi.fn(),
        deferReply: vi.fn(),
        editReply: vi.fn(),
        followUp: vi.fn(),
    };
}

describe('handleBabel', () => {
    it('should reply with the original preview and translated text without diagnostics', async () => {
        const translationService = {
            process: vi.fn().mockResolvedValue({
                status: 'success',
                deferred: true,
                translatedText: 'translated test',
                originalText: 'test',
                cached: false,
                targetLanguage: 'zh-TW',
                langSource: 'locale',
                provider: 'openai',
                inputTokens: 110,
                outputTokens: 1,
            }),
        };
        const interaction = createInteraction();

        await handleBabel(interaction as never, {
            translationService: translationService as never,
        });

        expect(interaction.editReply).toHaveBeenCalledWith({
            content: '> test\n\ntranslated test',
        });
        const content = interaction.editReply.mock.calls[0]?.[0]?.content;
        expect(content).not.toContain('Target:');
        expect(content).not.toContain('Cache:');
        expect(content).not.toContain('Provider:');
        expect(content).not.toContain('Tokens:');
        expect(interaction.followUp).not.toHaveBeenCalled();
    });
});
