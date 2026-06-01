export const DISCORD_MESSAGE_LIMIT = 2000;

const MAX_ORIGINAL_PREVIEW_LENGTH = 200;

export interface TranslationMessageOptions {
    originalText: string;
    translatedText: string;
    targetLanguage: string;
    cached: boolean;
    provider?: string;
    inputTokens?: number;
    outputTokens?: number;
    includeOriginalPreview?: boolean;
}

function quoteOriginalPreview(originalText: string): string {
    const preview =
        originalText.length > MAX_ORIGINAL_PREVIEW_LENGTH
            ? `${originalText.slice(0, MAX_ORIGINAL_PREVIEW_LENGTH)}...`
            : originalText;

    return `> ${preview.replace(/\n/g, '\n> ')}`;
}

function chunkText(text: string, firstLimit: number, continuationLimit: number): string[] {
    const chunks: string[] = [];
    let remaining = text;
    let limit = firstLimit;

    while (remaining.length > 0) {
        const chunk = remaining.slice(0, limit);
        chunks.push(chunk);
        remaining = remaining.slice(limit);
        limit = continuationLimit;
    }

    return chunks.length > 0 ? chunks : [''];
}

export function buildTranslationMessages(options: TranslationMessageOptions): string[] {
    if (!options.includeOriginalPreview) {
        return chunkText(options.translatedText, DISCORD_MESSAGE_LIMIT, DISCORD_MESSAGE_LIMIT);
    }

    const header = `${quoteOriginalPreview(options.originalText)}\n\n`;
    const firstLimit = Math.max(DISCORD_MESSAGE_LIMIT - header.length, 1);
    const chunks = chunkText(options.translatedText, firstLimit, DISCORD_MESSAGE_LIMIT);

    return chunks.map((chunk, index) => (index === 0 ? `${header}${chunk}` : chunk));
}
