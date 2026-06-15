// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppShell } from './AppShell';

afterEach(cleanup);

function renderShell() {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route path="dashboard" element={<div>运营看板内容</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('opens an accessible mobile navigation drawer and dismisses it with Escape', async () => {
    const user = userEvent.setup();
    renderShell();

    const menuButton = screen.getByRole('button', { name: '打开导航菜单' });
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');

    await user.click(menuButton);

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: '主导航菜单' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '关闭导航菜单' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: '主导航菜单' })).toBeNull();
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(menuButton);
  });

  it('closes the mobile drawer after a destination is chosen', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: '打开导航菜单' }));
    const drawer = screen.getByRole('dialog', { name: '主导航菜单' });
    await user.click(within(drawer).getByRole('link', { name: '运营看板' }));

    expect(screen.queryByRole('dialog', { name: '主导航菜单' })).toBeNull();
  });
});
