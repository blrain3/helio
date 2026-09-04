// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EnergyTrendChart } from './EnergyTrendChart';

afterEach(cleanup);

describe('EnergyTrendChart', () => {
  it('renders labelled daily energy data as an accessible SVG chart', () => {
    render(
      <EnergyTrendChart
        data={[
          { day: '2026-09-01T00:00:00.000Z', totalKwh: 18.5, recordCount: 2 },
          { day: '2026-09-02T00:00:00.000Z', totalKwh: 27, recordCount: 3 },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: '近 7 日发电量趋势' })).toBeTruthy();
    expect(screen.getByText('18.5 kWh')).toBeTruthy();
    expect(screen.getByText('9月1日', { selector: 'text' })).toBeTruthy();
  });

  it('renders an explicit no-data state instead of a blank chart', () => {
    render(<EnergyTrendChart data={[]} />);

    expect(screen.getByText('暂时没有可展示的发电记录')).toBeTruthy();
  });
});
