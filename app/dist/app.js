import { plan as seedPlan, exercises as seedExercises } from './plan.js';
import { localDate, weekStart, weekDays, createSession, validSet, summary, previousSets, exerciseSeries, validateBackup } from './domain.js';
import { createFeatures } from './features.js';
import { snapshot, mergeStates } from './domain.js';
import { createSync } from './sync.js';
import { loadState, saveState, emptyState, exportState } from './storage.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = n => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);
const dateLabel = (d, options = {}) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', ...options }).format(new Date(d));
const iconPaths = {
 home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',
 grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
 chart: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 16v-4m4 4V7m4 9v-6"/>',
 calendar: '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',
 settings: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><circle cx="12" cy="12" r="3.5"/>',
 arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', back: '<path d="m15 5-7 7 7 7"/>',
 check: '<path d="m5 12 4 4L19 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
 clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
 dumbbell: '<path d="m7 7 10 10M3 7l4-4m10 18 4-4M3 3l4 4m10 10 4 4M5 9l4-4m6 14 4-4"/>',
 download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10"/>',
 info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>', play: '<path d="m8 4 12 8-12 8z"/>', trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>', leaf: '<path d="M20 3C7 2 2 9 5 16s16 3 15-13ZM4 21 15 9"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.dumbbell}</svg>`;
let state, storageError = false;
try { state = loadState(); } catch { state = emptyState(); storageError = true; }
let plan = [], exercises = [], features, sync;
function refreshCatalog() {
  plan = state.plans.find(p=>p.id===state.activePlanId)?.workouts || seedPlan;
  exercises = [...new Map([...seedExercises,...state.plans.flatMap(p=>p.workouts.flatMap(w=>w.exercises)),...state.sessions.flatMap(s=>snapshot(s).exercises),...(state.active?snapshot(state.active).exercises:[])].map(e=>[e.id,e])).values()];
}
refreshCatalog();
let view = 'home', selected = new Date(), statsTab = 'global', period = '3M', exerciseId = exercises[0].id, metric = 'weight';
let toastTimer, dialogReturnFocus;
const currentRest = () => state.active?.restSeconds ?? state.preferences.restSeconds;
const navItems = [['home', 'home', 'Übersicht'], ['plan', 'grid', 'Mein Plan'], ['stats', 'chart', 'Fortschritt'], ['history', 'calendar', 'Verlauf'], ['settings', 'settings', 'Einstellungen']];
function persist() {
  try { saveState(state); refreshCatalog(); sync?.schedule(); return true; } catch { toast('Speichern fehlgeschlagen. Bitte exportiere deine Daten als Sicherung.'); return false; }
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
function applyTheme() {
  const theme = state.preferences.theme;
  document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  $('meta[name="theme-color"]').content = document.documentElement.dataset.theme === 'dark' ? '#151615' : '#f8f8f6';
}
function render() {
  refreshCatalog();
  applyTheme();
  const training = view === 'workout' && state.active;
  $('#app').innerHTML = `<div class="app-shell ${training ? 'training-shell' : ''}">
    <aside class="sidebar"><a href="#" class="brand" data-action="nav" data-view="home"><span class="brand-mark">${icon('chart')}</span><span>TEAM<span class="brand-second">PROGRESS</span></span></a>
      <div class="sidebar-label">DEIN TRAINING</div><nav aria-label="Hauptnavigation">${navItems.map(([v, i, label]) => `<button class="nav-item ${view === v ? 'active' : ''}" data-action="nav" data-view="${v}" ${view === v ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${view === v ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>
      <div class="profile"><span class="avatar">${esc((state.preferences.name || 'Du').slice(0, 1).toUpperCase())}</span><div><strong>${esc(state.preferences.name || 'Dein Training')}</strong><span>Dein persönlicher Plan</span></div></div>
    </aside><main id="main" tabindex="-1">${training ? workoutView() : normalView()}</main>
    ${!training ? `<nav class="bottom-nav" aria-label="Mobile Navigation">${navItems.filter(([v])=>v!=='settings').map(([v, i, label]) => `<button data-action="nav" data-view="${v}" aria-label="${label}" ${view === v ? 'aria-current="page"' : ''} class="${view === v ? 'active' : ''}">${icon(i)}<span>${label === 'Einstellungen' ? 'Profil' : label === 'Mein Plan' ? 'Plan' : label === 'Übersicht' ? 'Heute' : label}</span></button>`).join('')}</nav>` : ''}
    </div>`;
  updateTimers();
}
function normalView() {
  const titles = { home: `<span>Hey,</span> ${esc(state.preferences.name || 'du')}.`, plan: '<span>Dein</span> Plan.', stats: '<span>Dein</span> Fortschritt.', history: '<span>Dein</span> Verlauf.', settings: '<span>Ganz</span> du.' };
  return `<header class="page-header"><div><div class="eyebrow">${view === 'home' ? dateLabel(new Date(), { weekday: 'long' }) : 'TEAM PROGRESS'}</div><h1>${titles[view]}</h1></div><button class="icon-button" data-action="nav" data-view="settings" aria-label="Einstellungen">${icon('settings')}</button></header>
    ${storageError ? '<div class="notice">Deine gespeicherten Daten konnten nicht geladen werden. Sichere vorhandene Browserdaten, bevor du neue Trainings speicherst.</div>' : ''}
    ${state.active && view !== 'settings' ? `<button class="resume-banner" data-action="resume"><span class="live-dot"></span>${esc(snapshot(state.active).name)} läuft · Training fortsetzen ${icon('arrow')}</button>` : ''}
    ${{ home: homeView, plan: planView, stats: statsView, history: historyView, settings: settingsView }[view]?.() || homeView()}`;
}
function weekCalendar() {
  const days = weekDays(selected);
  return `<section class="week-strip" aria-label="Wochenauswahl"><button class="calendar-arrow" data-action="week" data-offset="-7" aria-label="Vorherige Woche">${icon('back')}</button><div class="week-days">${days.map((d, i) => {
    const completed = state.sessions.some(s => s.date === localDate(d));
    return `<button data-action="day" data-date="${localDate(d)}" class="day ${localDate(d) === localDate(selected) ? 'selected' : ''} ${localDate(d) === localDate() ? 'today' : ''}" aria-label="${dateLabel(d, { weekday: 'long' })}${completed ? ', trainiert' : ''}" aria-pressed="${localDate(d) === localDate(selected)}"><span>${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i]}</span><strong>${d.getDate()}</strong><i class="${completed ? 'done-dot' : ''}"></i></button>`;
  }).join('')}</div><button class="calendar-arrow" data-action="week" data-offset="7" aria-label="Nächste Woche"><span class="flip">${icon('back')}</span></button></section>`;
}
function homeView() {
  const weekday = (selected.getDay() + 6) % 7, workout = features.workoutForDate(selected);
  const week = weekDays(selected).map(localDate), weekSessions = state.sessions.filter(s => week.includes(s.date));
  const doneDays = new Set(weekSessions.map(s => s.workoutId)).size;
  const totalSets = weekSessions.reduce((n, s) => n + summary(s).sets, 0);
  const today = localDate(selected) === localDate();
  return `${weekCalendar()}<div class="home-grid"><section class="hero-card ${workout ? '' : 'recovery'}"><div class="hero-top"><span class="pill-dot"></span>${today ? 'HEUTE' : dateLabel(selected).toUpperCase()}<span class="hero-type">${workout ? 'KRAFTTRAINING' : 'ERHOLUNG'}</span></div><div class="hero-title"><div><p>${workout ? `EINHEIT ${esc(workout.letter)}` : 'ZEIT FÜR DICH'}</p><h2>${workout ? esc(workout.name) : 'Durchatmen.'}</h2></div><span class="hero-number">${workout ? `0${weekday + 1}` : icon('leaf')}</span></div><div class="hero-meta">${workout ? `${workout.exercises.length} Übungen <span>·</span> ${workout.exercises.reduce((n,e)=>n+(e.setCount??2),0)} Arbeitssätze <span>·</span> Dein Plan` : 'Heute ist kein Training eingeplant.'}</div><div class="hero-bottom"><span>${workout ? 'Dein nächster Schritt beginnt hier.' : 'Fortschritt braucht auch Pausen.'}</span>${workout ? `<button class="light-button" data-action="start" data-id="${workout.id}">${state.active?.workoutId === workout.id ? 'Fortsetzen' : 'Training starten'} ${icon('arrow')}</button>` : `<button class="light-button" data-action="nav" data-view="plan">Plan ansehen ${icon('arrow')}</button>`}</div></section>
    <section class="week-card"><div class="section-overline">DEINE WOCHE <span>${icon('arrow')}</span></div><div class="week-ring" style="--progress:${Math.min(100, doneDays / plan.length * 100)}%"><div><strong>${doneDays}<span>/ ${plan.length}</span></strong><small>Einheiten</small></div></div><h3>${doneDays === 0 ? 'Bereit, wenn du es bist.' : doneDays >= plan.length ? 'Eine starke Woche.' : 'Du bleibst dran.'}</h3><p>${totalSets ? `${totalSets} Sätze diese Woche absolviert.` : 'Eine Einheit. Ein guter Anfang.'}</p><div class="five-bars">${plan.map(w => `<span class="${weekSessions.some(s => s.workoutId === w.id) ? 'filled' : ''}"></span>`).join('')}</div></section></div>
    <div class="section-heading"><div><div class="eyebrow">KONSTANZ SCHLÄGT PERFEKTION</div><h2>Deine Trainingswoche</h2></div><button class="text-button" data-action="nav" data-view="plan">Plan ansehen ${icon('arrow')}</button></div><div class="routine-grid">${plan.map((w, i) => routineCard(w, i, weekSessions)).join('')}</div>${features.activityLinks()}`;
}
function routineCard(w, i, sessions = []) {
  const done = sessions.some(s => s.workoutId === w.id);
  return `<button class="routine-card" data-action="preview" data-id="${w.id}"><div class="routine-top"><span>${['MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG','SAMSTAG','SONNTAG'][w.day]}</span>${done ? `<span class="completed-badge">${icon('check')} Erledigt</span>` : icon('arrow')}</div><div class="routine-body"><div><h3>${esc(w.name)}</h3><p>${w.exercises.length} Übungen · ${w.exercises.reduce((n,e)=>n+(e.setCount??2),0)} Sätze</p></div><strong class="routine-number">0${i + 1}</strong></div><div class="routine-tags">${[...new Set(w.exercises.map(e => e.muscle.replace('Vordere Oberschenkel (Quads)', 'Quads').replace('Hintere Oberschenkel (Hams)', 'Hamstrings')))].slice(0, 3).map(m => `<span>${esc(m)}</span>`).join('')}</div></button>`;
}
function planView() { return features.planView(); }
function previewWorkout(id) {
  const w = features.findWorkout(id); if (!w) return;
  openDialog(`<div class="eyebrow">${['MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG','SAMSTAG','SONNTAG'][w.day]} · EINHEIT ${esc(w.letter)}</div><h2>${esc(w.name)}</h2><p class="muted">${w.exercises.length} Übungen · ${w.exercises.reduce((n,e)=>n+(e.setCount??2),0)} Arbeitssätze</p><div class="preview-list">${w.exercises.map((ex, i) => `<button class="preview-exercise" data-action="exercise" data-id="${ex.id}"><span class="list-number">${String(i + 1).padStart(2, '0')}</span><span><strong>${esc(ex.name)}</strong><small>${esc(ex.muscle)} · ${esc(ex.target)} Wdh.</small></span>${icon('info')}</button>`).join('')}</div><div class="dialog-footer"><button class="primary-button full-width" data-action="start" data-id="${w.id}">Training starten ${icon('arrow')}</button></div>`);
}
function workoutView() {
  const active = state.active, workout = snapshot(active), completed = summary(active).sets, total = active.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  return `<header class="workout-header"><button class="icon-button" data-action="nav" data-view="home" aria-label="Training minimieren">${icon('back')}</button><div><span class="eyebrow">TRAINING LÄUFT</span><h1>${esc(workout.name)}<span class="elapsed" data-elapsed></span></h1></div><button class="primary-button compact" data-action="finish">Beenden ${icon('check')}</button></header><button class="text-button danger discard-top" data-action="discard">Training verwerfen</button><div class="training-progress"><div style="width:${completed / total * 100}%"></div></div><div class="workout-layout"><section class="exercise-stack">${active.exercises.map((ex, idx) => {
    const source = workout.exercises.find(e => e.id === ex.id), previous = previousSets(state.sessions, ex.id);
    return `<article class="exercise-card"><header><span class="exercise-glyph">${icon('dumbbell')}</span><div><span class="eyebrow">${String(idx + 1).padStart(2, '0')} / ${String(active.exercises.length).padStart(2, '0')} · ${esc(source.muscle)}</span><h2><button data-action="exercise" data-id="${ex.id}">${esc(source.name)} ${icon('info')}</button></h2></div></header><label class="note-input">${icon('info')}<input aria-label="Notiz zu ${esc(source.name)}" placeholder="Eigene Notiz hinzufügen …" maxlength="3000" value="${esc(ex.note)}" data-note="${ex.id}"></label>${features.warmup(ex,source,idx,workout)}<div class="set-table"><div class="set-labels"><span>Satz</span><span>Zuletzt</span><span>Wdh.</span><span>${source.bodyweight ? '+ kg' : 'kg'}</span><span class="sr-only">Erledigt</span></div>${ex.sets.map((s, i) => `<div class="set-row ${s.done ? 'is-done' : ''}" data-row="${ex.id}:${i}"><span class="set-index">${i + 1}<small>${esc(source.rir && !source.rir.startsWith('Satz') ? 'RIR '+source.rir : (i < 2 ? `RIR ${i === 0 ? '0–1' : '2–3'}` : 'Extra'))}</small></span><span class="previous-value">${previous[i] ? `${number(previous[i].kg)} kg × ${previous[i].reps} Wdh.` : '—'}<small>${previous[i] ? '' : 'Noch offen'}</small></span><input type="number" inputmode="numeric" min="1" max="1000" step="1" placeholder="—" aria-label="${esc(source.name)}, Satz ${i + 1}, Wiederholungen" value="${esc(s.reps)}" data-ex="${ex.id}" data-set="${i}" data-field="reps" ${s.done ? 'readonly' : ''}><input type="number" inputmode="decimal" min="0" max="2000" step="any" placeholder="—" aria-label="${esc(source.name)}, Satz ${i + 1}, ${source.bodyweight ? 'Zusatzgewicht' : 'Gewicht'} in kg" value="${esc(s.kg)}" data-ex="${ex.id}" data-set="${i}" data-field="kg" ${s.done ? 'readonly' : ''}><button class="set-check ${s.done ? 'checked' : ''}" data-action="check" data-ex="${ex.id}" data-set="${i}" aria-label="${esc(source.name)}, Satz ${i + 1} ${s.done ? 'wieder öffnen' : 'abschließen'}" aria-pressed="${s.done}">${icon('check')}</button></div>`).join('')}</div><div class="set-actions"><button class="text-button" data-action="add-set" data-ex="${ex.id}">${icon('plus')} Satz hinzufügen</button>${ex.sets.length > 2 && !ex.sets.at(-1).done ? `<button class="icon-button small" data-action="remove-set" data-ex="${ex.id}" aria-label="Letzten Zusatzsatz entfernen">${icon('trash')}</button>` : ''}${previous.length ? `<button class="text-button" data-action="load-previous" data-ex="${ex.id}">Vorwerte laden</button>` : ''}</div></article>`;
  }).join('')}</section><aside class="training-aside"><div class="timer-card"><div class="section-overline">DEINE PAUSE ${icon('clock')}</div><strong class="rest-digits" data-rest>02:00</strong><p data-rest-label>Ein Moment zum Durchatmen.</p><button class="primary-button full-width" data-action="timer" data-timer-button>Timer starten</button><div class="timer-options">${[60, 120, 180].map(n => `<button class="${currentRest() === n ? 'selected' : ''}" data-action="rest" data-seconds="${n}">${n / 60} min</button>`).join('')}</div><button class="text-button full-width" data-action="edit-rest">Pause anpassen</button></div><div class="training-totals"><span>DEINE EINHEIT</span><div><p>Abgeschlossene Sätze</p><strong>${completed} <small>/ ${total}</small></strong></div><div><p>Erfasstes Volumen</p><strong>${number(summary(active).volume)} <small>kg</small></strong></div></div></aside></div><div class="mobile-timer"><button class="mobile-rest-edit" data-action="edit-rest" aria-label="Pausendauer anpassen">${icon('clock')} Pause <strong data-rest></strong><span>Ändern</span></button><button data-action="timer" data-timer-button>Timer starten</button></div>`;
}
function filteredSessions() {
  if (period === 'All') return state.sessions;
  const d = new Date(); d.setMonth(d.getMonth() - ({ '1M': 1, '3M': 3, '6M': 6 }[period]));
  return state.sessions.filter(s => Date.parse(s.finishedAt) >= d.getTime());
}
function periodButtons() { return `<div class="period-switch" aria-label="Zeitraum">${['1M', '3M', '6M', 'All'].map(p => `<button data-action="period" data-period="${p}" class="${period === p ? 'selected' : ''}" aria-pressed="${period === p}">${p === 'All' ? 'Alle' : p.replace('M', ' Monat' + (p === '1M' ? '' : 'e'))}</button>`).join('')}</div>`; }
function statsView() {
  const sessions = filteredSessions(), totals = sessions.reduce((n, s) => { const v = summary(s); return { sets: n.sets + v.sets, volume: n.volume + v.volume, minutes: n.minutes + v.minutes }; }, { sets: 0, volume: 0, minutes: 0 });
  return `<div class="stats-top"><div class="tab-switch"><button data-action="stats-tab" data-tab="global" class="${statsTab === 'global' ? 'selected' : ''}">Gesamt</button><button data-action="stats-tab" data-tab="exercise" class="${statsTab === 'exercise' ? 'selected' : ''}">Übungen</button></div>${periodButtons()}</div>${features.recordView()}${statsTab === 'global' ? `<div class="stat-tiles">${[[sessions.length, 'Einheiten', 'calendar'], [totals.sets, 'Arbeitssätze', 'dumbbell'], [number(totals.volume), 'kg Volumen', 'chart'], [totals.minutes, 'Minuten', 'clock']].map(([value, label, i]) => `<div class="stat-tile">${icon(i)}<strong>${value}</strong><span>${label}</span></div>`).join('')}</div><section class="chart-card"><div class="section-heading"><div><div class="eyebrow">DRANBLEIBEN ZAHLT SICH AUS</div><h2>Deine letzten sechs Wochen</h2></div><span class="muted">Sätze / Woche</span></div>${weeklyBars(sessions)}</section>${!sessions.length ? empty('Dein Fortschritt beginnt hier.', 'Schließe dein erstes Training ab. Deine echten Werte erscheinen dann automatisch.', 'Zum Trainingsplan', 'plan') : `<div class="insight-note">${icon('info')}<p>Volumen = Gewicht × Wiederholungen abgeschlossener Sätze. Bei Körpergewichtsübungen zählt nur das eingetragene Zusatzgewicht.</p></div>`}` : exerciseStats(sessions)}`;
}
function weeklyBars(sessions) {
  const monday = weekStart();
  const weeks = Array.from({ length: 6 }, (_, i) => { const start = new Date(monday); start.setDate(start.getDate() - (5 - i) * 7); const dates = weekDays(start).map(localDate); return { start, sets: sessions.filter(s => dates.includes(s.date)).reduce((n, s) => n + summary(s).sets, 0) }; });
  const max = Math.max(10, ...weeks.map(w => w.sets));
  return `<div class="bar-chart" role="img" aria-label="Sätze pro Woche: ${weeks.map(w => `${dateLabel(w.start)}: ${w.sets}`).join('; ')}">${weeks.map((w, i) => `<div class="bar-column"><span>${w.sets}</span><div class="bar-track"><div class="bar ${i === 5 ? 'current' : ''}" style="height:${Math.max(2, w.sets / max * 100)}%"></div></div><small>${dateLabel(w.start, { month: '2-digit' })}</small></div>`).join('')}</div>`;
}
function exerciseStats(sessions) {
  const ex = exercises.find(e => e.id === exerciseId), available = ex.bodyweight ? [['reps', 'Wiederholungen'], ['weight', 'Zusatzgewicht'], ['volume', 'Volumen']] : [['weight', 'Max. Gewicht'], ['e1rm', 'Geschätztes 1RM'], ['volume', 'Volumen'], ['reps', 'Wiederholungen']];
  if (!available.some(([m]) => m === metric)) metric = available[0][0];
  const points = exerciseSeries(sessions, exerciseId, metric), last = points.at(-1), first = points[0], delta = points.length > 1 && first.value > 0 ? (last.value / first.value - 1) * 100 : null;
  return `<section class="chart-card exercise-chart"><label class="eyebrow" for="exercise-select">ÜBUNG AUSWÄHLEN</label><select id="exercise-select">${exercises.map(e => `<option value="${e.id}" ${e.id === exerciseId ? 'selected' : ''}>${e.name}</option>`).join('')}</select><p class="muted">${esc(ex.muscle)}</p><div class="big-stat">${last ? number(last.value) : '—'} <span>${metric === 'reps' ? 'Wdh.' : 'kg'}</span>${delta !== null ? `<small class="${delta >= 0 ? 'positive' : ''}">${delta >= 0 ? '↗' : '↘'} ${number(Math.abs(delta))} %</small>` : ''}</div><div class="metric-switch">${available.map(([m, label]) => `<button data-action="metric" data-metric="${m}" class="${m === metric ? 'selected' : ''}">${label}</button>`).join('')}</div>${points.length ? lineChart(points) : `<div class="chart-empty">${icon('chart')}<h3>Noch keine Werte.</h3><p>${metric === 'e1rm' ? 'Für die Schätzung werden Sätze mit 1–12 Wiederholungen und Gewicht benötigt.' : 'Nach deinem ersten abgeschlossenen Training siehst du hier deine Entwicklung.'}</p></div>`}<p class="chart-caption">${metric === 'e1rm' ? 'Schätzung nach Epley (1–12 Wdh.), kein getestetes Maximalgewicht.' : 'Jeder Punkt entspricht einer abgeschlossenen Trainingseinheit.'}</p></section>`;
}
function lineChart(points) {
  const min = Math.max(0, Math.min(...points.map(p => p.value)) * 0.9), max = Math.max(min + 1, ...points.map(p => p.value)) * 1.05;
  const timeMin = Date.parse(points[0].timestamp), timeRange = Date.parse(points.at(-1).timestamp) - timeMin;
  const coords = points.map(p => [timeRange ? 35 + (Date.parse(p.timestamp) - timeMin) / timeRange * 670 : 370, 240 - (p.value - min) / (max - min) * 205]);
  return `<div class="line-chart"><svg viewBox="0 0 760 285" role="img" aria-label="Trainingsverlauf: ${points.map(p => `${dateLabel(p.date)}: ${number(p.value)}`).join('; ')}">${[0, 1, 2, 3].map(i => `<line x1="25" x2="710" y1="${35 + i * 68}" y2="${35 + i * 68}" class="chart-grid"/><text x="720" y="${39 + i * 68}">${number(max - i / 3 * (max - min))}</text>`).join('')}<polyline points="${coords.map(p => p.join(',')).join(' ')}" class="chart-line"/>${coords.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" class="chart-point"><title>${dateLabel(points[i].date)} · ${number(points[i].value)}</title></circle>`).join('')}</svg><div class="chart-axis"><span>${dateLabel(points[0].date)}</span><span>${dateLabel(points.at(-1).date)}</span></div></div>`;
}
function empty(title, text, button, target) { return `<div class="empty-state"><div class="empty-icon">${icon('dumbbell')}</div><h2>${title}</h2><p>${text}</p>${button ? `<button class="primary-button" data-action="nav" data-view="${target}">${button} ${icon('arrow')}</button>` : ''}</div>`; }
function historyView() {
  const sessions = [...state.sessions].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  return `${features.historyTools()}<div class="intro-line"><p>Deine Arbeit. Schwarz auf weiß.</p><span class="subtle-badge">${sessions.length} EINHEITEN</span></div>${sessions.length ? `<div class="history-list">${sessions.map(s => { const w = snapshot(s), v = summary(s); return `<button class="history-card" data-action="session" data-id="${s.id}"><div class="history-date"><strong>${new Date(s.date + 'T12:00:00').getDate()}</strong><span>${dateLabel(s.date, { day: undefined, month: 'short' })}</span></div><div class="history-title"><h3>${esc(w.name)}</h3><p>${v.sets} Sätze <span>·</span> ${number(v.volume)} kg <span>·</span> ${v.minutes} min</p></div><span class="history-check">${icon('check')}</span>${icon('arrow')}</button>`; }).join('')}</div>` : empty('Noch ein unbeschriebenes Blatt.', 'Deine abgeschlossenen Trainings werden hier gesammelt.', 'Erstes Training starten', 'home')}`;
}
function settingsView() {
  return `${features.syncView()}<div class="settings-grid"><section class="settings-card"><div class="eyebrow">PERSÖNLICH</div><h2>Dein Profil</h2><label for="profile-name">Wie dürfen wir dich nennen?</label><input id="profile-name" type="text" autocomplete="given-name" maxlength="40" placeholder="Dein Vorname" value="${esc(state.preferences.name)}"><label for="theme-select">Darstellung</label><select id="theme-select">${[['light', 'Hell'], ['dark', 'Dunkel'], ['system', 'Wie dein Gerät']].map(([v, l]) => `<option value="${v}" ${v === state.preferences.theme ? 'selected' : ''}>${l}</option>`).join('')}</select><label for="rest-select">Standard-Pausentimer</label><select id="rest-select">${[60, 90, 120, 180, 240, 300].map(v => `<option value="${v}" ${v === state.preferences.restSeconds ? 'selected' : ''}>${v / 60} Minuten</option>`).join('')}</select><button class="primary-button" data-action="save-settings">Einstellungen speichern ${icon('check')}</button></section>
  <section class="settings-card"><div class="eyebrow">DEINE DATEN BLEIBEN BEI DIR</div><h2>Sichern & übertragen</h2><p>Deine Trainings werden in diesem Browser auf diesem Gerät gespeichert. Sichere sie regelmäßig als Datei. Aktiviere die Synchronisierung oben, um deine Daten zwischen Geräten zu übertragen.</p><button class="secondary-button full-width" data-action="export">${icon('download')} Daten exportieren</button><button class="secondary-button full-width" data-action="import">${icon('plus')} Sicherung importieren</button><input id="import-file" type="file" accept="application/json,.json" hidden><div class="settings-divider"></div><h3>Auf deinem Startbildschirm</h3><p>Öffne die App auf dem iPhone in Safari. Tippe auf „Teilen“ und dann „Zum Home-Bildschirm“. Nach dem ersten vollständigen Laden kann die App bei erfolgreicher Offline-Einrichtung auch ohne Netz geöffnet werden.</p><span class="offline-state" id="offline-status">Offline-Einrichtung wird geprüft …</span></section></div>`;
}
function openDialog(content, label = 'Details') {
  dialogReturnFocus = document.activeElement;
  const dialog = $('#dialog'); dialog.setAttribute('aria-label', label);
  dialog.innerHTML = `<button class="dialog-close icon-button" data-action="close" aria-label="Schließen">${icon('close')}</button><div class="dialog-content">${content}</div>`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { $('#dialog').close(); dialogReturnFocus?.isConnected && dialogReturnFocus.focus(); }
function startWorkout(id) {
  const w = features.findWorkout(id); if (!w) return;
  if (state.active && state.active.workoutId !== id) {
    openDialog(`<h2>Ein Training läuft bereits.</h2><p>Setze deine aktive Einheit fort oder verwirf sie dort, bevor du ein neues Training beginnst.</p><button class="primary-button full-width" data-action="resume">Training fortsetzen ${icon('arrow')}</button>`); return;
  }
  if (!state.active) { state.active = createSession(w, new Date(), state.preferences.restSeconds); persist(); }
  closeDialog(); view = 'workout'; render(); window.scrollTo(0, 0);
}
function exerciseDetails(id) {
  const ex = (state.active && view === 'workout' ? snapshot(state.active).exercises : plan.flatMap(w=>w.exercises)).find(e => e.id === id) || exercises.find(e=>e.id===id); if (!ex) return;
  openDialog(`<div class="exercise-detail-art">${icon('dumbbell')}<span>${esc(ex.muscle)}</span></div><div class="eyebrow">ÜBUNGSDETAILS</div><h2>${esc(ex.name)}</h2><div class="detail-tags"><span>${ex.setCount??2} Arbeitssätze</span><span>${esc(ex.target)} Wdh.</span></div><h3>Hinweis aus deiner Vorlage</h3><p>${esc(ex.note || 'Keine weiteren Hinweise hinterlegt.')}</p><div class="plan-note"><div><strong>Intensität</strong><p>${esc(ex.rir || 'Satz 1: RIR 0–1 · Satz 2: RIR 2–3')}</p><small>RIR = mögliche Wiederholungen, die noch übrig wären.</small></div></div>${ex.bodyweight ? '<p class="muted">Bei dieser Übung erfasst du unter kg dein Zusatzgewicht. Ohne Zusatzgewicht trägst du 0 ein.</p>' : ''}`);
}
function requestFinish() {
  const active = state.active; if (!active) return;
  const v = summary(active), total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
  if (!v.sets) { toast('Schließe mindestens einen Satz ab, bevor du das Training speicherst.'); return; }
  openDialog(`<div class="eyebrow">DEINE EINHEIT</div><h2>Für heute geschafft?</h2><p>${v.sets} von ${total} Sätzen abgeschlossen. Nur abgehakte Sätze zählen in deinen Statistiken.</p><div class="finish-stats"><div><strong>${v.sets}</strong><span>Sätze</span></div><div><strong>${number(v.volume)}</strong><span>kg Volumen</span></div><div><strong>${v.minutes}</strong><span>Minuten</span></div></div><button class="primary-button full-width" data-action="save-workout">Training speichern ${icon('check')}</button><button class="text-button full-width" data-action="close">Weitertrainieren</button>`);
}
function saveWorkout() {
  if (!state.active || !summary(state.active).sets) return;
  const session = { ...state.active, finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), restUntil: null };
  const next = { ...state, sessions: [...state.sessions, session], active: null };
  try { saveState(next); } catch { toast('Training konnte nicht gespeichert werden. Bitte sichere es über den Datenexport.'); return; }
  state = next; sync?.schedule(); view = 'home'; selected = new Date(); render(); sessionDetails(session.id, true);
}
function sessionDetails(id, congratulations = false) {
  const s = state.sessions.find(s => s.id === id); if (!s) return;
  const w = snapshot(s), v = summary(s);
  const muscles = [...new Set(w.exercises.filter(e => s.exercises.find(x => x.id === e.id)?.sets.some(set => set.done)).map(e => e.muscle))];
  openDialog(`${congratulations ? `<div class="congrats-mark">${icon('check')}</div><div class="eyebrow">EIN STÜCK WEITER.</div><h2>Stark gemacht.</h2>` : `<div class="eyebrow">${dateLabel(s.date, { year: 'numeric' })}</div><h2>${esc(w.name)}</h2>`}<p class="summary-sentence">Du hast <strong>${v.sets} Sätze</strong> mit <strong>${number(v.volume)} kg</strong> erfasstem Volumen in <strong>${v.minutes} Minuten</strong> absolviert.</p>${features.comparison(s)}<div class="detail-tags">${muscles.map(m => `<span>${esc(m)}</span>`).join('')}</div><div class="completed-exercises">${s.exercises.filter(e => e.sets.some(set => set.done)).map(ex => `<div><strong>${esc(w.exercises.find(e => e.id === ex.id).name)}</strong><p>${ex.sets.filter(set => set.done).map(set => `${set.reps} × ${number(set.kg)} kg`).join(' · ')}</p>${ex.note ? `<small>${esc(ex.note)}</small>` : ''}</div>`).join('')}</div><button class="secondary-button full-width" data-action="edit-session" data-id="${id}">Training bearbeiten</button><button class="primary-button full-width" data-action="close">Fertig ${icon('check')}</button>${!congratulations ? `<button class="text-button danger full-width" data-action="delete-session" data-id="${id}">Einheit löschen</button>` : ''}`, congratulations ? 'Trainingsabschluss' : 'Trainingsdetails');
}
function download(name, contents, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function setWorkoutRest(seconds) {
  if (!state.active) return;
  state.active.restSeconds = seconds;
  state.active.restOverride = true;
  if (state.active.restUntil) state.active.restUntil = Date.now() + seconds * 1000;
  persist(); render(); toast('Pausendauer für diese Einheit angepasst.');
}
function updateTimers() {
  const elapsed = state.active ? Math.max(0, Math.floor((Date.now() - Date.parse(state.active.startedAt)) / 1000)) : 0;
  document.querySelectorAll('[data-elapsed]').forEach(el => el.textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`);
  const until = state.active?.restUntil, remaining = until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : currentRest();
  document.querySelectorAll('[data-rest]').forEach(el => el.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`);
  document.querySelectorAll('[data-timer-button]').forEach(el => el.textContent = until ? 'Pause beenden' : 'Timer starten');
  document.querySelectorAll('[data-rest-label]').forEach(el => el.textContent = until ? 'Deine Pause läuft.' : 'Ein Moment zum Durchatmen.');
  if (until && remaining === 0) { state.active.restUntil = null; persist(); toast('Deine Pause ist vorbei. Bereit für den nächsten Satz?'); updateTimers(); }
  if ($('#offline-status')) $('#offline-status').textContent = offlineStatus;
}
let offlineStatus = 'Offline-Einrichtung wird geprüft …';
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  event.preventDefault(); const action = button.dataset.action, id = button.dataset.id, exId = button.dataset.ex, index = Number(button.dataset.set);
  const exercise = state.active?.exercises.find(e => e.id === exId);
  if (await features.handle(action, button)) return;
  switch (action) {
    case 'nav': view = button.dataset.view; if ($('#dialog').open) closeDialog(); render(); window.scrollTo(0, 0); break;
    case 'theme': state.preferences.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; persist(); render(); break;
    case 'week': selected.setDate(selected.getDate() + Number(button.dataset.offset)); render(); break;
    case 'day': selected = new Date(button.dataset.date + 'T12:00:00'); render(); break;
    case 'preview': previewWorkout(id); break;
    case 'exercise': exerciseDetails(id); break;
    case 'start': startWorkout(id); break;
    case 'resume': closeDialog(); view = 'workout'; render(); window.scrollTo(0, 0); break;
    case 'close': closeDialog(); break;
    case 'check': {
      const set = exercise?.sets[index]; if (!set) return;
      if (!set.done && !validSet(set)) { toast('Bitte gültige Wiederholungen und kg eintragen. Ohne Zusatzgewicht: 0 kg.'); const row = button.closest('.set-row'); row.querySelector(set.reps === '' || Number(set.reps) <= 0 ? '[data-field="reps"]' : '[data-field="kg"]').focus(); return; }
      const y = window.scrollY; set.done = !set.done;
      if (set.done) state.active.restUntil = Date.now() + (state.active.restOverride ? currentRest() : (snapshot(state.active).exercises.find(e=>e.id===exId).restSeconds || currentRest())) * 1000;
      persist(); render(); window.scrollTo(0, y);
      document.querySelector(`[data-action="check"][data-ex="${exId}"][data-set="${index}"]`)?.focus({ preventScroll: true }); break;
    }
    case 'add-set': if (!exercise || exercise.sets.length >= 30) { toast('Maximal 30 Sätze pro Übung.'); break; } exercise.sets.push({ reps: '', kg: exercises.find(e => e.id === exId).bodyweight ? 0 : '', done: false }); persist(); render(); break;
    case 'remove-set': if (exercise?.sets.length > 2 && !exercise.sets.at(-1).done) { exercise.sets.pop(); persist(); render(); } break;
    case 'load-previous': { const previous = previousSets(state.sessions, exId); exercise.sets.forEach((s, i) => { if (!s.done && previous[i]) { s.reps = previous[i].reps; s.kg = previous[i].kg; } }); persist(); render(); toast('Vorwerte geladen. Bitte an deine heutige Leistung anpassen.'); break; }
    case 'rest': setWorkoutRest(Number(button.dataset.seconds)); break;
    case 'edit-rest': {
      const seconds = currentRest();
      openDialog(`<div class="eyebrow">NUR FÜR DIESE EINHEIT</div><h2>Deine Pausendauer</h2><p>Die Standardpause in deinen Einstellungen bleibt unverändert. Eine laufende Pause startet mit der gewählten Dauer neu.</p><div class="rest-inputs"><label>Minuten<input id="pause-minutes" type="number" inputmode="numeric" min="0" max="30" step="1" value="${Math.floor(seconds / 60)}"></label><label>Sekunden<input id="pause-seconds" type="number" inputmode="numeric" min="0" max="59" step="1" value="${seconds % 60}"></label></div><p class="muted">1 Sekunde bis 30 Minuten. Gilt für die nächsten Pausen dieser Einheit.</p><button class="primary-button full-width" data-action="apply-rest">Pausendauer übernehmen</button><button class="text-button full-width" data-action="reset-rest">Standardpause verwenden</button>`); break;
    }
    case 'apply-rest': {
      const minutes = $('#pause-minutes'), seconds = $('#pause-seconds');
      const m = Number(minutes.value), s = Number(seconds.value), total = m * 60 + s;
      if (minutes.value === '' || seconds.value === '' || !Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59 || total < 1 || total > 1800) { toast('Bitte eine gültige Pause von 1 Sekunde bis 30 Minuten eintragen.'); minutes.focus(); break; }
      closeDialog(); setWorkoutRest(total); break;
    }
    case 'reset-rest': closeDialog(); setWorkoutRest(state.preferences.restSeconds); break;
    case 'timer': if (!state.active) return; state.active.restUntil = state.active.restUntil ? null : Date.now() + currentRest() * 1000; persist(); updateTimers(); break;
    case 'finish': requestFinish(); break;
    case 'save-workout': saveWorkout(); break;
    case 'discard': openDialog('<h2>Training verwerfen?</h2><p>Die Werte dieser laufenden Einheit werden gelöscht. Bereits gespeicherte Trainings bleiben erhalten.</p><button class="primary-button full-width" data-action="confirm-discard">Training verwerfen</button><button class="text-button full-width" data-action="close">Weitertrainieren</button>'); break;
    case 'confirm-discard': state.active = null; persist(); closeDialog(); view = 'home'; render(); break;
    case 'stats-tab': statsTab = button.dataset.tab; render(); break;
    case 'period': period = button.dataset.period; render(); break;
    case 'metric': metric = button.dataset.metric; render(); break;
    case 'session': sessionDetails(id); break;
    case 'delete-session': openDialog(`<h2>Einheit löschen?</h2><p>Diese Einheit wird aus deinem Verlauf und deinen Statistiken entfernt.</p><button class="primary-button full-width" data-action="confirm-delete" data-id="${esc(id)}">Einheit löschen</button><button class="text-button full-width" data-action="session" data-id="${esc(id)}">Zurück</button>`); break;
    case 'confirm-delete': state.deleted[id] = new Date().toISOString(); state.sessions = state.sessions.filter(s => s.id !== id); persist(); closeDialog(); render(); toast('Einheit gelöscht.'); break;
    case 'save-settings': state.prefsUpdatedAt = new Date().toISOString(); state.preferences = { name: $('#profile-name').value.trim(), theme: $('#theme-select').value, restSeconds: Number($('#rest-select').value) }; if (persist()) toast('Einstellungen gespeichert.'); render(); break;
    case 'export': download(`team-progress-${localDate()}.json`, exportState(state)); toast('Sicherungsdatei erstellt.'); break;
    case 'import': $('#import-file').click(); break;
    case 'confirm-import': if(pendingImport){ state=mergeStates(state,pendingImport); pendingImport=null; storageError=false; persist(); closeDialog(); render(); toast('Sicherung mit deinen Daten zusammengeführt.'); } break;
  }
});
let pendingImport = null;
document.addEventListener('input', event => {
  const el = event.target;
  if(el.dataset.warmupKg){const ex=state.active.exercises.find(x=>x.id===el.dataset.warmupKg);ex.warmupKg=el.value;}

  features.input(el);
  if (el.dataset.field && state.active) { const set = state.active.exercises.find(e => e.id === el.dataset.ex)?.sets[Number(el.dataset.set)]; if (set && !set.done) { set[el.dataset.field] = el.value; persist(); if(el.dataset.field==='reps' && el.value!==''){const warm=el.closest('.exercise-card')?.querySelector('.warmup');if(warm)warm.open=false;} } }
  if (el.dataset.note && state.active) { state.active.exercises.find(e => e.id === el.dataset.note).note = el.value; persist(); }
});
document.addEventListener('change', async event => {
  if(event.target.dataset.warmupKg || event.target.dataset.field==='kg') features.refreshWarmup(event.target);
  features.change(event.target);
  if (event.target.id === 'exercise-select') { exerciseId = event.target.value; render(); }
  if (event.target.id === 'import-file') {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 10 * 1024 * 1024) throw new Error('Die Datei ist zu groß (max. 10 MB).'); pendingImport = validateBackup(JSON.parse(await file.text())); openDialog(`<h2>Sicherung importieren?</h2><p>${pendingImport.sessions.length} gespeicherte Einheiten gefunden. Neue Einheiten werden ergänzt; bestehende Einheiten und das laufende Training bleiben erhalten. Name, Darstellung und Standardpause werden aus der Sicherung übernommen. Eigene Pläne, Kalender und Aktivitäten werden ebenfalls zusammengeführt. Ein laufendes Training aus der Datei wird nicht importiert.</p><button class="primary-button full-width" data-action="confirm-import">Importieren ${icon('check')}</button><button class="text-button full-width" data-action="close">Abbrechen</button>`); } catch (e) { toast(e instanceof SyntaxError ? 'Diese Datei enthält kein gültiges JSON.' : e.message); } finally { event.target.value = ''; }
  }
});
$('#dialog').addEventListener('click', e => { if (e.target === $('#dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.preferences.theme === 'system') render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateTimers(); });
window.addEventListener('online', () => toast('Du bist wieder online.'));
window.addEventListener('offline', () => toast('Offline. Du kannst dein geladenes Training weiter erfassen.'));
features = createFeatures({ getState:()=>state, setState:s=>{state=s;}, getExercises:()=>exercises, getPlan:()=>plan, persist, render, openDialog, closeDialog, toast, esc, icon, number, dateLabel, routineCard, startWorkout, getSelected:()=>selected, setSelected:d=>{selected=d;}, getSync:()=>sync });
sync=createSync({ getState:()=>state, setState:s=>{state=s;refreshCatalog();}, save:saveState, render, isBusy:()=>view==='workout'||$('#dialog').open, onStatus:()=>{const el=$('#sync-status');if(el)el.textContent=sync.status();} });
render();
sync.start();
setInterval(updateTimers, 1000);
if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
  navigator.serviceWorker.register('./sw.js').then(async registration => {
    const check = () => { if (registration.active) { offlineStatus = '✓ Offline-Einrichtung abgeschlossen'; updateTimers(); } };
    check(); const worker = registration.installing;
    if (worker) worker.addEventListener('statechange', () => {
      check();
      if (worker.state === 'activated') offlineStatus = '✓ Offline-Einrichtung abgeschlossen';
      if (worker.state === 'redundant') offlineStatus = 'Offline-Einrichtung nicht verfügbar. Bitte online verwenden.';
      updateTimers();
    });
  }).catch(() => { offlineStatus = 'Offline-Einrichtung nicht verfügbar. Bitte online verwenden.'; updateTimers(); });
} else offlineStatus = 'Offline-Start in diesem Browser nicht verfügbar.';
