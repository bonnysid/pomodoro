import { Sparkles } from 'lucide-react';
import type { Snapshot } from '../../shared/contracts';
import type { Messages } from '../../shared/i18n';

export function StatsPanel({ snapshot, t }: { snapshot: Snapshot; t: Messages }) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    const records = snapshot.history.filter(
      (r) => r.endedAt >= date.getTime() && r.endedAt < end.getTime(),
    );
    return {
      date,
      count: records.length,
      minutes: Math.round(records.reduce((sum, r) => sum + r.durationMs, 0) / 60000),
    };
  });
  const today = days[6],
    max = Math.max(1, ...days.map((d) => d.count));
  return (
    <>
      <div className="stats-intro">
        <Sparkles size={17} />
        <span>{t.today}</span>
      </div>
      <div className="stats-numbers">
        <div>
          <strong>{today.count}</strong>
          <span>{t.completed}</span>
        </div>
        <div>
          <strong>
            {today.minutes}
            <small>{t.min}</small>
          </strong>
          <span>{t.focusTime}</span>
        </div>
      </div>
      <section className="settings-section">
        <h2>{t.week}</h2>
        <div
          className="week-chart"
          role="img"
          aria-label={days
            .map((d) => `${d.date.toLocaleDateString(snapshot.settings.language)}: ${d.count}`)
            .join('; ')}
        >
          {days.map((day, i) => (
            <div className={`chart-day ${i === 6 ? 'today' : ''}`} key={day.date.getTime()}>
              <span className="bar-count">{day.count}</span>
              <div className="bar-track">
                <span
                  className="bar"
                  style={{ height: `${Math.max(2, (day.count / max) * 100)}%` }}
                />
              </div>
              <span>
                {new Intl.DateTimeFormat(snapshot.settings.language, {
                  weekday: 'short',
                }).format(day.date)}
              </span>
            </div>
          ))}
        </div>
      </section>
      {snapshot.history.length === 0 && <p className="empty-note">{t.emptyStats}</p>}
      <p className="field-hint">{t.localHistory}</p>
    </>
  );
}
