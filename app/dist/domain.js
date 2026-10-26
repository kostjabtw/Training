import { plan } from './plan.js';

export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function weekStart(date = new Date()) {
  const day = new Date(date); day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() - (day.getDay() + 6) % 7); return day;
}
export function weekDays(date) {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
}
export function validSet(set) {
  return set.reps !== '' && set.kg !== '' && Number.isInteger(Number(set.reps)) && Number(set.reps) > 0 && Number(set.reps) <= 1000 && Number.isFinite(Number(set.kg)) && Number(set.kg) >= 0 && Number(set.kg) <= 2000;
}
export function createSession(workout, now = new Date(), restSeconds = 120) {
  return {
    id: globalThis.crypto.randomUUID(), workoutId: workout.id, workout: structuredClone(workout), startedAt: now.toISOString(), date: localDate(now), restUntil: null, restSeconds,
    exercises: workout.exercises.map(ex => ({ id: ex.id, note: '', sets: Array.from({ length: ex.setCount ?? 2 }, () => ({ reps: '', kg: ex.bodyweight ? 0 : '', done: false })) }))
  };
}
export function completedSets(session) { return session.exercises.flatMap(ex => ex.sets.filter(s => s.done && validSet(s))); }
export function summary(session) {
  const sets = completedSets(session);
  return { sets: sets.length, reps: sets.reduce((n, s) => n + Number(s.reps), 0), volume: sets.reduce((n, s) => n + Number(s.reps) * Number(s.kg), 0), minutes: Math.max(1, Math.round(((session.finishedAt ? Date.parse(session.finishedAt) : Date.now()) - Date.parse(session.startedAt)) / 60000)) };
}
export function previousSets(sessions, exerciseId) {
  const matches = [...sessions].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  for (const session of matches) {
    const sets = session.exercises.find(ex => ex.id === exerciseId)?.sets.filter(s => s.done && validSet(s));
    if (sets?.length) return sets;
  }
  return [];
}
export function exerciseSeries(sessions, exerciseId, metric = 'weight') {
  return [...sessions].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt)).flatMap(session => {
    const sets = session.exercises.find(ex => ex.id === exerciseId)?.sets.filter(s => s.done && validSet(s));
    if (!sets?.length) return [];
    let value;
    if (metric === 'volume') value = sets.reduce((n, s) => n + Number(s.reps) * Number(s.kg), 0);
    else if (metric === 'reps') value = sets.reduce((n, s) => n + Number(s.reps), 0);
    else if (metric === 'e1rm') {
      const eligible = sets.filter(s => Number(s.kg) > 0 && Number(s.reps) <= 12);
      if (!eligible.length) return [];
      value = Math.max(...eligible.map(s => Number(s.reps) === 1 ? Number(s.kg) : Number(s.kg) * (1 + Number(s.reps) / 30)));
    } else value = Math.max(...sets.map(s => Number(s.kg)));
    return [{ date: session.date, timestamp: session.finishedAt, value }];
  });
}

export const initialPlans = () => [{ id: 'base-v11', name: 'Mein V11-Plan', updatedAt: '1970-01-01T00:00:00.000Z', workouts: structuredClone(plan) }];
export const snapshot = s => s.workout || plan.find(w => w.id === s.workoutId);
export function workoutComparison(session, sessions) {
  const previous = sessions.filter(s => s.id !== session.id && s.workoutId === session.workoutId && Date.parse(s.finishedAt) < Date.parse(session.finishedAt || session.startedAt)).sort((a,b) => Date.parse(b.finishedAt)-Date.parse(a.finishedAt))[0];
  if (!previous) return null;
  const before = summary(previous), after = summary(session);
  return { previous, sets: after.sets - before.sets, reps: after.reps - before.reps, volume: after.volume - before.volume };
}
export function records(sessions, exercise) {
  const sets = sessions.flatMap(s => s.exercises.filter(e => e.id === exercise.id).flatMap(e => e.sets.filter(v => v.done && validSet(v)).map(v => ({ ...v, date: s.date }))));
  if (!sets.length) return null;
  return { weight: Math.max(...sets.map(s => Number(s.kg))), reps: Math.max(...sets.map(s => Number(s.reps))), volume: Math.max(...sessions.map(s => s.exercises.filter(e => e.id === exercise.id).flatMap(e => e.sets.filter(v => v.done && validSet(v))).reduce((n,v) => n + Number(v.kg)*Number(v.reps),0))) };
}
export function warmupSets(kg) {
  if (!Number.isFinite(Number(kg)) || Number(kg) <= 0) return [];
  return [{ kg: Math.round(Number(kg)*0.5/2.5)*2.5, reps: '5–6' }, { kg: Math.round(Number(kg)*0.9/2.5)*2.5, reps: '2–3' }];
}
export function validateBackup(data) {
  const fail = () => { throw new Error('Die Datei ist kein gültiges Team-Progress-Backup.'); };
  const text = (v, max=100) => typeof v === 'string' && v.length <= max;
  const id = v => text(v) && /^[a-z0-9][a-z0-9-]{0,99}$/i.test(v);
  const date = x => text(x) && Number.isFinite(Date.parse(x));
  const day = x => text(x) && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && localDate(new Date(x+'T12:00:00')) === x;
  const array = (v, max=10000) => Array.isArray(v) && v.length <= max;
  const unique = v => new Set(v.map(x=>x.id)).size === v.length;
  if (!data || ![1,2].includes(data.version) || !array(data.sessions)) fail();
  function workout(w) {
    if (!w || !id(w.id) || !text(w.name) || !w.name.trim() || !Number.isInteger(w.day) || w.day<0 || w.day>6 || !array(w.exercises,40) || !w.exercises.length || !unique(w.exercises)) fail();
    return { id:w.id, name:w.name, day:w.day, letter:text(w.letter,10)?w.letter:'', exercises:w.exercises.map(e=> {
      if(!id(e.id)||!text(e.name)||!e.name.trim()||!text(e.muscle)||!text(e.target)||typeof e.bodyweight !== 'boolean'||!text(e.note,3000)) fail();
      if(e.setCount!==undefined && (!Number.isInteger(e.setCount)||e.setCount<1||e.setCount>30)) fail();
      if(e.restSeconds!=null && (!Number.isInteger(e.restSeconds)||e.restSeconds<1||e.restSeconds>1800)) fail();
      return {id:e.id,name:e.name,muscle:e.muscle,target:e.target,bodyweight:e.bodyweight,note:e.note,setCount:e.setCount??2,restSeconds:e.restSeconds??null,rir:text(e.rir)?e.rir:'Satz 1: 0–1 · Satz 2: 2–3'};
    }) };
  }
  const plans = data.version===1 ? initialPlans() : data.plans;
  if(!array(plans,100)||!plans.length||!unique(plans)) fail();
  const cleanPlans=plans.map(p=>{if(!id(p.id)||!text(p.name)||!p.name.trim()||!date(p.updatedAt)||!array(p.workouts,7)||!p.workouts.length||!unique(p.workouts))fail();return{id:p.id,name:p.name,updatedAt:p.updatedAt,workouts:p.workouts.map(workout)};});
  const validateSession = (s, active=false) => {
    const w = workout(s?.workout || plan.find(w=>w.id===s?.workoutId));
    if(!id(s.id)||s.workoutId!==w.id||!date(s.startedAt)||!day(s.date)||(!active&&(!date(s.finishedAt)||Date.parse(s.finishedAt)<Date.parse(s.startedAt)))||!array(s.exercises,40)||s.exercises.length!==w.exercises.length||!unique(s.exercises))fail();
    const exercises=s.exercises.map(e=>{
      if(!w.exercises.some(x=>x.id===e.id)||!text(e.note,3000)||!array(e.sets,30)||!e.sets.length)fail();
      const sets=e.sets.map(v=>{
        if(!v||typeof v.done!=='boolean'||!['string','number'].includes(typeof v.reps)||!['string','number'].includes(typeof v.kg))fail();
        if(v.done?!validSet(v):!((v.reps===''||(Number.isInteger(Number(v.reps))&&Number(v.reps)>=0&&Number(v.reps)<=1000))&&(v.kg===''||(Number.isFinite(Number(v.kg))&&Number(v.kg)>=0&&Number(v.kg)<=2000))))fail();
        return {reps:v.reps,kg:v.kg,done:v.done};
      });return{id:e.id,note:e.note,sets,...(e.warmupKg!==undefined && Number.isFinite(Number(e.warmupKg)) && Number(e.warmupKg)>=0 && Number(e.warmupKg)<=2000?{warmupKg:e.warmupKg}:{})};
    });
    return {id:s.id,workoutId:w.id,workout:w,startedAt:s.startedAt,date:s.date,updatedAt:date(s.updatedAt)?s.updatedAt:(s.finishedAt||s.startedAt),...(active?{restOverride:s.restOverride===true,restSeconds:Number.isInteger(s.restSeconds)&&s.restSeconds>=1&&s.restSeconds<=1800?s.restSeconds:undefined,restUntil:Number.isFinite(s.restUntil)&&s.restUntil>0?s.restUntil:null,warmups:array(s.warmups,100)?s.warmups.filter(v=>text(v)):[]}:{finishedAt:s.finishedAt}),exercises};
  };
  const sessions=data.sessions.map(s=>validateSession(s));if(!unique(sessions))fail();
  const schedule=(data.schedule||[]);if(!array(schedule)||!unique(schedule))fail();
  const cleanSchedule=schedule.map(s=>{if(!id(s.id)||!day(s.date)||!date(s.updatedAt))fail();return{id:s.id,date:s.date,updatedAt:s.updatedAt,workout:s.workout?workout(s.workout):null};});
  const activities=data.activities||[];if(!array(activities)||!unique(activities))fail();
  const cleanActivities=activities.map(a=>{if(!id(a.id)||!day(a.date)||!date(a.updatedAt)||!['run','mobility'].includes(a.type)||!text(a.name)||!text(a.note,3000)||!Number.isFinite(a.minutes)||a.minutes<=0||a.minutes>1440||!Number.isFinite(a.km)||a.km<0||a.km>500||!text(a.zone))fail();return{id:a.id,date:a.date,updatedAt:a.updatedAt,type:a.type,name:a.name,note:a.note,minutes:a.minutes,km:a.km,zone:a.zone};});
  const deleted={};if(data.deleted && (typeof data.deleted!=='object'||Array.isArray(data.deleted)))fail();
  for(const [key,value] of Object.entries(data.deleted||{})){if(!id(key)||!date(value))fail();deleted[key]=value;}
  const habits=data.habits||[], habitEntries=data.habitEntries||[];
  if(!array(habits,200)||!unique(habits)||!array(habitEntries,50000)||!unique(habitEntries))fail();
  const cleanHabits=habits.map(h=>{
    if(!id(h.id)||!text(h.name,60)||!h.name.trim()||!text(h.description,500)||!/^#[0-9a-f]{6}$/i.test(h.color)||!text(h.icon,30)||!['build','quit'].includes(h.kind)||!['boolean','counter','measure'].includes(h.tracking)||!Number.isFinite(h.target)||h.target<=0||h.target>1000000||!text(h.unit,20)||!text(h.category,40)||!array(h.days,7)||!h.days.length||h.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(h.days).size!==h.days.length||!Number.isInteger(h.streakGoal)||h.streakGoal<0||h.streakGoal>10000||typeof h.archived!=='boolean'||!day(h.createdDate)||!date(h.updatedAt))fail();
    return {id:h.id,name:h.name,description:h.description,color:h.color,icon:h.icon,kind:h.kind,tracking:h.tracking,target:h.target,unit:h.unit,category:h.category,days:h.days,streakGoal:h.streakGoal,archived:h.archived,createdDate:h.createdDate,updatedAt:h.updatedAt};
  });
  const entryKeys=new Set();
  const cleanHabitEntries=habitEntries.map(e=>{const key=e.habitId+'-'+e.date;if(!id(e.id)||e.id!==key||!id(e.habitId)||!day(e.date)||!Number.isFinite(e.value)||e.value<0||e.value>1000000||!text(e.note,2000)||!date(e.updatedAt)||entryKeys.has(key))fail();entryKeys.add(key);return{id:e.id,habitId:e.habitId,date:e.date,value:e.value,note:e.note,updatedAt:e.updatedAt};});
  const preferences=data.preferences||{};
  return {version:2,habits:cleanHabits,habitEntries:cleanHabitEntries,sessions,active:data.active?validateSession(data.active,true):null,plans:cleanPlans,activePlanId:cleanPlans.some(p=>p.id===data.activePlanId)?data.activePlanId:cleanPlans[0].id,schedule:cleanSchedule,activities:cleanActivities,deleted,prefsUpdatedAt:date(data.prefsUpdatedAt)?data.prefsUpdatedAt:(data.version===1?new Date().toISOString():'1970-01-01T00:00:00.000Z'),preferences:{name:text(preferences.name,40)?preferences.name:'',theme:['light','dark','system'].includes(preferences.theme)?preferences.theme:'light',restSeconds:[60,90,120,180,240,300].includes(Number(preferences.restSeconds))?Number(preferences.restSeconds):120}};
}
export function mergeStates(local, remote) {
  const deleted={...local.deleted};
  for(const [id,stamp] of Object.entries(remote.deleted||{})) if(!deleted[id]||stamp>deleted[id]) deleted[id]=stamp;
  const merge=key=>{
    const records=new Map();
    for(const item of [...(local[key]||[]),...(remote[key]||[])]){
      const stamp=item.updatedAt||item.finishedAt;
      if(deleted[item.id] && deleted[item.id]>=stamp)continue;
      if(!records.has(item.id)||stamp>=(records.get(item.id).updatedAt||records.get(item.id).finishedAt))records.set(item.id,item);
    }return [...records.values()];
  };
  const prefs=(remote.prefsUpdatedAt||'')>(local.prefsUpdatedAt||'')?remote:local;
  const plans=merge('plans');
  return {...local,habits:merge('habits'),habitEntries:merge('habitEntries'),plans:plans.length?plans:initialPlans(),sessions:merge('sessions'),schedule:merge('schedule'),activities:merge('activities'),deleted,preferences:prefs.preferences,prefsUpdatedAt:prefs.prefsUpdatedAt,activePlanId:plans.some(p=>p.id===prefs.activePlanId)?prefs.activePlanId:plans[0]?.id||'base-v11'};
}

export function habitEntry(state,habitId,date){return (state.habitEntries||[]).find(e=>e.habitId===habitId&&e.date===date);}
export function habitDue(h,date){return date>=h.createdDate&&h.days.includes((new Date(date+'T12:00:00').getDay()+6)%7);}
export function habitDone(h,entry){return !!entry&&entry.value>=(h.tracking==='boolean'?1:h.target);}
export function habitStreak(h,entries,today=localDate()){
 const byDate=new Map(entries.filter(e=>e.habitId===h.id).map(e=>[e.date,e]));let count=0;const d=new Date(today+'T12:00:00');
 for(let i=0;i<36500;i++,d.setDate(d.getDate()-1)){const date=localDate(d);if(date<h.createdDate)break;if(!habitDue(h,date))continue;if(habitDone(h,byDate.get(date)))count++;else if(date!==today)break;}
 return count;
}
