(()=>{
  const AC=window.AudioContext||window.webkitAudioContext;
  let audioCtx=null;

  const DIRECT_PATTERNS={
    standard:[500,150,500],
    short:[350],
    double:[500,140,500],
    triple:[420,120,420,120,420],
    long:[1200],
    alarm:[700,160,700,160,1000]
  };

  const NOTIFICATION_PATTERNS={
    standard:[800,180,800],
    short:[500],
    double:[700,180,700],
    triple:[600,180,600,180,600],
    long:[1500]
  };

  function ensureAudio(){
    if(!AC)return null;
    if(!audioCtx)audioCtx=new AC();
    return audioCtx;
  }

  async function unlockAudio(){
    try{
      const ctx=ensureAudio();
      if(!ctx)return false;
      if(ctx.state==='suspended')await ctx.resume();
      const gain=ctx.createGain();
      gain.gain.value=0.00001;
      const osc=ctx.createOscillator();
      osc.frequency.value=440;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime+0.03);
      return ctx.state==='running';
    }catch{
      return false;
    }
  }

  function tone(ctx,freq,start,duration,gainValue,type='sine'){
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(freq,start);
    gain.gain.setValueAtTime(Math.max(gainValue,0.0001),start);
    gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start+duration);
  }

  function playPass(ctx,type,v,t){
    if(type==='classic'){tone(ctx,880,t,.22,v,'square');tone(ctx,660,t+.3,.22,v,'square');tone(ctx,880,t+.6,.28,v,'square');return .9}
    if(type==='digital'){[1046,1318,1567].forEach((f,i)=>tone(ctx,f,t+i*.16,.12,v,'square'));return .55}
    if(type==='piano'){[523,659,784].forEach((f,i)=>tone(ctx,f,t+i*.22,.5,v,'triangle'));return .95}
    if(type==='nature'){[880,1175,988,1318].forEach((f,i)=>tone(ctx,f,t+i*.18,.16,v*.75,'sine'));return .85}
    if(type==='sea'){[392,440,392,349].forEach((f,i)=>tone(ctx,f,t+i*.28,.35,v*.8,'sine'));return 1.25}
    if(type==='modern'){tone(ctx,740,t,.16,v,'triangle');tone(ctx,988,t+.18,.22,v,'triangle');return .55}
    if(type==='friendly'){[659,784,988].forEach((f,i)=>tone(ctx,f,t+i*.2,.28,v*.85,'sine'));return .8}
    tone(ctx,880,t,.45,v,'sine');tone(ctx,1320,t+.12,.7,v*.6,'sine');return .9
  }

  window.playMelody=async function(type='soft-bell',volume=70){
    try{
      const ctx=ensureAudio();
      if(!ctx)return false;
      if(ctx.state==='suspended')await ctx.resume();
      if(ctx.state!=='running')return false;
      const v=Math.max(0,Math.min(100,Number(volume)))/100*.34;
      const t=ctx.currentTime+.02;
      const duration=playPass(ctx,type,v,t);
      playPass(ctx,type,v,t+duration+.35);
      return true;
    }catch{
      return false;
    }
  };

  window.vibrateWith=function(pattern='standard'){
    try{
      if(!('vibrate' in navigator))return false;
      navigator.vibrate(0);
      return navigator.vibrate(DIRECT_PATTERNS[pattern]||DIRECT_PATTERNS.standard);
    }catch{
      return false;
    }
  };

  async function readyRegistration(){
    if(!('serviceWorker' in navigator))throw new Error('Service Worker no disponible');
    let reg=await navigator.serviceWorker.getRegistration();
    if(!reg)reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
    return await navigator.serviceWorker.ready;
  }

  async function androidVibrationNotification({
    title='Mi Día',
    body='Recordatorio',
    pattern='standard',
    tag='mi-dia-vibration',
    requireInteraction=true,
    autoClose=false
  }={}){
    if(!('Notification' in window))return false;
    if(Notification.permission!=='granted')return false;

    try{
      const reg=await readyRegistration();
      await reg.showNotification(title,{
        body,
        icon:'Icons/icon-192.png',
        badge:'Icons/icon-192.png',
        tag,
        renotify:true,
        requireInteraction,
        silent:false,
        vibrate:NOTIFICATION_PATTERNS[pattern]||NOTIFICATION_PATTERNS.standard,
        timestamp:Date.now()
      });

      if(autoClose){
        setTimeout(async()=>{
          try{
            const notes=await reg.getNotifications({tag});
            notes.forEach(n=>n.close());
          }catch{}
        },2500);
      }
      return true;
    }catch(err){
      console.error('Mi Día vibration notification:',err);
      return false;
    }
  }

  const prime=()=>unlockAudio();
  ['pointerdown','touchstart','keydown'].forEach(evt=>{
    document.addEventListener(evt,prime,{once:true,passive:true,capture:true});
  });
  document.querySelector('#taskForm')?.addEventListener('submit',unlockAudio,{capture:true});

  const previewSound=document.querySelector('#previewSound');
  if(previewSound){
    previewSound.onclick=async()=>{
      await unlockAudio();
      await window.playMelody(
        document.querySelector('#soundType')?.value,
        document.querySelector('#volume')?.value
      );
    };
  }

  const previewVibration=document.querySelector('#previewVibration');
  if(previewVibration){
    previewVibration.onclick=async()=>{
      const pattern=document.querySelector('#vibrationPattern')?.value||'standard';

      if(typeof window.MiDiaAndroid!=='undefined'
          && typeof window.MiDiaAndroid.previewVibration==='function'){
        try{
          window.MiDiaAndroid.previewVibration(pattern);
          return;
        }catch{}
      }

      window.vibrateWith(pattern);

      const sent=await androidVibrationNotification({
        title:'Mi Día',
        body:'Prueba de vibración',
        pattern,
        tag:'mi-dia-vibration-test',
        requireInteraction:false,
        autoClose:true
      });

      if(!sent && !('vibrate' in navigator)){
        alert('Este dispositivo no permite ejecutar la vibración de prueba.');
      }
    };
  }

  function readCenterTasks(){
    try{
      const raw=JSON.parse(localStorage.getItem('midia.tasks')||'[]');
      return Array.isArray(raw)?raw:[];
    }catch{
      return [];
    }
  }

  function upcomingCenterTasks(){
    const now=Date.now();
    return readCenterTasks()
      .filter(t=>!t.done && t.alarm!==false && new Date(t.when).getTime()>=now)
      .sort((a,b)=>new Date(a.when)-new Date(b.when));
  }

  function getQuietUntil(){
    const value=Number(localStorage.getItem('midia.quietUntil')||0);
    return Number.isFinite(value)?value:0;
  }

  function isQuietMode(){
    const until=getQuietUntil();
    if(until && until<=Date.now()){
      localStorage.removeItem('midia.quietUntil');
      return false;
    }
    return until>Date.now();
  }

  function centerDate(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return new Intl.DateTimeFormat('es-MX',{
      weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'
    }).format(d);
  }

  function permissionText(){
    if(nativeBridgeAvailable()){
      try{
        return window.MiDiaAndroid.notificationsEnabled()
          ? ['Android: activas','good']
          : ['Android: revisar','warn'];
      }catch{
        return ['Android','good'];
      }
    }
    if(!('Notification' in window))return ['No compatible','bad'];
    if(Notification.permission==='granted')return ['Activas','good'];
    if(Notification.permission==='denied')return ['Bloqueadas','bad'];
    return ['Sin activar','warn'];
  }

  function ensureCenterDialog(){
    let dlg=document.querySelector('#miDiaCenterDialog');
    if(dlg)return dlg;

    dlg=document.createElement('dialog');
    dlg.id='miDiaCenterDialog';
    dlg.className='mi-dia-center';
    dlg.innerHTML=`
      <div class="mi-center-panel">
        <div class="mi-center-head">
          <div>
            <span class="mi-center-eyebrow">CENTRO DE AVISOS</span>
            <h2>Recordatorios</h2>
          </div>
          <button type="button" class="mi-center-close" aria-label="Cerrar">×</button>
        </div>

        <div class="mi-center-stats">
          <div><span>Próximos</span><strong id="miCenterCount">0</strong></div>
          <div><span>Sonido</span><strong id="miCenterSound">—</strong></div>
          <div><span>Vibración</span><strong id="miCenterVibration">—</strong></div>
        </div>

        <div class="mi-center-status">
          <span>Notificaciones</span>
          <strong id="miCenterNotif">—</strong>
        </div>

        <div id="miCenterQuietState" class="mi-center-quiet"></div>

        <div class="mi-center-subhead">
          <strong>Próximos avisos</strong>
          <span id="miCenterMiniCount"></span>
        </div>
        <div id="miCenterList" class="mi-center-list"></div>

        <div class="mi-center-actions">
          <button type="button" id="miCenterQuietBtn" class="ghost">Silenciar 1 h</button>
          <button type="button" id="miCenterGoAgenda" class="primary">Ver agenda</button>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);

    const css=document.createElement('style');
    css.textContent=`
      .mi-dia-center{border:0;padding:0;background:transparent;color:var(--text);width:min(92vw,470px);max-height:84vh}
      .mi-dia-center::backdrop{background:rgba(3,12,22,.68);backdrop-filter:blur(4px)}
      .mi-center-panel{border:1px solid var(--line);border-radius:22px;padding:18px;background:linear-gradient(180deg,rgba(18,52,83,.98),rgba(7,23,39,.99));box-shadow:0 24px 70px rgba(0,0,0,.5)}
      .mi-center-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
      .mi-center-head h2{margin:2px 0 0;font-size:1.35rem}
      .mi-center-eyebrow{font-size:.7rem;font-weight:800;letter-spacing:.12em;color:#7cc7ff}
      .mi-center-close{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);border-radius:12px;width:38px;height:38px;font-size:1.5rem;line-height:1;cursor:pointer}
      .mi-center-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
      .mi-center-stats>div,.mi-center-status{border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:14px;padding:11px}
      .mi-center-stats span,.mi-center-status span{display:block;font-size:.72rem;opacity:.7;margin-bottom:4px}
      .mi-center-stats strong{font-size:1rem}
      .mi-center-status{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .mi-center-status span{margin:0}
      #miCenterNotif.good{color:#7ff0c5} #miCenterNotif.bad{color:#ff9cab} #miCenterNotif.warn{color:#ffd37c}
      .mi-center-quiet{font-size:.8rem;padding:9px 11px;border-radius:12px;margin-bottom:12px;background:rgba(39,133,103,.12);border:1px solid rgba(83,210,167,.2);color:#9cebd0}
      .mi-center-quiet.active{background:rgba(185,123,32,.13);border-color:rgba(255,185,76,.25);color:#ffd18a}
      .mi-center-subhead{display:flex;justify-content:space-between;align-items:center;margin:10px 2px 8px}
      .mi-center-subhead span{font-size:.74rem;opacity:.65}
      .mi-center-list{display:grid;gap:8px;max-height:34vh;overflow:auto;padding-right:2px}
      .mi-center-item{display:grid;grid-template-columns:42px 1fr;gap:10px;align-items:center;border:1px solid var(--line);background:rgba(255,255,255,.025);border-radius:14px;padding:10px}
      .mi-center-bell{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:rgba(53,153,255,.12);font-size:1.1rem}
      .mi-center-item strong{display:block;font-size:.88rem;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mi-center-item span{display:block;font-size:.72rem;opacity:.7}
      .mi-center-empty{text-align:center;padding:24px 12px;opacity:.65;border:1px dashed var(--line);border-radius:14px}
      .mi-center-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}
      #requestNotificationsMobile{position:relative}
      #requestNotificationsMobile[data-has-items="true"]{border-color:#2f9cff}
      @media(max-width:560px){.mi-center-panel{padding:15px}.mi-dia-center{width:94vw}.mi-center-stats{gap:6px}.mi-center-stats>div{padding:9px}}
    `;
    document.head.appendChild(css);

    dlg.querySelector('.mi-center-close').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{
      if(e.target===dlg)dlg.close();
    });

    dlg.querySelector('#miCenterQuietBtn').onclick=()=>{
      if(isQuietMode()){
        localStorage.removeItem('midia.quietUntil');
      }else{
        localStorage.setItem('midia.quietUntil',String(Date.now()+60*60*1000));
        try{navigator.vibrate?.(0)}catch{}
      }
      renderCenter();
    };

    dlg.querySelector('#miCenterGoAgenda').onclick=()=>{
      dlg.close();
      const target=document.querySelector('.next-card')||document.querySelector('.timeline-card');
      target?.scrollIntoView({behavior:'smooth',block:'start'});
    };

    return dlg;
  }

  function renderCenter(){
    const items=upcomingCenterTasks();
    const count=items.length;
    const dlg=document.querySelector('#miDiaCenterDialog');

    const mobile=document.querySelector('#requestNotificationsMobile');
    if(mobile){
      mobile.textContent=count?`🔔 ${count}`:'🔔';
      mobile.title=count?`${count} aviso${count===1?'':'s'} próximo${count===1?'':'s'}`:'Centro de avisos';
      mobile.dataset.active=('Notification' in window && Notification.permission==='granted')?'true':'false';
      mobile.dataset.hasItems=count?'true':'false';
    }

    const side=document.querySelector('#requestNotifications');
    if(side){
      side.textContent=count?`🔔 Avisos (${count})`:'🔔 Centro de avisos';
    }

    if(!dlg)return;

    const [pText,pClass]=permissionText();
    dlg.querySelector('#miCenterCount').textContent=String(count);
    dlg.querySelector('#miCenterSound').textContent=items.some(t=>t.sound!==false)?'Activo':'—';
    dlg.querySelector('#miCenterVibration').textContent=items.some(t=>t.vibrate!==false)?'Activa':'—';

    const notif=dlg.querySelector('#miCenterNotif');
    notif.textContent=pText;
    notif.className=pClass;

    const quiet=isQuietMode();
    const quietState=dlg.querySelector('#miCenterQuietState');
    const quietBtn=dlg.querySelector('#miCenterQuietBtn');
    if(quiet){
      const until=new Date(getQuietUntil()).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      quietState.textContent=`🔕 Avisos silenciados temporalmente hasta ${until}. Las tareas seguirán apareciendo en pantalla.`;
      quietState.classList.add('active');
      quietBtn.textContent='Reactivar avisos';
    }else{
      quietState.textContent='🔔 Sonido y vibración disponibles para tus recordatorios.';
      quietState.classList.remove('active');
      quietBtn.textContent='Silenciar 1 h';
    }

    dlg.querySelector('#miCenterMiniCount').textContent=count?`${count} pendientes`:'Sin pendientes';

    const list=dlg.querySelector('#miCenterList');
    list.innerHTML='';
    if(!count){
      const empty=document.createElement('div');
      empty.className='mi-center-empty';
      empty.textContent='Sin avisos pendientes.';
      list.appendChild(empty);
    }else{
      items.slice(0,6).forEach(t=>{
        const row=document.createElement('div');
        row.className='mi-center-item';

        const icon=document.createElement('div');
        icon.className='mi-center-bell';
        icon.textContent='🔔';

        const body=document.createElement('div');
        const title=document.createElement('strong');
        title.textContent=t.title||'Recordatorio';
        const meta=document.createElement('span');
        const flags=[centerDate(t.when)];
        if(t.sound!==false)flags.push('🔊');
        if(t.vibrate!==false)flags.push('📳');
        meta.textContent=flags.join(' · ');

        body.append(title,meta);
        row.append(icon,body);
        list.appendChild(row);
      });
    }
  }

  async function enableNotifications(){
    await unlockAudio();

    if(nativeBridgeAvailable()){
      try{
        window.MiDiaAndroid.requestNotificationPermission();
        renderCenter();
        return true;
      }catch{
        return false;
      }
    }

    if(!('Notification' in window)){
      return false;
    }
    if(Notification.permission==='granted'){
      if(typeof updateNotifStatus==='function')updateNotifStatus();
      renderCenter();
      return true;
    }
    if(Notification.permission==='denied'){
      renderCenter();
      return false;
    }

    await Notification.requestPermission();
    if(typeof updateNotifStatus==='function')updateNotifStatus();
    renderCenter();
    return Notification.permission==='granted';
  }

  async function openCenter(){
    if(!nativeBridgeAvailable()
        && 'Notification' in window
        && Notification.permission==='default'){
      await enableNotifications();
    }
    const dlg=ensureCenterDialog();
    renderCenter();
    if(!dlg.open)dlg.showModal();
  }

  const activate=document.querySelector('#requestNotifications');
  if(activate)activate.onclick=openCenter;

  const topActions=document.querySelector('.top-actions');
  if(topActions && !document.querySelector('#requestNotificationsMobile')){
    const mobileBtn=document.createElement('button');
    mobileBtn.id='requestNotificationsMobile';
    mobileBtn.type='button';
    mobileBtn.className='ghost';
    mobileBtn.setAttribute('aria-label','Centro de avisos');
    mobileBtn.onclick=openCenter;
    topActions.insertBefore(mobileBtn,topActions.firstChild);

    const style=document.createElement('style');
    style.textContent=`
      #requestNotificationsMobile{display:none;border:1px solid var(--line);padding:8px 10px;white-space:nowrap;min-width:42px}
      #requestNotificationsMobile[data-active="true"]{color:#7ff0c5}
      @media(max-width:900px){#requestNotificationsMobile{display:inline-flex;align-items:center;justify-content:center}}
      @media(max-width:560px){#requestNotificationsMobile{font-size:.76rem;padding:7px 8px}.top-actions{gap:5px}}
    `;
    document.head.appendChild(style);
  }

  // Se actualiza cuando la app vuelve a renderizar tareas.
  const badge=document.querySelector('#nextBadge');
  if(badge){
    new MutationObserver(()=>{
      renderCenter();
      if(document.querySelector('#miDiaCenterDialog')?.open)renderCenter();
    }).observe(badge,{childList:true,characterData:true,subtree:true});
  }

  renderCenter();
  setInterval(renderCenter,60*1000);

  if(typeof showAlarm==='function'){
    showAlarm=async function(t){
      if(nativeBridgeAvailable()){
        syncNativeAlarms();
        return;
      }

      activeAlarmId=t.id;
      const alarmTimeEl=document.querySelector('#alarmTime');
      if(alarmTimeEl){
        const d=new Date(t.when);
        alarmTimeEl.textContent=Number.isNaN(d.getTime())?'--:--':d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      }
      $('#alarmTitle').textContent=t.title;
      $('#alarmNote').textContent=t.notes||'Tienes una función programada.';
      $('#alarmSoundState').textContent=t.sound?`🔊 ${soundName(t.soundType)} · ${t.volume}%`:'🔕 Sin sonido';
      $('#alarmVibrationState').textContent=t.vibrate?`📳 Vibración: ${t.vibrationPattern}`:'📴 Sin vibración';

      if(!alarmDialog.open)alarmDialog.showModal();

      const quiet=isQuietMode();

      if(t.sound && !quiet){
        await window.playMelody(t.soundType,t.volume);
        if(alarmTimer)clearInterval(alarmTimer);
        alarmTimer=setInterval(()=>window.playMelody(t.soundType,t.volume),5000);
      }

      if(t.vibrate && !quiet){
        window.vibrateWith(t.vibrationPattern);
      }

      // La alarma real NO publica una notificación en el panel de Android.
      // El Centro de avisos (campana) conserva los recordatorios desde localStorage.
    };
  }

  ['#alarmDone','#alarmSnooze'].forEach(sel=>{
    document.querySelector(sel)?.addEventListener('click',()=>{
      try{navigator.vibrate?.(0)}catch{}
    },{capture:true});
  });


  // --- Puente opcional Mi Día Android ---
  // En navegador/PWA no hace nada. En la app Android sincroniza las tareas
  // con AlarmManager para que puedan sonar con la pantalla bloqueada o la app cerrada.
  function nativeBridgeAvailable(){
    return typeof window.MiDiaAndroid!=='undefined'
      && typeof window.MiDiaAndroid.syncAlarms==='function';
  }

  function syncNativeAlarms(){
    if(!nativeBridgeAvailable())return false;
    try{
      window.MiDiaAndroid.syncAlarms(localStorage.getItem('midia.tasks')||'[]');
      return true;
    }catch(err){
      console.error('Mi Día native sync:',err);
      return false;
    }
  }

  function consumeNativeActions(){
    if(!nativeBridgeAvailable() || typeof window.MiDiaAndroid.consumeActions!=='function')return;
    try{
      const raw=window.MiDiaAndroid.consumeActions();
      if(!raw)return;
      const actions=JSON.parse(raw);
      if(!Array.isArray(actions) || !actions.length)return;

      let changed=false;
      actions.forEach(a=>{
        try{
          if(typeof tasks==='undefined')return;
          const t=tasks.find(x=>x.id===a.id);
          if(!t)return;

          if(a.action==='complete' && typeof completeTask==='function'){
            completeTask(t);
            changed=true;
          }else if(a.action==='snooze' && typeof snoozeTask==='function'){
            snoozeTask(t,5);
            changed=true;
          }
        }catch{}
      });

      if(changed){
        try{localStorage.setItem('midia.tasks',JSON.stringify(tasks))}catch{}
        if(typeof render==='function')render();
      }
      syncNativeAlarms();
    }catch(err){
      console.error('Mi Día native actions:',err);
    }
  }

  window.addEventListener('midia-native-ready',()=>{
    consumeNativeActions();
    syncNativeAlarms();
    renderCenter();
  });

  // Cada cambio visible en la lista de próximos avisos fuerza una nueva sincronización nativa.
  const nativeBadge=document.querySelector('#nextBadge');
  if(nativeBadge){
    new MutationObserver(()=>syncNativeAlarms())
      .observe(nativeBadge,{childList:true,characterData:true,subtree:true});
  }

  setTimeout(()=>{
    consumeNativeActions();
    syncNativeAlarms();
  },700);

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
      renderCenter();
    }
  });

  window.addEventListener('focus',()=>{
    if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
    consumeNativeActions();
    syncNativeAlarms();
    renderCenter();
  });

  // --- v1.4k: selectores azules propios, basados en la muestra aprobada ---
  const MELODY_LABELS={
    'soft-bell':'Campana suave',
    'classic':'Tono clásico',
    'digital':'Alarma digital',
    'piano':'Piano',
    'nature':'Naturaleza',
    'sea':'Mar',
    'modern':'Notificación moderna',
    'friendly':'Recordatorio amable'
  };

  const timeDialogV14=document.querySelector('#timePickerDialog');
  const melodyDialogV14=document.querySelector('#melodyPickerDialog');
  const timeInputV14=document.querySelector('#time');
  const soundSelectV14=document.querySelector('#soundType');
  const timeValueV14=document.querySelector('#timePickerValue');
  const soundValueV14=document.querySelector('#soundPickerValue');

  let tempHourV14='09';
  let tempMinuteV14='00';
  let tempMelodyV14='soft-bell';

  function syncTimeLabelV14(){
    if(timeValueV14)timeValueV14.textContent=timeInputV14?.value||'--:--';
  }

  function syncSoundLabelV14(){
    if(soundValueV14)soundValueV14.textContent=MELODY_LABELS[soundSelectV14?.value]||'Campana suave';
    const trigger=document.querySelector('#soundPickerButton');
    if(trigger)trigger.disabled=!document.querySelector('#sound')?.checked;
  }

  function makeWheelV14(container,values,current,onPick){
    if(!container)return;
    container.innerHTML='';
    values.forEach(value=>{
      const b=document.createElement('button');
      b.type='button';
      b.textContent=value;
      b.dataset.value=value;
      if(value===current)b.classList.add('selected');
      b.onclick=()=>{
        [...container.querySelectorAll('button')].forEach(x=>x.classList.remove('selected'));
        b.classList.add('selected');
        onPick(value);
        b.scrollIntoView({block:'center',behavior:'smooth'});
      };
      container.appendChild(b);
    });
    setTimeout(()=>container.querySelector('.selected')?.scrollIntoView({block:'center'}),40);
  }

  function openTimePickerV14(){
    const [h,m]=(timeInputV14?.value||'09:00').split(':');
    tempHourV14=h||'09';
    tempMinuteV14=m||'00';

    const hourValues=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    const step=document.querySelector('#step')?.value==='15'?15:1;
    const minuteValues=Array.from({length:Math.ceil(60/step)},(_,i)=>String(i*step).padStart(2,'0'));

    if(!minuteValues.includes(tempMinuteV14)){
      const rounded=Math.min(59,Math.round(Number(tempMinuteV14||0)/step)*step);
      tempMinuteV14=String(rounded>=60?45:rounded).padStart(2,'0');
    }

    makeWheelV14(document.querySelector('#hourWheel'),hourValues,tempHourV14,v=>tempHourV14=v);
    makeWheelV14(document.querySelector('#minuteWheel'),minuteValues,tempMinuteV14,v=>tempMinuteV14=v);

    if(timeDialogV14 && !timeDialogV14.open)timeDialogV14.showModal();
  }

  function renderMelodiesV14(){
    const list=document.querySelector('#melodyPickerList');
    if(!list)return;
    list.innerHTML='';
    Object.entries(MELODY_LABELS).forEach(([value,label])=>{
      const row=document.createElement('button');
      row.type='button';
      row.className='melody-option'+(value===tempMelodyV14?' selected':'');
      row.innerHTML=`<span class="play-dot">▶</span><span>${label}</span><span class="radio-dot"></span>`;
      row.onclick=async()=>{
        tempMelodyV14=value;
        renderMelodiesV14();
        await unlockAudio();
        await window.playMelody(value,document.querySelector('#volume')?.value||70);
      };
      list.appendChild(row);
    });
  }

  function openMelodyPickerV14(){
    tempMelodyV14=soundSelectV14?.value||'soft-bell';
    renderMelodiesV14();
    if(melodyDialogV14 && !melodyDialogV14.open)melodyDialogV14.showModal();
  }

  document.querySelector('#timePickerButton')?.addEventListener('click',openTimePickerV14);
  document.querySelector('#soundPickerButton')?.addEventListener('click',openMelodyPickerV14);

  document.querySelector('#acceptTimePicker')?.addEventListener('click',()=>{
    if(timeInputV14){
      timeInputV14.value=`${tempHourV14}:${tempMinuteV14}`;
      timeInputV14.dispatchEvent(new Event('change',{bubbles:true}));
    }
    syncTimeLabelV14();
    timeDialogV14?.close();
  });

  document.querySelector('#acceptMelodyPicker')?.addEventListener('click',()=>{
    if(soundSelectV14){
      soundSelectV14.value=tempMelodyV14;
      soundSelectV14.dispatchEvent(new Event('change',{bubbles:true}));
    }
    syncSoundLabelV14();
    melodyDialogV14?.close();
  });

  document.querySelector('#pickerPreviewSound')?.addEventListener('click',async()=>{
    await unlockAudio();
    await window.playMelody(tempMelodyV14,document.querySelector('#volume')?.value||70);
  });

  document.querySelectorAll('[data-close-picker]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(btn.dataset.closePicker==='time')timeDialogV14?.close();
      if(btn.dataset.closePicker==='melody')melodyDialogV14?.close();
    });
  });

  [timeDialogV14,melodyDialogV14].forEach(dlg=>{
    dlg?.addEventListener('click',e=>{
      if(e.target===dlg)dlg.close();
    });
  });

  document.querySelector('#step')?.addEventListener('change',()=>setTimeout(syncTimeLabelV14,0));
  document.querySelector('#sound')?.addEventListener('change',syncSoundLabelV14);
  document.querySelector('#soundType')?.addEventListener('change',syncSoundLabelV14);

  ['#newBtn','#goNew'].forEach(sel=>{
    document.querySelector(sel)?.addEventListener('click',()=>{
      setTimeout(()=>{
        syncTimeLabelV14();
        syncSoundLabelV14();
      },0);
    });
  });

  // v1.4o — navegación móvil con funciones reales.
  const navDateFmt=new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  const navTimeFmt=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'});
  let navCalendarView=new Date();
  navCalendarView=new Date(navCalendarView.getFullYear(),navCalendarView.getMonth(),1);
  let navCalendarSelected=new Date();

  function navTasks(){
    try{
      if(typeof tasks!=='undefined' && Array.isArray(tasks)) return tasks;
      return JSON.parse(localStorage.getItem('midia.tasks')||'[]');
    }catch{return []}
  }
  function navIso(d){const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}
  function navRepeat(t){
    if(t.repeat==='5m')return 'Cada 5 min';
    if(t.repeat==='daily')return 'Diario';
    if(t.repeat==='weekdays')return 'Días específicos';
    return 'Una vez';
  }
  function closeNavSheets(){document.querySelectorAll('.midia-nav-dialog[open]').forEach(d=>d.close())}
  function setDockActive(name){document.querySelectorAll('.mobile-dock button').forEach(x=>x.classList.toggle('active',x.dataset.dock===name))}

  function ensureNavShell(id,title,subtitle=''){
    let dlg=document.querySelector(`#${id}`);
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id=id;dlg.className='midia-nav-dialog';
    dlg.innerHTML=`<div class="midia-nav-panel">
      <div class="midia-nav-head"><div><span>${subtitle}</span><h2>${title}</h2></div><button type="button" class="midia-nav-close">×</button></div>
      <div class="midia-nav-body"></div>
    </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.midia-nav-close').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
    dlg.addEventListener('close',()=>{document.querySelectorAll('.mobile-dock button').forEach(x=>x.classList.remove('active'))});
    return dlg;
  }

  function renderProgrammed(){
    const dlg=ensureNavShell('midiaProgrammedDialog','Programados','PRÓXIMOS RECORDATORIOS');
    const body=dlg.querySelector('.midia-nav-body');
    const now=Date.now();
    const list=navTasks().filter(t=>!t.done && new Date(t.when).getTime()>=now).sort((a,b)=>new Date(a.when)-new Date(b.when));
    body.innerHTML=`<div class="midia-nav-stats"><div><span>Pendientes</span><strong>${list.length}</strong></div><div><span>Hoy</span><strong>${list.filter(t=>navIso(new Date(t.when))===navIso(new Date())).length}</strong></div><div><span>Con alarma</span><strong>${list.filter(t=>t.alarm!==false).length}</strong></div></div>
      <div id="midiaProgrammedList" class="midia-nav-list"></div>
      <button id="midiaProgrammedNew" class="primary midia-nav-mainbtn" type="button">＋ Nueva tarea</button>`;
    const box=body.querySelector('#midiaProgrammedList');
    if(!list.length){box.innerHTML='<div class="midia-nav-empty">No tienes tareas programadas.</div>'}
    list.slice(0,30).forEach(t=>{
      const row=document.createElement('div');row.className='midia-nav-item';
      const d=new Date(t.when);
      row.innerHTML=`<div class="midia-nav-item-main"><strong></strong><span></span></div><div class="midia-nav-item-actions"><button type="button" data-act="done">✓</button><button type="button" data-act="snooze">+5</button></div>`;
      row.querySelector('strong').textContent=t.title||'Tarea';
      row.querySelector('span').textContent=`${navDateFmt.format(d)} · ${navTimeFmt.format(d)} · ${navRepeat(t)}`;
      row.querySelector('[data-act="done"]').onclick=()=>{try{if(typeof completeTask==='function')completeTask(t)}catch{};renderProgrammed()};
      row.querySelector('[data-act="snooze"]').onclick=()=>{try{if(typeof snoozeTask==='function')snoozeTask(t,5)}catch{};renderProgrammed()};
      box.appendChild(row);
    });
    body.querySelector('#midiaProgrammedNew').onclick=()=>{dlg.close();document.querySelector('#newBtn')?.click()};
    return dlg;
  }

  function renderCalendarOverview(){
    const dlg=ensureNavShell('midiaCalendarOverviewDialog','Calendario','AGENDA MENSUAL');
    const body=dlg.querySelector('.midia-nav-body');
    body.innerHTML=`<div class="midia-calendar-toolbar"><button id="midiaCalPrev" type="button">‹</button><strong id="midiaCalTitle"></strong><button id="midiaCalNext" type="button">›</button></div>
      <div class="midia-calendar-week"><span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span></div>
      <div id="midiaCalGrid" class="midia-calendar-grid"></div>
      <div class="midia-day-head"><span>Programados para</span><strong id="midiaCalSelected"></strong></div>
      <div id="midiaCalDayList" class="midia-nav-list compact"></div>
      <button id="midiaCalNew" class="primary midia-nav-mainbtn" type="button">＋ Programar en este día</button>`;
    const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    body.querySelector('#midiaCalTitle').textContent=`${monthNames[navCalendarView.getMonth()]} ${navCalendarView.getFullYear()}`;
    const grid=body.querySelector('#midiaCalGrid');
    const first=new Date(navCalendarView.getFullYear(),navCalendarView.getMonth(),1);
    const start=first.getDay();
    const days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
    const prevDays=new Date(first.getFullYear(),first.getMonth(),0).getDate();
    const taskDates=new Set(navTasks().filter(t=>!t.done).map(t=>navIso(new Date(t.when))));
    for(let i=0;i<42;i++){
      let d,muted=false;
      if(i<start){d=new Date(first.getFullYear(),first.getMonth()-1,prevDays-start+i+1);muted=true}
      else if(i>=start+days){d=new Date(first.getFullYear(),first.getMonth()+1,i-(start+days)+1);muted=true}
      else d=new Date(first.getFullYear(),first.getMonth(),i-start+1);
      const b=document.createElement('button');b.type='button';b.className='midia-calendar-day';b.textContent=d.getDate();
      if(muted)b.classList.add('muted');
      if(navIso(d)===navIso(new Date()))b.classList.add('today');
      if(navIso(d)===navIso(navCalendarSelected))b.classList.add('active');
      if(taskDates.has(navIso(d)))b.classList.add('has-task');
      b.onclick=()=>{navCalendarSelected=d;renderCalendarOverview()};
      grid.appendChild(b);
    }
    body.querySelector('#midiaCalSelected').textContent=navDateFmt.format(navCalendarSelected);
    const dayList=body.querySelector('#midiaCalDayList');
    const selectedTasks=navTasks().filter(t=>!t.done && navIso(new Date(t.when))===navIso(navCalendarSelected)).sort((a,b)=>new Date(a.when)-new Date(b.when));
    if(!selectedTasks.length)dayList.innerHTML='<div class="midia-nav-empty small">Sin tareas para este día.</div>';
    selectedTasks.forEach(t=>{
      const row=document.createElement('div');row.className='midia-nav-item simple';
      row.innerHTML='<div class="midia-nav-item-main"><strong></strong><span></span></div>';
      row.querySelector('strong').textContent=t.title||'Tarea';
      row.querySelector('span').textContent=`${navTimeFmt.format(new Date(t.when))} · ${navRepeat(t)}`;
      dayList.appendChild(row);
    });
    body.querySelector('#midiaCalPrev').onclick=()=>{navCalendarView=new Date(navCalendarView.getFullYear(),navCalendarView.getMonth()-1,1);renderCalendarOverview()};
    body.querySelector('#midiaCalNext').onclick=()=>{navCalendarView=new Date(navCalendarView.getFullYear(),navCalendarView.getMonth()+1,1);renderCalendarOverview()};
    body.querySelector('#midiaCalNew').onclick=()=>{const chosen=navIso(navCalendarSelected);dlg.close();document.querySelector('#newBtn')?.click();setTimeout(()=>{try{if(typeof setDateValue==='function')setDateValue(chosen)}catch{}},20)};
    return dlg;
  }

  function renderGoals(){
    const dlg=ensureNavShell('midiaGoalsDialog','Metas','PROGRESO DEL DÍA');
    const body=dlg.querySelector('.midia-nav-body');
    const all=navTasks();const today=navIso(new Date());
    const doneToday=all.filter(t=>t.done && navIso(new Date(t.when))===today).length;
    const pendingToday=all.filter(t=>!t.done && navIso(new Date(t.when))===today).length;
    let goal=Math.max(1,Math.min(20,Number(localStorage.getItem('midia.dailyGoal')||3)));
    const pct=Math.min(100,Math.round(doneToday/goal*100));
    body.innerHTML=`<div class="midia-goal-card"><div class="midia-goal-ring" style="--goal:${pct}%"><div><strong>${pct}%</strong><span>cumplido</span></div></div><div><span class="midia-mini-label">Meta diaria</span><h3 id="midiaGoalText">${goal} tareas</h3><div class="midia-goal-stepper"><button id="midiaGoalMinus" type="button">−</button><strong id="midiaGoalValue">${goal}</strong><button id="midiaGoalPlus" type="button">＋</button></div></div></div>
      <div class="midia-nav-stats"><div><span>Completadas hoy</span><strong>${doneToday}</strong></div><div><span>Pendientes hoy</span><strong>${pendingToday}</strong></div><div><span>Total activas</span><strong>${all.filter(t=>!t.done).length}</strong></div></div>
      <div class="midia-goal-note">La meta diaria se guarda en este dispositivo y puedes ajustarla entre 1 y 20 tareas.</div>`;
    const updateGoal=(n)=>{goal=Math.max(1,Math.min(20,n));localStorage.setItem('midia.dailyGoal',String(goal));renderGoals()};
    body.querySelector('#midiaGoalMinus').onclick=()=>updateGoal(goal-1);
    body.querySelector('#midiaGoalPlus').onclick=()=>updateGoal(goal+1);
    return dlg;
  }

  function applyThemeChoice(mode){
    const valid=['system','light','dark'];
    if(!valid.includes(mode))mode='system';
    const sel=document.querySelector('#themeMode');
    if(sel)sel.value=mode;
    // Cambio directo y persistente; no depende de que el select oculto dispare un evento.
    if(typeof applyTheme==='function'){
      try{applyTheme(mode)}catch{}
    }else{
      document.documentElement.dataset.theme=mode;
      localStorage.setItem('midia.theme',mode);
      const prefersDark=window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      const effective=mode==='system'?(prefersDark?'dark':'light'):mode;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content',effective==='light'?'#eaf6ff':'#06111b');
    }
    localStorage.setItem('midia.theme',mode);
    document.documentElement.dataset.theme=mode;
    document.querySelectorAll('[data-midia-theme]').forEach(b=>b.classList.toggle('active',b.dataset.midiaTheme===mode));
  }
  function renderMore(){
    const dlg=ensureNavShell('midiaMoreDialog','Más','CONFIGURACIÓN RÁPIDA');
    const body=dlg.querySelector('.midia-nav-body');
    const current=localStorage.getItem('midia.theme')||'system';
    body.innerHTML=`<button id="midiaMoreNew" class="midia-more-row" type="button"><span>＋</span><div><strong>Nueva tarea</strong><small>Programa un recordatorio</small></div></button>
      <div class="midia-more-section" id="midiaAppearanceSection"><span class="midia-mini-label">Apariencia</span><div class="midia-theme-segment"><button type="button" data-midia-theme="system">Sistema</button><button type="button" data-midia-theme="light">Claro</button><button type="button" data-midia-theme="dark">Oscuro</button></div></div>
      <button id="midiaMoreAlerts" class="midia-more-row" type="button"><span>🔔</span><div><strong>Centro de avisos</strong><small>Sonido, vibración y recordatorios</small></div></button>
      <button id="midiaMoreUpdate" class="midia-more-row" type="button"><span>↻</span><div><strong>Actualizar Mi Día</strong><small>Buscar la versión más reciente</small></div></button>
      <div class="midia-version">Mi Día v1.4p · Navegación y tema corregidos</div>`;
    body.querySelectorAll('[data-midia-theme]').forEach(b=>{b.classList.toggle('active',b.dataset.midiaTheme===current);b.onclick=()=>applyThemeChoice(b.dataset.midiaTheme)});
    body.querySelector('#midiaMoreNew').onclick=()=>{dlg.close();document.querySelector('#newBtn')?.click()};
    body.querySelector('#midiaMoreAlerts').onclick=()=>{dlg.close();openCenter()};
    body.querySelector('#midiaMoreUpdate').onclick=()=>{const u=document.querySelector('#updateBtn');if(u&&!u.hidden){dlg.close();u.click()}else{try{navigator.serviceWorker?.getRegistration()?.then(r=>r?.update())}catch{};body.querySelector('#midiaMoreUpdate small').textContent='Buscando actualización…';setTimeout(()=>{body.querySelector('#midiaMoreUpdate small').textContent='Ya tienes la versión disponible más reciente'},900)}};
    return dlg;
  }

  function openMoreToAppearance(){
    const dlg=renderMore();setDockActive('more');if(!dlg.open)dlg.showModal();setTimeout(()=>dlg.querySelector('#midiaAppearanceSection')?.scrollIntoView({behavior:'smooth',block:'center'}),50);
  }

  // Botón compacto de apariencia en la cabecera: recupera Sistema / Claro / Oscuro sin saturar la barra.
  if(topActions && !document.querySelector('#midiaThemeQuick')){
    const themeBtn=document.createElement('button');themeBtn.id='midiaThemeQuick';themeBtn.type='button';themeBtn.className='ghost midia-theme-quick';themeBtn.setAttribute('aria-label','Apariencia: Sistema, Claro u Oscuro');themeBtn.textContent='◐';themeBtn.onclick=openMoreToAppearance;
    const bell=document.querySelector('#requestNotificationsMobile');
    if(bell)topActions.insertBefore(themeBtn,bell);else topActions.insertBefore(themeBtn,topActions.firstChild);
  }

  // Delegación: funciona aunque la barra inferior se pinte después de cargar el script.
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.mobile-dock button[data-dock]');
    if(!btn)return;
    const action=btn.dataset.dock;
    setDockActive(action);
    if(action==='programmed'){const d=renderProgrammed();if(!d.open)d.showModal();return}
    if(action==='calendar'){const d=renderCalendarOverview();if(!d.open)d.showModal();return}
    if(action==='alarms'){openCenter();return}
    if(action==='goals'){const d=renderGoals();if(!d.open)d.showModal();return}
    if(action==='more'){const d=renderMore();if(!d.open)d.showModal();return}
  },{passive:false});

  syncTimeLabelV14();
  syncSoundLabelV14();

})();
