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

  function updateAvisosButton(){
    const mobile=document.querySelector('#requestNotificationsMobile');
    if(!mobile)return;
    const active='Notification' in window && Notification.permission==='granted';
    mobile.textContent=active?'🔔 Activos':'🔔 Avisos';
    mobile.dataset.active=active?'true':'false';
  }

  async function enableNotifications(){
    await unlockAudio();
    if(!('Notification' in window)){
      alert('Este dispositivo no admite notificaciones web.');
      return false;
    }
    if(Notification.permission==='granted'){
      updateAvisosButton();
      return true;
    }
    if(Notification.permission==='denied'){
      alert('Activa las notificaciones desde Ajustes > Mi Día > Notificaciones.');
      return false;
    }
    await Notification.requestPermission();
    if(typeof updateNotifStatus==='function')updateNotifStatus();
    updateAvisosButton();
    return Notification.permission==='granted';
  }

  const activate=document.querySelector('#requestNotifications');
  if(activate)activate.onclick=enableNotifications;

  const topActions=document.querySelector('.top-actions');
  if(topActions && !document.querySelector('#requestNotificationsMobile')){
    const mobileBtn=document.createElement('button');
    mobileBtn.id='requestNotificationsMobile';
    mobileBtn.type='button';
    mobileBtn.className='ghost';
    mobileBtn.onclick=enableNotifications;
    topActions.insertBefore(mobileBtn,topActions.firstChild);

    const style=document.createElement('style');
    style.textContent=`
      #requestNotificationsMobile{display:none;border:1px solid var(--line);padding:8px 10px;white-space:nowrap}
      #requestNotificationsMobile[data-active="true"]{border-color:#1d765d;color:#7ff0c5}
      @media(max-width:900px){#requestNotificationsMobile{display:inline-flex;align-items:center;justify-content:center}}
      @media(max-width:560px){#requestNotificationsMobile{font-size:.76rem;padding:7px 8px}.top-actions{gap:5px}}
    `;
    document.head.appendChild(style);
  }
  updateAvisosButton();

  if(typeof showAlarm==='function'){
    showAlarm=async function(t){
      activeAlarmId=t.id;
      $('#alarmTitle').textContent=t.title;
      $('#alarmNote').textContent=t.notes||'Tienes una función programada.';
      $('#alarmSoundState').textContent=t.sound?`🔊 ${soundName(t.soundType)} · ${t.volume}%`:'🔕 Sin sonido';
      $('#alarmVibrationState').textContent=t.vibrate?`📳 Vibración: ${t.vibrationPattern}`:'📴 Sin vibración';

      if(!alarmDialog.open)alarmDialog.showModal();

      if(t.sound){
        await window.playMelody(t.soundType,t.volume);
        if(alarmTimer)clearInterval(alarmTimer);
        alarmTimer=setInterval(()=>window.playMelody(t.soundType,t.volume),5000);
      }

      if(t.vibrate){
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
            silent:false,
            timestamp:Date.now()
          };

          if(t.vibrate){
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
      updateAvisosButton();
    }
  });

  window.addEventListener('focus',()=>{
    if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
    updateAvisosButton();
  });
})();
