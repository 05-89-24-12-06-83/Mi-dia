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

  // Doble sonido aprobado.
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

  const prime=()=>{unlockAudio()};
  ['pointerdown','touchstart','keydown'].forEach(evt=>{
    document.addEventListener(evt,prime,{once:true,passive:true,capture:true});
  });

  document.querySelector('#taskForm')?.addEventListener('submit',()=>{unlockAudio()},{capture:true});

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
    previewVibration.onclick=()=>{
      window.vibrateWith(document.querySelector('#vibrationPattern')?.value);
    };
  }

  const alarmDialog=document.querySelector('#alarmDialog');
  if(alarmDialog){
    const observer=new MutationObserver(()=>{
      if(alarmDialog.open)window.vibrateWith('alarm');
      else{try{navigator.vibrate?.(0)}catch{}}
    });
    observer.observe(alarmDialog,{attributes:true,attributeFilter:['open']});
  }

  function updateAvisosButton(){
    const mobile=document.querySelector('#requestNotificationsMobile');
    if(!mobile)return;
    if('Notification' in window && Notification.permission==='granted'){
      mobile.textContent='🔔 Activos';
      mobile.title='Notificaciones activas';
      mobile.dataset.active='true';
    }else{
      mobile.textContent='🔔 Avisos';
      mobile.title='Activar avisos';
      mobile.dataset.active='false';
    }
  }

  async function enableNotifications(){
    await unlockAudio();

    if(!('Notification' in window)){
      alert('Este dispositivo no admite notificaciones web.');
      return false;
    }

    // Si ya están activas, no genera otra notificación ni mensaje de prueba.
    if(Notification.permission==='granted'){
      localStorage.setItem('midia.notifications.enabled','1');
      if(typeof updateNotifStatus==='function')updateNotifStatus();
      updateAvisosButton();
      return true;
    }

    if(Notification.permission==='denied'){
      alert('Las notificaciones están bloqueadas en Android. Actívalas desde Ajustes > Mi Día > Notificaciones.');
      updateAvisosButton();
      return false;
    }

    const permission=await Notification.requestPermission();
    if(typeof updateNotifStatus==='function')updateNotifStatus();

    if(permission==='granted'){
      localStorage.setItem('midia.notifications.enabled','1');
      updateAvisosButton();
      return true;
    }

    updateAvisosButton();
    return false;
  }

  const activate=document.querySelector('#requestNotifications');
  if(activate)activate.onclick=enableNotifications;

  const topActions=document.querySelector('.top-actions');
  if(topActions && !document.querySelector('#requestNotificationsMobile')){
    const mobileBtn=document.createElement('button');
    mobileBtn.id='requestNotificationsMobile';
    mobileBtn.type='button';
    mobileBtn.className='ghost';
    mobileBtn.setAttribute('aria-label','Activar avisos');
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

  // No crea una segunda notificación para la alarma real.
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
