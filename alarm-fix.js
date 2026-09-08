(()=>{
  const AC=window.AudioContext||window.webkitAudioContext;
  let audioCtx=null;

  const PATTERNS={
    standard:[400,150,400],
    short:[300],
    double:[350,120,350],
    triple:[250,100,250,100,250],
    long:[1000],
    alarm:[500,150,500,150,800]
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
      const seq=PATTERNS[pattern]||PATTERNS.standard;
      navigator.vibrate(0);
      setTimeout(()=>navigator.vibrate(seq),40);
      return true;
    }catch{
      return false;
    }
  };

  function showToast(message,ok=true){
    let t=document.querySelector('#miDiaDiagToast');
    if(!t){
      t=document.createElement('div');
      t.id='miDiaDiagToast';
      Object.assign(t.style,{
        position:'fixed',left:'50%',bottom:'28px',transform:'translateX(-50%)',
        zIndex:'99999',maxWidth:'90vw',padding:'12px 16px',borderRadius:'14px',
        fontWeight:'700',fontSize:'14px',boxShadow:'0 12px 32px rgba(0,0,0,.35)'
      });
      document.body.appendChild(t);
    }
    t.textContent=message;
    t.style.background=ok?'#0d2f27':'#44202a';
    t.style.color=ok?'#7ff0c5':'#ffb3c1';
    t.style.border=ok?'1px solid #1d765d':'1px solid #8b3a4c';
    t.hidden=false;
    clearTimeout(t._hide);
    t._hide=setTimeout(()=>t.hidden=true,5000);
  }

  async function getReadyRegistration(){
    if(!('serviceWorker' in navigator))throw new Error('Service Worker no compatible');
    let reg=await navigator.serviceWorker.getRegistration();
    if(!reg)reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
    // navigator.serviceWorker.ready resuelve cuando existe un worker activo.
    return await navigator.serviceWorker.ready;
  }

  async function publishTestNotification(){
    try{
      showToast('Comprobando notificaciones…');
      if(!('Notification' in window))throw new Error('Este dispositivo no admite Notification API');

      let permission=Notification.permission;
      if(permission!=='granted'){
        permission=await Notification.requestPermission();
      }
      if(permission!=='granted'){
        throw new Error(permission==='denied'?'Permiso de notificaciones bloqueado':'Permiso no concedido');
      }

      const reg=await getReadyRegistration();
      if(typeof reg.showNotification!=='function'){
        throw new Error('showNotification no está disponible');
      }

      // Prueba mínima: sin icono, badge, vibración ni otras opciones.
      // Así aislamos cualquier rechazo causado por opciones no compatibles.
      const tag='mi-dia-test-'+Date.now();
      await reg.showNotification('Mi Día',{
        body:'Notificación de prueba. Si ves esto, los avisos ya funcionan.',
        tag,
        requireInteraction:true
      });

      // Verificación interna: el navegador debe poder recuperar la notificación activa.
      await new Promise(r=>setTimeout(r,350));
      let active=[];
      try{active=await reg.getNotifications({tag})}catch{}
      if(active.length){
        showToast('✓ Notificación publicada. Revisa la barra superior.');
      }else{
        showToast('La API aceptó el aviso, pero Android no lo muestra.',false);
      }
      return true;
    }catch(err){
      console.error('Mi Día notification diagnostic:',err);
      showToast('Avisos: '+(err?.message||String(err)),false);
      alert('Mi Día no pudo publicar la notificación.\n\nDetalle: '+(err?.message||String(err)));
      return false;
    }
  }

  // Desbloqueo de audio.
  const prime=()=>{ unlockAudio(); };
  ['pointerdown','touchstart','keydown'].forEach(evt=>{
    document.addEventListener(evt,prime,{once:true,passive:true,capture:true});
  });
  document.querySelector('#taskForm')?.addEventListener('submit',()=>{ unlockAudio(); },{capture:true});

  // Prueba de sonido.
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

  // Prueba de vibración.
  const previewVibration=document.querySelector('#previewVibration');
  if(previewVibration){
    previewVibration.onclick=()=>{
      const ok=window.vibrateWith(document.querySelector('#vibrationPattern')?.value);
      showToast(ok?'Orden de vibración enviada':'Vibración web no compatible',ok);
    };
  }

  // Al abrir el cuadro de alarma.
  const alarmDialog=document.querySelector('#alarmDialog');
  if(alarmDialog){
    const observer=new MutationObserver(()=>{
      if(alarmDialog.open)window.vibrateWith('alarm');
      else{try{navigator.vibrate?.(0)}catch{}}
    });
    observer.observe(alarmDialog,{attributes:true,attributeFilter:['open']});
  }

  // Reemplaza el flujo anterior: no silencia errores.
  const activate=document.querySelector('#requestNotifications');
  if(activate){
    activate.onclick=async()=>{
      await unlockAudio();
      await publishTestNotification();
    };
  }

  // Botón visible en móvil.
  const topActions=document.querySelector('.top-actions');
  if(topActions && !document.querySelector('#requestNotificationsMobile')){
    const mobileBtn=document.createElement('button');
    mobileBtn.id='requestNotificationsMobile';
    mobileBtn.type='button';
    mobileBtn.className='ghost';
    mobileBtn.textContent='🔔 Avisos';
    mobileBtn.setAttribute('aria-label','Probar notificación');
    mobileBtn.title='Probar notificación';
    mobileBtn.onclick=()=>publishTestNotification();
    topActions.insertBefore(mobileBtn,topActions.firstChild);

    const style=document.createElement('style');
    style.textContent=`
      #requestNotificationsMobile{display:none;border:1px solid var(--line);padding:8px 10px;white-space:nowrap}
      @media(max-width:900px){#requestNotificationsMobile{display:inline-flex;align-items:center;justify-content:center}}
      @media(max-width:560px){#requestNotificationsMobile{font-size:.76rem;padding:7px 8px}.top-actions{gap:5px}}
    `;
    document.head.appendChild(style);
  }

  // Corrige también la publicación de la alarma real sin depender de iconos.
  const originalShowAlarm=window.showAlarm;
  // showAlarm está declarado con function en app.js y es accesible globalmente en script clásico.
  if(typeof showAlarm==='function'){
    const baseShowAlarm=showAlarm;
    window.showAlarm=async function(t){
      await baseShowAlarm(t);
      try{
        if(Notification.permission==='granted'){
          const reg=await getReadyRegistration();
          await reg.showNotification(t.title||'Mi Día',{
            body:t.notes||'Es hora de esta función.',
            tag:'task-'+t.id,
            requireInteraction:true
          });
        }
      }catch(err){
        console.error('Mi Día alarm notification:',err);
      }
    };
  }

  ['#alarmDone','#alarmSnooze'].forEach(sel=>{
    document.querySelector(sel)?.addEventListener('click',()=>{
      try{navigator.vibrate?.(0)}catch{}
    },{capture:true});
  });

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
  });
  window.addEventListener('focus',()=>{
    if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
  });
})();
