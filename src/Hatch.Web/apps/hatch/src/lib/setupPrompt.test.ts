import { describe, expect, it } from 'vitest';
import { SETUP_PROMPT_LEAD, setupPrompt, stampedSetupGuide } from './setupPrompt';

describe('setupPrompt', () => {
  it('is the sentence, a space, and the address', () => {
    expect(setupPrompt('https://example.test/hatch/setup/')).toBe(`${SETUP_PROMPT_LEAD} https://example.test/hatch/setup/`);
  });

  it('trims the address it was stamped with', () => {
    expect(setupPrompt('  https://example.test/setup/\n')).toBe(`${SETUP_PROMPT_LEAD} https://example.test/setup/`);
  });

  it.each([null, undefined, '', '   '])('is null with no address (%j)', (guide) => {
    expect(setupPrompt(guide)).toBeNull();
  });

  it.each(['not a url', '/setup/', 'javascript:alert(1)', 'file:///etc/passwd'])(
    'is null for an address that is not a web page (%s)',
    (guide) => {
      expect(setupPrompt(guide)).toBeNull();
    },
  );
});

describe('stampedSetupGuide', () => {
  it('is null where there is no document', () => {
    expect(stampedSetupGuide()).toBeNull();
  });
});
