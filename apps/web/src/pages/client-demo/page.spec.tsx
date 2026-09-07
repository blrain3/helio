// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Component as ClientDemoPage } from './page';

vi.mock('../../components/AeroShards', () => ({
  default: () => <div data-testid="aero-shards" aria-hidden="true" />,
}));

afterEach(cleanup);

describe('ClientDemoPage', () => {
  it('presents a client-facing energy overview with the AeroShards visual', () => {
    render(
      <MemoryRouter initialEntries={['/client-demo']}>
        <ClientDemoPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('aero-shards')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /你的阳光，\s*正在发电/ })).toBeTruthy();
    expect(screen.getByText('今日发电')).toBeTruthy();
    expect(screen.getByText('本月收益')).toBeTruthy();
    expect(screen.getByText('碳减排')).toBeTruthy();
    expect(screen.getByText('电站运行正常')).toBeTruthy();
    expect(screen.getByRole('link', { name: '进入我的电站' }).getAttribute('href')).toBe('/auth/login');
  });
});
