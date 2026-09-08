(()=>{
  const AC=window.AudioContext||window.webkitAudioContext;
  let audioCtx=null;
  const PATTERNS={
    standard:[250,120,250],
    short:[180],
    double:[180,100,180],
    triple:[160,90,160,90,160],
    long:[700]
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

      // Pulso casi inaudible: desbloquea Web Audio desde una interacción del usuario.
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

  // Sustituye el motor anterior, que creaba un AudioContext nuevo al vencer la alarma.
  // En Android/Chrome eso suele quedar bloqueado por la política de reproducción automática.
  window.playMelody=async function(type='soft-bell',volume=70){
    try{
      const ctx=ensureAudio();
      if(!ctx)return false;
      if(ctx.state==='suspended')await ctx.resume();
      if(ctx.state!=='running')return false;

      const v=Math.max(0,Math.min(100,Number(volume)))/100*.34;
      const t=ctx.currentTime+.02;

      if(type==='classic'){
        tone(ctx,880,t,.22,v,'square');
        tone(ctx,660,t+.3,.22,v,'square');
        tone(ctx,880,t+.6,.28,v,'square');
      }else if(type==='digital'){
        [1046,1318,1567].forEach((f,i)=>tone(ctx,f,t+i*.16,.12,v,'square'));
      }else if(type==='piano'){
        [523,659,784].forEach((f,i)=>tone(ctx,f,t+i*.22,.5,v,'triangle'));
      }else if(type==='nature'){
        [880,1175,988,1318].forEach((f,i)=>tone(ctx,f,t+i*.18,.16,v*.75,'sine'));
      }else if(type==='sea'){
        [392,440,392,349].forEach((f,i)=>tone(ctx,f,t+i*.28,.35,v*.8,'sine'));
      }else if(type==='modern'){
        tone(ctx,740,t,.16,v,'triangle');
        tone(ctx,988,t+.18,.22,v,'triangle');
      }else if(type==='friendly'){
        [659,784,988].forEach((f,i)=>tone(ctx,f,t+i*.2,.28,v*.85,'sine'));
      }else{
        tone(ctx,880,t,.45,v,'sine');
        tone(ctx,1320,t+.12,.7,v*.6,'sine');
      }
      return true;
    }catch{
      return false;
    }
  };

  window.vibrateWith=function(pattern='standard'){
    try{
      if(!('vibrate' in navigator))return false;
      return navigator.vibrate(PATTERNS[pattern]||PATTERNS.standard);
    }catch{
      return false;
    }
  };

  // Desbloquea audio en la primera interacción real dentro de la PWA.
  const prime=()=>{ unlockAudio(); };
  ['pointerdown','touchstart','keydown'].forEach(evt=>{
    document.addEventListener(evt,prime,{once:true,passive:true,capture:true});
  });

  // Guardar una alarma también cuenta como interacción y deja el motor de audio listo.
  const form=document.querySelector('#taskForm');
  form?.addEventListener('submit',()=>{ unlockAudio(); },{capture:true});

  // Pruebas manuales.
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

  // "Activar avisos" ahora también activa audio/vibración y usa la ruta correcta del icono.
  const activate=document.querySelector('#requestNotifications');
  if(activate){
    activate.onclick=async()=>{
      await unlockAudio();
      window.vibrateWith('double');

      if(!('Notification' in window)){
        alert('Este dispositivo no admite notificaciones web.');
        return;
      }

      const p=await Notification.requestPermission();
      if(typeof updateNotifStatus==='function')updateNotifStatus();

      if(p==='granted'){
        try{
          const reg=await navigator.serviceWorker.ready;
          await reg.showNotification('Mi Día',{
            body:'Avisos activados correctamente.',
            icon:'Icons/icon-192.png',
            badge:'Icons/icon-192.png',
            silent:false,
            vibrate:PATTERNS.double
          });
        }catch{}
      }
    };
  }

  // Si Android suspende el contexto mientras la app está en segundo plano,
  // intenta reanudarlo al volver a primer plano.
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && audioCtx?.state==='suspended'){
      audioCtx.resume().catch(()=>{});
    }
  });
  window.addEventListener('focus',()=>{
    if(audioCtx?.state==='suspended'){
      audioCtx.resume().catch(()=>{});
    }
  });
})();
