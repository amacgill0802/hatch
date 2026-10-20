import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu } from '@hatch/ui';
import { SetupPromptItem } from './NavSetupPrompt';
import { SetupPromptBox } from './SetupPromptBox';

const PROMPT = 'Set me up with Hatch: https://example.test/hatch/setup/';

function withClipboard() {
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SetupPromptItem', () => {
  it('draws a "Setup Prompt" row with the copy mark, carrying the line on its title', () => {
    withClipboard();
    const html = renderToStaticMarkup(<SetupPromptItem prompt={PROMPT} />);

    expect(html).toContain('Setup Prompt');
    expect(html).toContain('hatch-menu__item');
    expect(html).toContain('<svg');
    expect(html).toContain(`title="${PROMPT}"`);
  });

  it('is a button, not a link, so pressing it copies rather than navigates', () => {
    withClipboard();
    const html = renderToStaticMarkup(<SetupPromptItem prompt={PROMPT} />);

    expect(html).toMatch(/^<button type="button"/);
    expect(html).not.toContain('href=');
  });

  it('draws nothing for a build stamped with no address', () => {
    withClipboard();
    expect(renderToStaticMarkup(<SetupPromptItem prompt={null} />)).toBe('');
  });

  it('draws nothing where the clipboard cannot be reached', () => {
    vi.stubGlobal('navigator', {});
    expect(renderToStaticMarkup(<SetupPromptItem prompt={PROMPT} />)).toBe('');
  });

  it('sits in the gear panel like any other row', () => {
    withClipboard();
    const html = renderToStaticMarkup(
      <Menu label="Settings and theme" trigger={(props) => <button {...props}>gear</button>} defaultOpen>
        <SetupPromptItem prompt={PROMPT} />
      </Menu>,
    );

    expect(html).toContain('Setup Prompt');
  });
});

describe('SetupPromptBox', () => {
  it('shows the whole line, selectable, with a copy press', () => {
    withClipboard();
    const html = renderToStaticMarkup(<SetupPromptBox prompt={PROMPT} />);

    expect(html).toContain(`<code>${PROMPT}</code>`);
    expect(html).toContain('Copy');
    expect(html).toContain('Claude Code');
  });

  it('still shows the line, to select by hand, where the clipboard cannot be reached', () => {
    vi.stubGlobal('navigator', {});
    const html = renderToStaticMarkup(<SetupPromptBox prompt={PROMPT} />);

    expect(html).toContain(`<code>${PROMPT}</code>`);
    expect(html).not.toContain('hatch-command-copy');
  });

  it('draws nothing for a build stamped with no address', () => {
    expect(renderToStaticMarkup(<SetupPromptBox prompt={null} />)).toBe('');
  });
});
