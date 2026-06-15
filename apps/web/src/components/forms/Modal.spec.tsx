// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function ModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        打开对话框
      </button>
      <Modal open={open} title="测试对话框" onClose={() => setOpen(false)}>
        <button type="button">第一个操作</button>
        <button type="button">最后操作</button>
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('moves initial focus to the close control when opened', async () => {
    const user = userEvent.setup();

    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: '打开对话框' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭对话框' }));
  });

  it('dismisses when Escape is pressed', async () => {
    const user = userEvent.setup();

    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: '打开对话框' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traps Tab focus within the dialog', async () => {
    const user = userEvent.setup();

    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: '打开对话框' }));

    const closeButton = screen.getByRole('button', { name: '关闭对话框' });
    const firstAction = screen.getByRole('button', { name: '第一个操作' });
    const lastAction = screen.getByRole('button', { name: '最后操作' });

    await user.tab();
    expect(document.activeElement).toBe(firstAction);
    await user.tab();
    expect(document.activeElement).toBe(lastAction);
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastAction);
  });

  it('restores the trigger focus and body scrolling after dismissal', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'auto';

    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: '打开对话框' });
    trigger.focus();
    await user.click(trigger);

    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: '关闭对话框' }));

    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(document.body.style.overflow).toBe('auto');
  });
});
