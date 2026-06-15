import { useState } from 'react';
import { ArrowUpRight, BatteryCharging, Leaf, Sun, Zap } from 'lucide-react';
import { Link } from 'react-router';
import AeroShards from '../../components/AeroShards';
import './page.css';

const metrics = [
  {
    label: '今日发电',
    value: '86.4',
    unit: 'kWh',
    detail: '比昨日多 12.8%',
    icon: Zap,
    tone: 'gold',
  },
  {
    label: '本月收益',
    value: '1,286.40',
    unit: '元',
    detail: '已累计 24 天',
    icon: Sun,
    tone: 'mint',
  },
  {
    label: '碳减排',
    value: '42.8',
    unit: 'kg',
    detail: '相当于种下 2 棵树',
    icon: Leaf,
    tone: 'sky',
  },
] as const;

export function Component() {
  const [visualFallback, setVisualFallback] = useState(false);

  return (
    <main className={`client-demo${visualFallback ? ' client-demo--visual-fallback' : ''}`}>
      <section className="client-hero" aria-labelledby="client-demo-title">
        <div className="client-hero__visual" aria-hidden="true">
          <AeroShards
            backgroundColor="#071512"
            shardColor="#f5c84b"
            accentColor="#7dd3c7"
            placement="full"
            flow="stream"
            material="pearl"
            detail="balanced"
            effect="none"
            scale={1}
            spread={1}
            depth={1}
            speed={0.7}
            spin={1}
            interaction="repel"
            density={1}
            shardSize={1}
            stretch={1}
            turbulence={0.8}
            glow={0.8}
            bloom={0.35}
            grain={0.02}
            chromaticAberration={0.003}
            transitionDuration={1}
            interactionRadius={1.5}
            interactionStrength={0.35}
            rippleIntensity={0.7}
            holdToGather
            onError={() => setVisualFallback(true)}
          />
        </div>

        <div className="client-hero__inner">
          <header className="client-header">
            <Link className="client-brand" to="/client-demo" aria-label="Helio 客户端首页">
              <span className="client-brand__mark"><Sun size={18} strokeWidth={2.5} /></span>
              <span>Helio</span>
            </Link>
            <nav className="client-header__nav" aria-label="客户端导航">
              <span className="client-header__current">我的能源</span>
              <Link className="client-header__login" to="/auth/login">
                进入我的电站
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </nav>
          </header>

          <div className="client-hero__content">
            <div className="client-eyebrow"><span /> 家庭能源概览</div>
            <h1 id="client-demo-title">你的阳光，<br /><em>正在发电</em></h1>
            <p className="client-hero__description">
              每天的光，都在为你的生活积累一份清洁能量。
            </p>
            <div className="client-status" aria-live="polite">
              <span className="client-status__dot" />
              <span>电站运行正常</span>
              <span className="client-status__divider" />
              <span className="client-status__muted">实时更新</span>
            </div>
          </div>

          <div className="client-hero__footer">
            <span className="client-scroll-hint"><span className="client-scroll-hint__line" /> 今日能源表现</span>
            <span className="client-hero__date">2025.06.18 · 星期三</span>
          </div>
        </div>
      </section>

      <section className="client-overview" aria-labelledby="client-overview-title">
        <div className="client-overview__inner">
          <div className="client-section-heading">
            <div>
              <p className="client-kicker">Energy at a glance</p>
              <h2 id="client-overview-title">今天，阳光留下了什么</h2>
            </div>
            <div className="client-generation-note">
              <BatteryCharging size={19} aria-hidden="true" />
              <span>自发自用率 <strong>78%</strong></span>
            </div>
          </div>

          <dl className="client-metric-grid">
            {metrics.map(({ label, value, unit, detail, icon: Icon, tone }) => (
              <div className={`client-metric client-metric--${tone}`} key={label}>
                <div className="client-metric__topline">
                  <dt>{label}</dt>
                  <span className="client-metric__icon"><Icon size={18} aria-hidden="true" /></span>
                </div>
                <dd className="client-metric__value">
                  {value}<small>{unit}</small>
                </dd>
                <dd className="client-metric__detail">{detail}</dd>
              </div>
            ))}
          </dl>

          <div className="client-summary">
            <div className="client-summary__copy">
              <span className="client-summary__label">Helio / 01</span>
              <p>一整天的清洁能源，正在安静地流入你的家。</p>
            </div>
            <Link className="client-summary__link" to="/auth/login">
              查看完整能源报告
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
