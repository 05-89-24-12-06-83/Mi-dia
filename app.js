const $=s=>document.querySelector(s);
const dialog=$('#taskDialog'), alarmDialog=$('#alarmDialog'), form=$('#taskForm'), timeline=$('#timeline'), nextList=$('#nextList');
let tasks=JSON.parse(localStorage.getItem('midia.tasks')||'[]').map(normalizeTask);
let deferredPrompt=null, activeAlarmId=null, alarmTimer=null;

const fmtDate=d=>new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
const fmtShort=d=>new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d);
const isoDate=d=>{const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`};
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const DAY_LABEL={0:'Dom',1:'Lun',2:'Mar',3:'Mié',4:'Jue',5:'Vie',6:'Sáb'};
const MONTH_LABEL=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function normalizeTask(t){
  if(typeof t.repeat==='number') t.repeat=t.repeat===5?'5m':'none';
  return {...t,repeat:t.repeat||'none',weekdays:Array.isArray(t.weekdays)?t.weekdays:[],sound:t.sound!==false,soundType:t.soundType||'soft-bell',volume:Number.isFinite(Number(t.volume))?Number(t.volume):70,vibrate:t.vibrate!==false,vibrationPattern:t.vibrationPattern||'standard',repeatUntil:t.repeatUntil||null};
}
function save(){localStorage.setItem('midia.tasks',JSON.stringify(tasks));render()}
function nextQuarterHour(d){const x=new Date(d);x.setSeconds(0,0);const add=(15-(x.getMinutes()%15))%15||15;x.setMinutes(x.getMinutes()+add);return x}
function maxDate(){const d=new Date();d.setMonth(d.getMonth()+6);return isoDate(d)}
let selectedCalendarDate=new Date();
let selectedRepeatValue='none';
let selectedVibrationValue='standard';

function setDateValue(dateStr){$('#date').value=dateStr;const d=new Date(`${dateStr}T00:00:00`);$('#datePickerValue').textContent=new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(d);selectedCalendarDate=d}
function setTimeValue(timeStr){$('#time').value=timeStr;$('#timePickerValue').textContent=timeStr}
function setRepeatValue(value){$('#repeat').value=value;selectedRepeatValue=value;const text={none:'Solo una vez','5m':'Cada 5 minutos',daily:'Diario',weekdays:'Días específicos de la semana'}[value]||'Solo una vez';$('#repeatPickerValue').textContent=text;syncWeekdayPicker()}
function setVibrationValue(value){$('#vibrationPattern').value=value;selectedVibrationValue=value;const text={standard:'Estándar',short:'Corta',double:'Doble',triple:'Triple',long:'Larga'}[value]||'Estándar';$('#vibrationPickerValue').textContent=text}
function openNew(){const now=nextQuarterHour(new Date());form.reset();$('#alarm').checked=true;$('#sound').checked=true;$('#vibrate').checked=true;$('#soundType').value='soft-bell';$('#volume').value='70';$('#volumeValue').textContent='70%';setVibrationValue('standard');setRepeatValue('none');setStepValue('15');syncAlarmOptions();$('#date').min=isoDate(new Date());$('#date').max=maxDate();setDateValue(isoDate(now));setTimeValue(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);$('#soundPickerValue').textContent=soundName('soft-bell');dialog.showModal();$('#title').focus()}
$('#date').min=isoDate(new Date());$('#date').max=maxDate();
$('#newBtn').onclick=openNew;$('#goNew').onclick=openNew;$('#closeDialog').onclick=()=>dialog.close();$('#cancelBtn').onclick=()=>dialog.close();
$('#step').onchange=e=>{if(e.target.value==='15'&&$('#time').value){let [h,m]=$('#time').value.split(':').map(Number);let total=h*60+m;total=Math.round(total/15)*15;if(total>=1440)total=1425;h=Math.floor(total/60);m=total%60;setTimeValue(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)}};
function syncWeekdayPicker(){const on=$('#repeat').value==='weekdays';$('#weekdayPicker').hidden=!on}
$('#repeat').onchange=syncWeekdayPicker;

form.addEventListener('submit',e=>{
  e.preventDefault();
  const when=new Date(`${$('#date').value}T${$('#time').value}:00`), now=new Date(), limit=new Date();limit.setMonth(limit.getMonth()+6);
  if(when<now){alert('Selecciona una fecha y hora futura.');return}
  if(when>limit){alert('El recordatorio debe estar dentro de los próximos 6 meses.');return}
  const repeat=$('#repeat').value;
  const weekdays=[...document.querySelectorAll('#weekdayPicker input:checked')].map(x=>Number(x.value));
  if(repeat==='weekdays'&&!weekdays.length){alert('Selecciona al menos un día de la semana.');return}
  const until=new Date(now);until.setMonth(until.getMonth()+6);
  tasks.push({id:uid(),title:$('#title').value.trim(),notes:$('#notes').value.trim(),when:when.toISOString(),alarm:$('#alarm').checked,sound:$('#sound').checked,soundType:$('#soundType').value,volume:Number($('#volume').value),vibrate:$('#vibrate').checked,vibrationPattern:$('#vibrationPattern').value,repeat,weekdays,repeatUntil:repeat==='none'||repeat==='5m'?null:until.toISOString(),done:false,lastAlert:null});
  save();form.reset();dialog.close();
});
function repeatText(t){
  if(t.repeat==='5m')return 'Cada 5 min';
  if(t.repeat==='daily')return 'Diario';
  if(t.repeat==='weekdays')return t.weekdays.map(d=>DAY_LABEL[d]).join(', ');
  return 'Una vez';
}
function makeTask(t){
  const n=$('#taskTemplate').content.firstElementChild.cloneNode(true),d=new Date(t.when);n.dataset.id=t.id;
  n.querySelector('.task-time').textContent=d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  n.querySelector('strong').textContent=t.title;
  const soundLabel=t.sound?`🔊 ${soundName(t.soundType)} ${t.volume}%`:'🔕'; const vibLabel=t.vibrate?' · 📳':'';
  n.querySelector('.task-main span').textContent=`${t.notes?`${t.notes} · `:''}${repeatText(t)} · ${soundLabel}${vibLabel}`;
  if(t.done)n.classList.add('done');
  n.querySelector('.done-btn').onclick=()=>completeTask(t);
  n.querySelector('.more-btn').onclick=()=>snoozeTask(t,5);
  return n;
}
function snoozeTask(t,mins){const nd=new Date(Math.max(new Date(t.when).getTime(),Date.now()));nd.setMinutes(nd.getMinutes()+mins);t.when=nd.toISOString();t.done=false;t.lastAlert=null;save()}
function nextRecurringDate(t){
  const current=new Date(t.when);let next=new Date(current);
  if(t.repeat==='daily') next.setDate(next.getDate()+1);
  else if(t.repeat==='weekdays'){
    for(let i=1;i<=7;i++){const cand=new Date(current);cand.setDate(cand.getDate()+i);if(t.weekdays.includes(cand.getDay())){next=cand;break}}
  } else return null;
  if(t.repeatUntil&&next>new Date(t.repeatUntil)) return null;
  return next;
}
function completeTask(t){
  if(t.repeat==='daily'||t.repeat==='weekdays'){
    const next=nextRecurringDate(t);
    if(next){t.when=next.toISOString();t.done=false;t.lastAlert=null}else t.done=true;
  }else{t.done=true;t.lastAlert=null}
  save();
}
function render(){
  tasks.sort((a,b)=>new Date(a.when)-new Date(b.when));
  const today=isoDate(new Date()),todays=tasks.filter(t=>isoDate(new Date(t.when))===today&&!t.done);
  timeline.innerHTML='';if(!todays.length)timeline.innerHTML='<div class="empty">Tu día está libre. Agrega tu primera función.</div>';else todays.forEach(t=>timeline.appendChild(makeTask(t)));
  const upcoming=tasks.filter(t=>!t.done&&new Date(t.when)>=new Date()).slice(0,8);nextList.innerHTML=upcoming.length?'':'<div class="empty">Sin recordatorios próximos.</div>';
  upcoming.forEach(t=>{const r=document.createElement('div');r.className='next-row';r.innerHTML='<strong></strong><span></span>';r.querySelector('strong').textContent=t.title;r.querySelector('span').textContent=`${fmtShort(new Date(t.when))} · ${repeatText(t)} · ${t.sound?`🔊 ${soundName(t.soundType)} ${t.volume}%`:'🔕'}${t.vibrate?' · 📳':''}`;nextList.appendChild(r)});
  $('#nextBadge').textContent=upcoming.length;const six=new Date();six.setMonth(six.getMonth()+6);const count=tasks.filter(t=>new Date(t.when)>=new Date()&&new Date(t.when)<=six&&!t.done).length;$('#futureCount').textContent=`${count} ${count===1?'función':'funciones'}`;updateNotifStatus();
}
$('#todayTitle').textContent=fmtDate(new Date());
async function askNotifications(){if(!('Notification'in window)){alert('Este dispositivo no admite notificaciones web.');return}const p=await Notification.requestPermission();updateNotifStatus();if(p==='granted'){try{const reg=await navigator.serviceWorker.ready;reg.showNotification('Mi Día',{body:'Avisos activados correctamente.',icon:'icons/icon-192.png',badge:'icons/icon-192.png'});}catch{new Notification('Mi Día',{body:'Avisos activados correctamente.',icon:'icons/icon-192.png'})}}}
function updateNotifStatus(){const el=$('#notifStatus');if(!el)return;if(!('Notification'in window)){el.textContent='Avisos: no compatibles';el.className='status-pill bad';return}if(Notification.permission==='granted'){el.textContent='Avisos: activos';el.className='status-pill good'}else if(Notification.permission==='denied'){el.textContent='Avisos: bloqueados';el.className='status-pill bad'}else{el.textContent='Avisos: sin activar';el.className='status-pill'}}
$('#requestNotifications').onclick=askNotifications;
const SOUND_NAMES={
  'soft-bell':'Campana suave','classic':'Tono clásico','digital':'Alarma digital','piano':'Piano',
  'nature':'Naturaleza','sea':'Mar','modern':'Notificación moderna','friendly':'Recordatorio amable'
};
const VIBRATION_PATTERNS={standard:[250,120,250],short:[180],double:[180,100,180],triple:[160,90,160,90,160],long:[700]};
function soundName(k){return SOUND_NAMES[k]||'Campana suave'}
function vibrationName(k){return {standard:'Estándar',short:'Corta',double:'Doble',triple:'Triple',long:'Larga'}[k]||'Estándar'}
function playTone(ctx,freq,start,duration,gainValue,type='sine'){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(gainValue,start);gain.gain.exponentialRampToValueAtTime(.001,start+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+duration)}
function playMelody(type='soft-bell',volume=70){
  try{const AC=window.AudioContext||window.webkitAudioContext;const ctx=new AC();const v=Math.max(0,Math.min(100,Number(volume)))/100*.22;const t=ctx.currentTime+.02;
    if(type==='classic'){playTone(ctx,880,t,.22,v,'square');playTone(ctx,660,t+.3,.22,v,'square');playTone(ctx,880,t+.6,.28,v,'square')}
    else if(type==='digital'){[1046,1318,1567].forEach((f,i)=>playTone(ctx,f,t+i*.16,.12,v,'square'))}
    else if(type==='piano'){[523,659,784].forEach((f,i)=>playTone(ctx,f,t+i*.22,.5,v,'triangle'))}
    else if(type==='nature'){[880,1175,988,1318].forEach((f,i)=>playTone(ctx,f,t+i*.18,.16,v*.7,'sine'))}
    else if(type==='sea'){[392,440,392,349].forEach((f,i)=>playTone(ctx,f,t+i*.28,.35,v*.75,'sine'))}
    else if(type==='modern'){playTone(ctx,740,t,.16,v,'triangle');playTone(ctx,988,t+.18,.22,v,'triangle')}
    else if(type==='friendly'){[659,784,988].forEach((f,i)=>playTone(ctx,f,t+i*.2,.28,v*.8,'sine'))}
    else {playTone(ctx,880,t,.45,v,'sine');playTone(ctx,1320,t+.12,.7,v*.55,'sine')}
  }catch{}
}
function vibrateWith(pattern='standard'){if(navigator.vibrate)navigator.vibrate(VIBRATION_PATTERNS[pattern]||VIBRATION_PATTERNS.standard)}
function syncAlarmOptions(){const soundOn=$('#sound').checked;$('#soundType').disabled=!soundOn;$('#volume').disabled=!soundOn;$('#previewSound').disabled=!soundOn;const soundBtn=$('#soundPickerButton'); if(soundBtn) soundBtn.disabled=!soundOn;const vibOn=$('#vibrate').checked;$('#vibrationPattern').disabled=!vibOn;$('#previewVibration').disabled=!vibOn;const vibBtn=$('#vibrationPickerButton'); if(vibBtn) vibBtn.disabled=!vibOn}
$('#sound').onchange=syncAlarmOptions;$('#vibrate').onchange=syncAlarmOptions;$('#volume').oninput=e=>$('#volumeValue').textContent=`${e.target.value}%`;$('#previewSound').onclick=()=>playMelody($('#soundType').value,$('#volume').value);$('#previewVibration').onclick=()=>vibrateWith($('#vibrationPattern').value);syncAlarmOptions();

async function showAlarm(t){
  activeAlarmId=t.id;$('#alarmTitle').textContent=t.title;$('#alarmNote').textContent=t.notes||'Tienes una función programada.';$('#alarmSoundState').textContent=t.sound?`🔊 ${soundName(t.soundType)} · ${t.volume}%`:'🔕 Sin sonido';$('#alarmVibrationState').textContent=t.vibrate?`📳 Vibración: ${vibrationName(t.vibrationPattern)}`:'📴 Sin vibración';
  if(!alarmDialog.open)alarmDialog.showModal();
  if(t.sound){playMelody(t.soundType,t.volume);if(alarmTimer)clearInterval(alarmTimer);alarmTimer=setInterval(()=>playMelody(t.soundType,t.volume),5000)}
  if(t.vibrate)vibrateWith(t.vibrationPattern);
  try{if(Notification.permission==='granted'){const reg=await navigator.serviceWorker.ready;reg.showNotification(t.title,{body:t.notes||'Es hora de esta función.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:t.id,renotify:true,silent:!t.sound,vibrate:t.vibrate?(VIBRATION_PATTERNS[t.vibrationPattern]||VIBRATION_PATTERNS.standard):[]})}}catch{}
}
function closeAlarm(){if(alarmTimer){clearInterval(alarmTimer);alarmTimer=null}if(alarmDialog.open)alarmDialog.close();activeAlarmId=null}
$('#alarmDone').onclick=()=>{const t=tasks.find(x=>x.id===activeAlarmId);if(t)completeTask(t);closeAlarm()};
$('#alarmSnooze').onclick=()=>{const t=tasks.find(x=>x.id===activeAlarmId);if(t)snoozeTask(t,5);closeAlarm()};
function checkReminders(){
  const now=Date.now();tasks.forEach(t=>{if(t.done||!t.alarm)return;const due=new Date(t.when).getTime();if(now<due)return;const last=t.lastAlert?new Date(t.lastAlert).getTime():0;const interval=t.repeat==='5m'?5*60*1000:Infinity;const should=!last||(t.repeat==='5m'&&now-last>=interval);if(should){t.lastAlert=new Date().toISOString();localStorage.setItem('midia.tasks',JSON.stringify(tasks));showAlarm(t);render()}})
}
setInterval(checkReminders,15000);checkReminders();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true};
let swReg=null;
async function registerSW(){
  if(!('serviceWorker' in navigator))return;
  try{swReg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
    const reveal=()=>{if(swReg.waiting)$('#updateBtn').hidden=false};
    reveal();
    swReg.addEventListener('updatefound',()=>{const w=swReg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)$('#updateBtn').hidden=false})});
    setInterval(()=>swReg.update().catch(()=>{}),60*60*1000);
  }catch{}
}
$('#updateBtn').onclick=()=>{if(swReg?.waiting){swReg.waiting.postMessage({type:'SKIP_WAITING'})}else swReg?.update()};
navigator.serviceWorker?.addEventListener('controllerchange',()=>location.reload());
registerSW();
window.addEventListener('focus',checkReminders);document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkReminders();swReg?.update().catch(()=>{})}});

const themeSelect=$('#themeMode');
const mediaDark=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(mode){document.documentElement.dataset.theme=mode;localStorage.setItem('midia.theme',mode);const effective=mode==='system'?(mediaDark.matches?'dark':'light'):mode;document.querySelector('meta[name="theme-color"]').setAttribute('content',effective==='dark'?'#0b1220':'#16a34a')}
const savedTheme=localStorage.getItem('midia.theme')||'system';themeSelect.value=savedTheme;applyTheme(savedTheme);themeSelect.onchange=e=>applyTheme(e.target.value);mediaDark.addEventListener?.('change',()=>{if((localStorage.getItem('midia.theme')||'system')==='system')applyTheme('system')});


// --- Pickers azules: fecha, hora, melodía, repetición y vibración ---
const pickerState={hour:'00',minute:'00',melody:$('#soundType').value||'soft-bell',repeat:$('#repeat').value||'none',vibration:$('#vibrationPattern').value||'standard',step:$('#step').value||'15',viewStep:$('#viewStep').value||'15'};
const dateDialog=$('#datePickerDialog'), timeDialog=$('#timePickerDialog'), melodyDialog=$('#melodyPickerDialog'), repeatDialog=$('#repeatPickerDialog'), vibrationDialog=$('#vibrationPickerDialog'), stepDialog=$('#stepPickerDialog'), viewStepDialog=$('#viewStepPickerDialog');

function openPicker(dlg){ if(dlg && !dlg.open) dlg.showModal(); }
function closePicker(dlg){ if(dlg && dlg.open) dlg.close(); }

document.querySelectorAll('[data-close-picker]').forEach(btn=>{
  btn.onclick=()=>closePicker(btn.closest('dialog'));
});

document.querySelectorAll('.blue-picker-dialog').forEach(dlg=>{
  dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.close(); });
});

function renderTimeWheel(containerId, values, selected, onPick){
  const box=$(containerId); if(!box) return;
  box.innerHTML='';
  values.forEach(v=>{
    const b=document.createElement('button');
    b.type='button'; b.className='wheel-item'+(v===selected?' active':''); b.textContent=v;
    b.onclick=()=>{ onPick(v); Array.from(box.children).forEach(x=>x.classList.toggle('active',x===b)); };
    box.appendChild(b);
  });
  const active=box.querySelector('.active'); if(active) active.scrollIntoView({block:'center'});
}

function initTimePicker(){
  const [h,m]=($('#time').value||'00:00').split(':'); pickerState.hour=h; pickerState.minute=m;
  renderTimeWheel('#hourWheel',Array.from({length:24},(_,i)=>String(i).padStart(2,'0')),pickerState.hour,v=>pickerState.hour=v);
  const step=$('#step').value==='15'?15:1;
  renderTimeWheel('#minuteWheel',Array.from({length:60/step},(_,i)=>String(i*step).padStart(2,'0')),pickerState.minute,v=>pickerState.minute=v);
}
$('#timePickerButton').onclick=()=>{ initTimePicker(); openPicker(timeDialog); };
$('#acceptTimePicker').onclick=()=>{ setTimeValue(`${pickerState.hour}:${pickerState.minute}`); closePicker(timeDialog); };

function openMelodyPicker(){
  pickerState.melody=$('#soundType').value||'soft-bell';
  const list=$('#melodyPickerList'); list.innerHTML='';
  Object.entries(SOUND_NAMES).forEach(([value,label])=>{
    const row=document.createElement('button'); row.type='button'; row.className='option-row'+(value===pickerState.melody?' active':'');
    row.innerHTML=`<span>${label}</span><small>${value===pickerState.melody?'Seleccionada':'Tocar para elegir'}</small>`;
    row.onclick=()=>{ pickerState.melody=value; [...list.children].forEach(x=>x.classList.remove('active')); row.classList.add('active'); $('#soundPickerValue').textContent=label; };
    list.appendChild(row);
  });
  openPicker(melodyDialog);
}
$('#soundPickerButton').onclick=openMelodyPicker;
$('#pickerPreviewSound').onclick=()=>playMelody(pickerState.melody,$('#volume').value);
$('#acceptMelodyPicker').onclick=()=>{ $('#soundType').value=pickerState.melody; $('#soundPickerValue').textContent=soundName(pickerState.melody); closePicker(melodyDialog); };


const STEP_OPTIONS=[['1','Minuto a minuto'],['15','Intervalos de 15 min']];
function setStepValue(value){
  $('#step').value=value; pickerState.step=value; $('#stepPickerValue').textContent=value==='1'?'Minuto a minuto':'Intervalos de 15 min';
  if(value==='15'&&$('#time').value){let [h,m]=$('#time').value.split(':').map(Number);let total=h*60+m;total=Math.round(total/15)*15;if(total>=1440)total=1425;h=Math.floor(total/60);m=total%60;setTimeValue(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)}
}
function openStepPicker(){
  pickerState.step=$('#step').value||'15';
  const list=$('#stepPickerList'); list.innerHTML='';
  STEP_OPTIONS.forEach(([value,label])=>{
    const row=document.createElement('button'); row.type='button'; row.className='option-row'+(value===pickerState.step?' active':'');
    row.innerHTML=`<span>${label}</span><small>${value==='1'?'Máxima precisión':'Captura rápida y ordenada'}</small>`;
    row.onclick=()=>{ pickerState.step=value; [...list.children].forEach(x=>x.classList.remove('active')); row.classList.add('active'); };
    list.appendChild(row);
  });
  openPicker(stepDialog);
}
$('#stepPickerButton').onclick=openStepPicker;
$('#acceptStepPicker').onclick=()=>{ setStepValue(pickerState.step); closePicker(stepDialog); };

function setViewStepValue(value){
  $('#viewStep').value=value; pickerState.viewStep=value; $('#viewStepPickerValue').textContent=value==='1'?'Minuto a minuto':'Cada 15 minutos';
  $('#viewStep').dispatchEvent(new Event('change',{bubbles:true}));
}
function openViewStepPicker(){
  pickerState.viewStep=$('#viewStep').value||'15';
  const list=$('#viewStepPickerList'); list.innerHTML='';
  [['1','Minuto a minuto'],['15','Cada 15 minutos']].forEach(([value,label])=>{
    const row=document.createElement('button'); row.type='button'; row.className='option-row'+(value===pickerState.viewStep?' active':'');
    row.innerHTML=`<span>${label}</span><small>Intervalo de visualización</small>`;
    row.onclick=()=>{ pickerState.viewStep=value; [...list.children].forEach(x=>x.classList.remove('active')); row.classList.add('active'); };
    list.appendChild(row);
  });
  openPicker(viewStepDialog);
}
$('#viewStepPickerButton').onclick=openViewStepPicker;
$('#acceptViewStepPicker').onclick=()=>{ setViewStepValue(pickerState.viewStep); closePicker(viewStepDialog); };

const REPEAT_OPTIONS=[['none','Solo una vez'],['5m','Cada 5 minutos'],['daily','Diario'],['weekdays','Días específicos de la semana']];
function openRepeatPicker(){
  pickerState.repeat=$('#repeat').value||'none';
  const list=$('#repeatPickerList'); list.innerHTML='';
  REPEAT_OPTIONS.forEach(([value,label])=>{
    const row=document.createElement('button'); row.type='button'; row.className='option-row'+(value===pickerState.repeat?' active':'');
    row.innerHTML=`<span>${label}</span><small>${value==='weekdays'?'Elige días concretos':'Repetición programada'}</small>`;
    row.onclick=()=>{ pickerState.repeat=value; [...list.children].forEach(x=>x.classList.remove('active')); row.classList.add('active'); };
    list.appendChild(row);
  });
  openPicker(repeatDialog);
}
$('#repeatPickerButton').onclick=openRepeatPicker;
$('#acceptRepeatPicker').onclick=()=>{ setRepeatValue(pickerState.repeat); closePicker(repeatDialog); };

const VIBRATION_OPTIONS=[['standard','Estándar'],['short','Corta'],['double','Doble'],['triple','Triple'],['long','Larga']];
function openVibrationPicker(){
  pickerState.vibration=$('#vibrationPattern').value||'standard';
  const list=$('#vibrationPickerList'); list.innerHTML='';
  VIBRATION_OPTIONS.forEach(([value,label])=>{
    const row=document.createElement('button'); row.type='button'; row.className='option-row'+(value===pickerState.vibration?' active':'');
    row.innerHTML=`<span>${label}</span><small>${value==='double'?'Dos pulsos':'Patrón de vibración'}</small>`;
    row.onclick=()=>{ pickerState.vibration=value; [...list.children].forEach(x=>x.classList.remove('active')); row.classList.add('active'); };
    list.appendChild(row);
  });
  openPicker(vibrationDialog);
}
$('#vibrationPickerButton').onclick=openVibrationPicker;
$('#acceptVibrationPicker').onclick=()=>{ setVibrationValue(pickerState.vibration); closePicker(vibrationDialog); };

function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function clampDateToRange(d){
  const min=new Date(`${$('#date').min}T00:00:00`); const max=new Date(`${$('#date').max}T00:00:00`);
  if(d<min) return min; if(d>max) return max; return d;
}
function renderCalendar(){
  const grid=$('#calendarGrid'); const label=$('#calendarMonthLabel'); if(!grid||!label) return;
  const view=new Date(selectedCalendarDate.getFullYear(),selectedCalendarDate.getMonth(),1);
  const min=new Date(`${$('#date').min}T00:00:00`); const max=new Date(`${$('#date').max}T00:00:00`);
  label.textContent=`${MONTH_LABEL[view.getMonth()]} ${view.getFullYear()}`;
  grid.innerHTML='';
  const start=view.getDay();
  const days=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
  const prevDays=new Date(view.getFullYear(),view.getMonth(),0).getDate();
  for(let i=0;i<42;i++){
    const cell=document.createElement('button'); cell.type='button'; cell.className='calendar-day';
    let d;
    if(i<start){ d=new Date(view.getFullYear(),view.getMonth()-1,prevDays-start+i+1); cell.classList.add('muted'); }
    else if(i>=start+days){ d=new Date(view.getFullYear(),view.getMonth()+1,i-(start+days)+1); cell.classList.add('muted'); }
    else { d=new Date(view.getFullYear(),view.getMonth(),i-start+1); }
    cell.textContent=d.getDate();
    const iso=isoDate(d);
    const disabled=d<min || d>max;
    if(disabled){ cell.disabled=true; cell.classList.add('disabled'); }
    if(sameDay(d,new Date())) cell.classList.add('today');
    if(sameDay(d,selectedCalendarDate)) cell.classList.add('active');
    cell.onclick=()=>{ selectedCalendarDate=clampDateToRange(d); renderCalendar(); };
    grid.appendChild(cell);
  }
}
$('#datePickerButton').onclick=()=>{ selectedCalendarDate=clampDateToRange(new Date(`${$('#date').value||isoDate(new Date())}T00:00:00`)); renderCalendar(); openPicker(dateDialog); };
$('#prevMonthBtn').onclick=()=>{ selectedCalendarDate=new Date(selectedCalendarDate.getFullYear(),selectedCalendarDate.getMonth()-1,1); selectedCalendarDate=clampDateToRange(selectedCalendarDate); renderCalendar(); };
$('#nextMonthBtn').onclick=()=>{ selectedCalendarDate=new Date(selectedCalendarDate.getFullYear(),selectedCalendarDate.getMonth()+1,1); selectedCalendarDate=clampDateToRange(selectedCalendarDate); renderCalendar(); };
$('#acceptDatePicker').onclick=()=>{ setDateValue(isoDate(selectedCalendarDate)); closePicker(dateDialog); };

if($('#stepPickerValue')) $('#stepPickerValue').textContent=$('#step').value==='1'?'Minuto a minuto':'Intervalos de 15 min';
if($('#viewStepPickerValue')) $('#viewStepPickerValue').textContent=$('#viewStep').value==='1'?'Minuto a minuto':'Cada 15 minutos';
render();
