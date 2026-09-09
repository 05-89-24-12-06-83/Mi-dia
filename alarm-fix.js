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
      window.vibrateWith(pattern);

      const sent=await androidVibrationNotification({
        title:'Mi Día',
        body:'Prueba de vibración',
        pattern,
        tag:'mi-dia-vibration-test',
        requireInteraction:false,
        autoClose:true
      });

      if(!sent){
        alert('Android no permitió ejecutar la prueba de vibración mediante notificación.');
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
    if('Notification' in window && Notification.permission==='default'){
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
      activeAlarmId=t.id;
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

      if(Notification.permission==='granted'){
        try{
          const reg=await readyRegistration();
          const options={
            body:t.notes||'Es hora de esta función.',
            icon:'Icons/icon-192.png',
            badge:'Icons/icon-192.png',
            tag:`mi-dia-task-${t.id}`,
            renotify:true,
            requireInteraction:true,
            silent:quiet || !t.sound,
            timestamp:Date.now()
          };

          if(t.vibrate && !quiet){
            options.vibrate=NOTIFICATION_PATTERNS[t.vibrationPattern]||NOTIFICATION_PATTERNS.standard;
          }

          await reg.showNotification(t.title||'Mi Día',options);
        }catch(err){
          console.error('Mi Día alarm notification:',err);
        }
      }
    };
  }

  ['#alarmDone','#alarmSnooze'].forEach(sel=>{
    document.querySelector(sel)?.addEventListener('click',()=>{
      try{navigator.vibrate?.(0)}catch{}
    },{capture:true});
  });

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
      renderCenter();
    }
  });

  window.addEventListener('focus',()=>{
    if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
    renderCenter();
  });
})();
