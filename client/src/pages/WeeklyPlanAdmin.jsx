import { useEffect, useState } from 'react';
import { api } from '../api.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function WeeklyPlanAdmin() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignments, setAssignments] = useState({});
  const [publishing, setPublishing] = useState(false);
  const [publishedMsg, setPublishedMsg] = useState('');

  function load() {
    setLoading(true);
    api
      .getWeeklyPlan()
      .then((data) => {
        setPlan(data);
        const initial = {};
        DAYS.forEach((day) => {
          initial[day] = data.assignments[day]?.id ? String(data.assignments[day].id) : '';
        });
        setAssignments(initial);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handlePublish() {
    setPublishing(true);
    setError('');
    setPublishedMsg('');
    const payload = {};
    DAYS.forEach((day) => {
      if (assignments[day]) payload[day] = Number(assignments[day]);
    });
    try {
      const updated = await api.publishWeeklyPlan(payload);
      setPlan(updated);
      setPublishedMsg('Published — the household will now see this week\'s calendar.');
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <p className="muted center">Loading this week's plan…</p>;
  if (error) return <p className="error center">{error}</p>;
  if (!plan || plan.status === 'none') {
    return (
      <section className="weekly-plan-admin">
        <h2>This week's plan</h2>
        <p className="muted">
          Nobody's submitted picks for next week yet — once they do, the choices will show up
          here so you can assign them to days.
        </p>
      </section>
    );
  }

  return (
    <section className="weekly-plan-admin">
      <h2>This week's plan</h2>
      <p className="muted">
        {plan.status === 'published'
          ? 'Published — live for the household. Adjust and republish any time.'
          : "Submitted — assign each pick to a day, then publish."}
      </p>

      <div className="plan-selections">
        {plan.selections.map((meal) => (
          <div key={meal.id} className="plan-selection-chip">
            <span>{meal.name}</span>
            {meal.freezable && <span className="freezable-badge">❄ freezable</span>}
            {(meal.sundayPrep || meal.midweekPrep) && (
              <span className="prep-hint">
                {meal.sundayPrep && `Sun prep: ${meal.sundayPrep}`}
                {meal.sundayPrep && meal.midweekPrep && ' · '}
                {meal.midweekPrep && `Midweek: ${meal.midweekPrep}`}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="day-assign-list">
        {DAYS.map((day) => (
          <label key={day} className="day-assign-row">
            <span className="day-assign-name">{day}</span>
            <select
              value={assignments[day] || ''}
              onChange={(e) => setAssignments((prev) => ({ ...prev, [day]: e.target.value }))}
            >
              <option value="">— none —</option>
              {plan.selections.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <p className="muted saturday-note">Saturday isn't planned — that's the cheat day.</p>
      </div>

      {publishedMsg && <p className="paste-msg">{publishedMsg}</p>}

      <button type="button" className="primary-btn" onClick={handlePublish} disabled={publishing}>
        {publishing ? 'Publishing…' : 'Publish plan for the week'}
      </button>
    </section>
  );
}
