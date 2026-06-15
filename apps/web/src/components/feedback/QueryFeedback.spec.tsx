// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryFeedback } from './QueryFeedback';

afterEach(cleanup);

describe('QueryFeedback', () => {
  it('renders a retry affordance when a query fails', async () => {
    const retry = vi.fn();
    const user = userEvent.setup();

    render(
      <QueryFeedback error={new Error('网络连接失败')} onRetry={retry}>
        <div>不应显示的旧数据</div>
      </QueryFeedback>,
    );

    expect(screen.getByRole('alert').textContent).toContain('网络连接失败');
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
