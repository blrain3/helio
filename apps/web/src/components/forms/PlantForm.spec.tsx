// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlantForm } from './PlantForm';

afterEach(cleanup);

describe('PlantForm', () => {
  it('submits the typed plant payload entered by an operator', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<PlantForm onSubmit={submit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('电站名称'), '东港光伏');
    await user.clear(screen.getByLabelText('装机容量 (kW)'));
    await user.type(screen.getByLabelText('装机容量 (kW)'), '320.5');
    await user.type(screen.getByLabelText('位置'), '上海市临港');
    await user.click(screen.getByRole('button', { name: '保存电站' }));

    expect(submit).toHaveBeenCalledWith({
      name: '东港光伏',
      capacity: 320.5,
      location: '上海市临港',
    });
  });
});
