import { describe, expect, it } from 'vitest';
import { commands } from '../scripts/register.js';

describe('register commands', () => {
    it('should register Babel Pocket as a user-install message command', () => {
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

    it('should not register the public translate slash command', () => {
        expect(commands.some((item) => item.name === 'translate')).toBe(false);
    });
});
