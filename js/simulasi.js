/* simulasi.js — logika simulasi fusion splicing (alat, langkah, splicer, heater, OTDR, suara). */
(() => {
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const IMG = 'img/alat/';                       // folder gambar alat (relatif terhadap simulasi.html)

  const TOOLS = [
  {id:'gloves',        emoji:'🧤', img:IMG + 'safety-gloves.png',   label:'Sarung tangan',    side:'L'},
  {id:'strip_jacket',  emoji:'🔧', img:IMG + 'stripper.png',  label:'Pengupas kabel',   side:'L'},
  {id:'clean',         emoji:'🧻', img:IMG + 'tissue.png',    label:'Tisu alkohol',     side:'L'},
  {id:'strip_coating', emoji:'🪛', img:IMG + 'stripperkuning.png',    label:'Miller serat',     side:'L'},
  {id:'cleave',        emoji:'✂️', img:IMG + 'cleaver.png',   label:'Fiber cleaver',    side:'L'},
  {id:'sleeve',        emoji:'🛡️', img:IMG + 'sleeve.png',          label:'Sleeve pelindung', side:'R'},
  {id:'splice',        emoji:'🖥️', img:IMG + 'fusionsplicing.png',  label:'Fusion splicer',   side:'R'},
  {id:'heat',          emoji:'🔥', img:IMG + 'heater.png',          label:'Heater',           side:'R'},
  {id:'test',          emoji:'📟', img:IMG + 'otdr.png',            label:'OTDR / tester',    side:'R'}
];
  const STEPS = [
    {id:'gloves',        short:'Sarung tangan', title:'Pakai sarung tangan',        desc:'Seret sarung tangan ke area kerja sebelum menyentuh serat.', log:'Sarung tangan terpasang. Serat aman dipegang.'},
    {id:'strip_jacket',  short:'Kupas jaket',   title:'Kupas jaket luar kabel',     desc:'Seret pengupas kabel ke area kerja, lalu seret pengupas ke ujung kabel kiri dan kanan agar jaket luarnya terkupas 3 cm.', log:'Jaket luar terkupas 30 mm. Serat berlapis coating oranye terlihat, masih ada gel di permukaannya.'},
    {id:'clean',         short:'Bersihkan',     title:'Bersihkan serat dengan alkohol', desc:'Seret tisu alkohol ke area kerja, lalu seret tisu ke serat kiri dan kanan untuk mengangkat gel dan kotoran.', log:'Gel dan kotoran terangkat. Serat bersih.'},
    {id:'strip_coating', short:'Kupas coating', title:'Kupas coating serat',        desc:'Seret miller ke area kerja, lalu seret miller ke ujung serat kiri dan kanan untuk mengupas coating hingga cladding kaca terlihat.', log:'Coating terkupas. Cladding kaca bening sepanjang 15 mm terbuka.'},
    {id:'cleave',        short:'Potong',        title:'Potong dengan fiber cleaver', desc:'Seret fiber cleaver ke area kerja, lalu seret kedua kabel ke dalam cleaver agar ujung serat terpotong rata (sudut potong mendekati 0°).', log:'Ujung serat terpotong rata. Sisa potongan kaca jatuh. Serat siap disambung.'},
    {id:'sleeve',        short:'Sleeve',        title:'Pasang sleeve pelindung',    desc:'Seret sleeve ke area kerja. Sleeve harus dipasang sebelum serat disambung.', log:'Sleeve terpasang di kabel, belum di titik sambungan.'},
    {id:'splice',        short:'Fusion',        title:'Jalankan fusion splicer',    desc:'Seret fusion splicer ke area kerja, lalu operasikan mesinnya.', log:'Kedua ujung serat melebur menjadi satu. Sleeve kini bisa digeser ke titik sambungan.'},
    {id:'heat',          short:'Geser & heat',  title:'Geser sleeve, lalu panaskan', desc:'Seret sleeve ke tengah tepat di atas sambungan, lalu seret heater ke area kerja.', log:'Sleeve menyusut dan melindungi titik sambungan.'},
    {id:'test',          short:'Uji',           title:'Ukur redaman sambungan',     desc:'Pilih OTDR / tester. Kabel akan diperkecil, alat OTDR muncul di kiri dan kanan, lalu pengujian berjalan otomatis.', log:''}
  ];
  const FX = {
  sleeve:[[IMG + 'sleeve.png','🛡️',24,47]],
};
  const INTRO = 'Seret alat ke area kerja hijau, atau ketuk alat lalu ketuk area kerja.';

  const st = {step:0, selected:null, busy:false, loss:null};
  const bench = $('bench');

  /* ---------- efek suara (disintesis, tanpa file) ---------- */
  const SFX = (() => {
    let ctx = null, master = null, muted = false, nbuf = null;
    try { muted = localStorage.getItem('sfxMuted') === '1'; } catch(_) {}

    function init(){
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : .8;          // ubah .8 untuk volume keseluruhan
      master.connect(ctx.destination);
    }
    // browser hanya mengizinkan suara setelah interaksi pertama
    ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, init, {passive:true}));

    function tone(freq, dur, o = {}){
      const {type = 'sine', vol = .2, at = 0, to = null, attack = .005} = o;
      const t = ctx.currentTime + at, osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      osc.connect(g).connect(master); osc.start(t); osc.stop(t + dur + .03);
    }
    function noise(dur, o = {}){
      const {type = 'bandpass', f = 2000, f2 = null, q = 1, vol = .2, at = 0, attack = .005} = o;
      if (!nbuf) {
        nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = ctx.currentTime + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nbuf; s.loop = true;
      fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(fl).connect(g).connect(master); s.start(t); s.stop(t + dur + .03);
    }

    const S = {
      pick:  () => tone(520, .09, {type:'triangle', vol:.12, to:720}),
      error: () => { tone(200, .16, {type:'square', vol:.08}); tone(150, .22, {type:'square', vol:.08, at:.13}); },
      done:  () => { tone(660, .16, {vol:.15}); tone(880, .28, {vol:.15, at:.09}); },
      finish:() => [523, 659, 784, 1047].forEach((f, i) => tone(f, .4, {vol:.15, at:i * .11})),
      gloves:() => [0, .4, .8].forEach(a => noise(.32, {f:1400, f2:500, q:.6, vol:.14, at:a, attack:.06})),
      strip: () => { noise(.05, {type:'highpass', f:3000, vol:.3}); noise(.25, {f:900, f2:300, vol:.2, at:.04}); },
      mill:  () => { noise(.45, {f:2600, f2:1400, q:.8, vol:.16, attack:.05}); S.strip(); },
      wipe:  () => { for (let i = 0; i < 6; i++) noise(.2, {f:3500, q:.6, vol:.12, at:i * .21, attack:.04}); },
      slide: () => noise(.35, {type:'lowpass', f:700, f2:250, vol:.14, attack:.05}),
      cleave:() => { noise(.03, {type:'highpass', f:5000, vol:.4}); tone(2400, .08, {vol:.1, to:1800, at:.02});
                     tone(3200, .15, {vol:.05, at:.22}); tone(4100, .12, {vol:.04, at:.32}); },
      snap:  () => { tone(900, .05, {type:'square', vol:.09}); noise(.04, {type:'highpass', f:3000, vol:.2}); },
      sleeve:() => { tone(300, .16, {type:'triangle', vol:.15, to:450}); noise(.12, {type:'lowpass', f:900, vol:.1}); },
      clamp: () => { S.snap(); setTimeout(() => { try { S.snap(); } catch(_) {} }, 140); },
      lid:   () => { noise(.16, {type:'lowpass', f:800, vol:.14}); tone(180, .12, {type:'triangle', vol:.12}); },
      motor: () => tone(110, .9, {type:'sawtooth', vol:.045, to:170, attack:.1}),
      arc:   () => {
        noise(.65, {type:'highpass', f:2500, vol:.3, attack:.01});
        tone(120, .65, {type:'sawtooth', vol:.08});
        for (let i = 0; i < 9; i++) noise(.03, {type:'highpass', f:4000, vol:.25, at:Math.random() * .6});
      },
      beep:  () => { tone(1000, .12, {type:'square', vol:.07}); tone(1000, .12, {type:'square', vol:.07, at:.18}); },
      heat:  () => { tone(90, 3.6, {type:'sawtooth', vol:.045, to:140, attack:.4});
                     noise(3.6, {type:'lowpass', f:450, vol:.07, attack:.5}); },
      pulse: () => tone(400, 1.3, {vol:.045, to:1200, attack:.1}),
      ping:  () => tone(1800, .45, {vol:.12})
    };

    return {
      play(name){ try { if (ctx && !muted && S[name]) S[name](); } catch(_) {} },
      toggle(){
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : .8;
        try { localStorage.setItem('sfxMuted', muted ? '1' : '0'); } catch(_) {}
      },
      get muted(){ return muted; }
    };
  })();
  const btnSound = $('btnSound');
  function paintSound(){
    btnSound.textContent = SFX.muted ? '🔇 Suara mati' : '🔊 Suara';
    btnSound.setAttribute('aria-pressed', String(!SFX.muted));
  }
  btnSound.addEventListener('click', () => { SFX.toggle(); paintSound(); SFX.play('pick'); });
  paintSound();

  /* ---------- bench drawing ---------- */
  (function drawBench(){
    let d = '', t = '';
    for (let mm = 0; mm <= 200; mm++) {
      const x = mm * 4, len = mm % 10 === 0 ? 16 : mm % 5 === 0 ? 10 : 6;
      d += `M${x} 300V${300 - len}`;
      if (mm % 10 === 0 && mm < 200) t += `<text x="${x + 3}" y="278">${mm / 10}</text>`;
    }
    $('ruler').innerHTML = `<path d="${d}" stroke="rgba(255,255,255,.55)" stroke-width="1" fill="none"/>${t}<text x="770" y="262">cm</text>`;

    const gel = [[272,133],[284,147],[296,134],[309,146],[322,133],[335,148],[348,135],[361,146],[372,133],[302,141],[344,141]]
      .map(([x,y]) => `<circle class="c-gel" cx="${x}" cy="${y}" r="${(2 + (x % 3)).toFixed(1)}"/>`).join('');
    const cable = `
      <g class="glass"><rect class="c-glass" x="100" y="137.5" width="280" height="5" rx="2.5"/></g>
      <g class="coating"><rect class="c-coat" x="100" y="134" width="280" height="12" rx="5"/></g>
      <g class="gel">${gel}</g>
      <rect class="c-shard" x="365" y="137.5" width="15" height="5"/>
      <g class="jacket">
        <rect class="c-jacket" x="-20" y="122" width="400" height="36" rx="5"/>
        <rect class="c-jacket-hi" x="-20" y="125" width="400" height="6" rx="3"/>
        <rect class="c-jacket-end" x="368" y="122" width="12" height="36" rx="3"/>
      </g>`;
    $('cableL').innerHTML = cable;
    $('cableR').innerHTML = cable;
  })();

  /* ---------- tools ---------- */
  function shuffle(a){ a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function iconHTML(t){
    return `<span class="ic"><img src="${t.img}" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode('${t.emoji}'))"></span>`;
  }
  function renderTools(){
    ['L','R'].forEach(side => {
      const box = $(side === 'L' ? 'rackL' : 'rackR');
      box.innerHTML = '';
      shuffle(TOOLS.filter(t => t.side === side)).forEach(t => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'tool'; b.id = 'tool_' + t.id;
        b.innerHTML = `${iconHTML(t)}<span class="lb">${t.label}</span>`;
        bindTool(b, t);
        box.appendChild(b);
      });
    });
  }

  function overBench(ev){
    const r = bench.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  function bindTool(el, t){
    el.addEventListener('pointerdown', e => {
      if (e.button > 0 || el.classList.contains('done')) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost = null, dragging = false;
      try { el.setPointerCapture(e.pointerId); } catch(_) {}
      const move = ev => {
        if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
          dragging = true;
          SFX.play('pick');
          ghost = document.createElement('div');
          ghost.className = 'ghost';
          ghost.innerHTML = `${iconHTML(t)}<span>${t.label}</span>`;
          document.body.appendChild(ghost);
          el.classList.add('lifted'); bench.classList.add('armed');
        }
        if (dragging) {
          ghost.style.transform = `translate(${ev.clientX}px,${ev.clientY}px) translate(-50%,-120%)`;
          bench.classList.toggle('over', overBench(ev));
        }
      };
      const end = ev => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', cancel);
        if (ghost) ghost.remove();
        el.classList.remove('lifted'); bench.classList.remove('armed', 'over');
      };
      const up = ev => { end(ev); if (dragging) { if (overBench(ev)) useTool(t.id); } else toggleSelect(t.id); };
      const cancel = ev => end(ev);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', cancel);
    });
    // keyboard: Enter / Space
    el.addEventListener('click', e => { if (e.detail === 0) toggleSelect(t.id); });
  }

  function clearSelected(){
    st.selected = null;
    document.querySelectorAll('.tool.selected').forEach(e => e.classList.remove('selected'));
  }
  function toggleSelect(id){
    const el = $('tool_' + id);
    if (el.classList.contains('done')) return;
    const was = st.selected === id;
    clearSelected();
    if (!was) { st.selected = id; el.classList.add('selected'); SFX.play('pick'); }
  }

  /* ---------- cleaver: seret kabel ---------- */
  /* GANTI CLEAVER_IMG dengan path PNG cleaver kamu, contoh: 'img/alat/cleaver.png'
     Kalau kosong / gagal dimuat, dipakai placeholder.
     CLEAVER_WIDTH  = lebar gambar (persen dari lebar area kerja)
     CLEAVER_ANCHOR = titik pada gambar yang tepat di lubang serat (persen x, y dari gambar) */
  const CLEAVER_IMG = '';
  const CLEAVER_WIDTH = 30;
  const CLEAVER_ANCHOR = [50, 50];
  const CLEAVER_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170">' + 
    '<rect x="10" y="70" width="280" height="90" rx="16" fill="#00FF66" stroke="#121816" stroke-width="4"/>' + 
    '<rect x="34" y="24" width="190" height="60" rx="12" fill="#10B981" stroke="#1E2824" stroke-width="4"/>' + 
    '<circle cx="250" cy="115" r="22" fill="#10B981" stroke="#00FF66" stroke-width="4"/>' + 
    '<rect x="0" y="80" width="70" height="10" rx="5" fill="#000000"/>' + 
    '<text x="150" y="132" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#00FF66"></text></svg>');
  /* ---------- pengupas kabel: gambar ---------- */
  /* GANTI STRIPPER_IMG dengan path PNG pengupas kamu, contoh: 'img/alat/pengupas.png'
     Kalau kosong / gagal dimuat, dipakai placeholder di bawah. */
  const STRIPPER_IMG = '';
  const STRIPPER_WIDTH = 30;
  const STRIPPER_ANCHOR = [50, 50];
  const STRIPPER_PLACEHOLDER = IMG + 'stripper.png';
  /* ---------- tisu alkohol: gambar ---------- */
  /* GANTI TISSUE_IMG dengan path PNG tisu kamu, contoh: 'img/alat/tisu.png'
     Kalau kosong / gagal dimuat, dipakai placeholder di bawah. */
  const TISSUE_IMG = '';
  const TISSUE_WIDTH = 10;
  const TISSUE_ANCHOR = [50, 50];
  const TISSUE_PLACEHOLDER = IMG + 'tissue.png';

  /* ---------- miller serat: gambar ---------- */
  /* GANTI MILLER_IMG dengan path PNG miller kamu, contoh: 'img/alat/miller.png'
     Kalau kosong / gagal dimuat, dipakai placeholder di bawah. */
  const MILLER_IMG = '';
  const MILLER_WIDTH = 26;
  const MILLER_ANCHOR = [50, 50];
  const MILLER_PLACEHOLDER = IMG + 'stripperkuning.png';

  /* ---------- OTDR / tester: 2 gambar (kiri & kanan kabel) ---------- */
  /* GANTI OTDR_L_IMG dan OTDR_R_IMG dengan path PNG buatanmu, contoh: 'img/alat/otdr-kiri.png'
     Kalau kosong / gagal dimuat, dipakai placeholder di bawah.
     Ukuran (lebar, % area kerja) diatur di CSS: .otdr-dev{width:22%} */
  const OTDR_L_IMG = '';
  const OTDR_R_IMG = '';
  const otdrSvg = (label, portRight) => 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">' +
    '<rect x="8" y="8" width="184" height="224" rx="18" fill="#26312D" stroke="#0E1412" stroke-width="5"/>' +
    '<rect x="24" y="24" width="152" height="100" rx="8" fill="#0B1F17" stroke="#00FF66" stroke-width="3"/>' +
    '<path d="M32 60 L80 66 L80 92 L168 100" fill="none" stroke="#00FF66" stroke-width="3"/>' +
    '<circle cx="46" cy="160" r="10" fill="#E8772E"/><circle cx="82" cy="160" r="10" fill="#9AA5A0"/><circle cx="118" cy="160" r="10" fill="#9AA5A0"/>' +
    '<rect x="' + (portRight ? 168 : 8) + '" y="128" width="24" height="36" rx="5" fill="#FF4D4D" stroke="#0E1412" stroke-width="3"/>' +
    '<text x="100" y="205" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#00FF66">' + label + '</text></svg>');
  const OTDR_L_PLACEHOLDER = otdrSvg('OTDR A', true);
  const OTDR_R_PLACEHOLDER = otdrSvg('OTDR B', false);
  const OTDR_SCALE = .30;                       // harus sama dengan scale di CSS .otdr-mode #benchSvg
  function setOtdrImages(){
    [['otdrDevL', OTDR_L_IMG, OTDR_L_PLACEHOLDER], ['otdrDevR', OTDR_R_IMG, OTDR_R_PLACEHOLDER]].forEach(([id, img, ph]) => {
      const el = $(id);
      el.onerror = () => { el.onerror = null; el.src = ph; };
      el.src = img || ph;
    });
  }

  /* ---------- daftar alat yang DISERET KE KABEL ----------
     Tambah entri baru di sini untuk membuat alat lain dengan pola yang sama.
       img/ph/w/anchor : gambar alat (lihat konstanta di atas)
       cutX            : titik target di tiap kabel (koordinat SVG 800x300, y = CABLE_Y)
       targetW         : lebar lingkaran target (% lebar area kerja)
       doneClass       : class yang ditambahkan ke kabel setelah diproses (dipakai CSS)
       action          : 'press' (ditekan sekali) atau 'wipe' (digosok bolak-balik)
       logDone         : teks log per kabel
       hint            : pesan bila alat dilepas di tempat yang salah */
  const TOOLCFG = {
    cleave:       {img:CLEAVER_IMG,  ph:CLEAVER_PLACEHOLDER,  w:CLEAVER_WIDTH,  anchor:CLEAVER_ANCHOR,  cutX:{L:365, R:435}, name:'Cleaver'},
    strip_jacket: {img:STRIPPER_IMG, ph:STRIPPER_PLACEHOLDER, w:STRIPPER_WIDTH, anchor:STRIPPER_ANCHOR, cutX:{L:380, R:420}, name:'Pengupas kabel',
                   drag:true, targetW:5, doneClass:'stripped', action:'press', logDone:' terkupas jaket luarnya.',
                   hint:'Arahkan pengupas ke ujung kabel (lingkaran kuning).',
                   ready:'siap. Seret pengupas ke ujung kabel kiri dan kanan (lingkaran kuning).',
                   again:'sudah di area kerja. Seret pengupas ke ujung kabel.', noun:'terkupas'},
    strip_coating:{img:MILLER_IMG,   ph:MILLER_PLACEHOLDER,   w:MILLER_WIDTH,   anchor:MILLER_ANCHOR,   cutX:{L:350, R:450}, name:'Miller serat',
                   drag:true, targetW:7, doneClass:'coated', action:'press', logDone:' terkupas coating-nya. Kaca terlihat.',
                   hint:'Arahkan miller ke ujung serat (lingkaran kuning).',
                   ready:'siap. Seret miller ke ujung serat kiri dan kanan (lingkaran kuning).',
                   again:'sudah di area kerja. Seret miller ke ujung serat.', noun:'terkupas'},
    clean:        {img:TISSUE_IMG,   ph:TISSUE_PLACEHOLDER,   w:TISSUE_WIDTH,   anchor:TISSUE_ANCHOR,   cutX:{L:320, R:480}, name:'Tisu alkohol',
                   drag:true, targetW:9, doneClass:'cleaned', action:'wipe', logDone:' dibersihkan. Gel terangkat.',
                   hint:'Arahkan tisu ke serat yang berlapis gel (lingkaran kuning).',
                   ready:'siap. Seret tisu ke serat kiri dan kanan (lingkaran kuning) untuk menggosok gel.',
                   again:'sudah di area kerja. Seret tisu ke serat.', noun:'bersih'}
  };
  const SLOT = {x:400, y:228}, SLOT_SNAP = 34, CABLE_Y = 140;
  let cableDragging = false;
  const cleaverEl = $('cleaverEl');

  function setToolImage(mode){
    const c = TOOLCFG[mode];
    cleaverEl.onerror = () => { cleaverEl.onerror = null; cleaverEl.src = c.ph; };
    cleaverEl.src = c.img || c.ph;
    cleaverEl.style.width = c.w + '%';
    cleaverEl.style.setProperty('--ax', (-c.anchor[0]) + '%');
    cleaverEl.style.setProperty('--ay', (-c.anchor[1]) + '%');
  }
  function placeCleaver(){
    cleaverEl.style.left = (SLOT.x / 8) + '%';
    cleaverEl.style.top = (SLOT.y / 3) + '%';
    setToolImage('cleave');
    $('cleaveSlot').style.left = (SLOT.x / 8) + '%';
    $('cleaveSlot').style.top = (SLOT.y / 3) + '%';
    placeTargets('strip_jacket');
  }
  function placeTargets(mode){
    const c = TOOLCFG[mode];
    ['L', 'R'].forEach(sd => {
      const t = $('stripTarget' + sd);
      t.style.left = (c.cutX[sd] / 8) + '%';
      t.style.top = (CABLE_Y / 3) + '%';
      t.style.width = (c.targetW || 5) + '%';
    });
  }

  function startCleave(mode){
    mode = mode || 'cleave';
    const c = TOOLCFG[mode];
    if (st.cleaving) { toast('info', c.name + ' ' + (c.drag ? c.again : 'sudah di area kerja. Seret kabel ke lingkaran kuning.')); return; }
    st.cleaving = true; st.mode = mode; st.cut = {L:false, R:false}; st.cutting = false;
    ['dragL', 'dragR'].forEach(id => $(id).classList.remove('handled'));
    ['stripTargetL', 'stripTargetR'].forEach(id => $(id).classList.remove('handled'));
    setToolImage(mode);
    cleaverEl.style.setProperty('--dx', '0px'); cleaverEl.style.setProperty('--dy', '0px');
    if (c.drag) {
      placeTargets(mode);
      bench.classList.add('strip-mode');
      $('log').textContent = c.name + ' ' + c.ready;
    } else {
      bench.classList.add('cleave-mode');
      $('log').textContent = c.name + ' siap. Seret kabel kiri dan kanan ke lingkaran kuning.';
    }
    updateUI();
  }

  function svgPt(ev){
    const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const q = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    return {x:q.x, y:q.y};
  }
  function springBack(el){
    el.classList.add('drag-anim'); el.style.transform = '';
    setTimeout(() => el.classList.remove('drag-anim'), 900);
  }
  async function doCleave(side, el){
    st.cutting = true;
    const mode = st.mode, cutX = TOOLCFG[mode].cutX;
    el.classList.add('drag-anim');
    el.style.transform = `translate(${SLOT.x - cutX[side]}px,${SLOT.y - CABLE_Y}px)`;
    SFX.play('slide');
    await wait(400);
    cleaverEl.classList.remove('press'); void cleaverEl.offsetWidth; cleaverEl.classList.add('press');
    SFX.play('cleave');
    await wait(200);
    el.classList.add(mode === 'cleave' ? 'cut' : 'stripped'); el.classList.add('handled'); st.cut[side] = true;
    $('log').textContent = (side === 'L' ? 'Kabel kiri' : 'Kabel kanan') + (mode === 'cleave' ? ' terpotong. Serpihan kaca jatuh.' : ' terkupas jaket luarnya.');
    updateUI();
    await wait(1000);
    el.style.transform = '';
    await wait(950);
    el.classList.remove('drag-anim');
    st.cutting = false;
    if (st.cut.L && st.cut.R) {
      st.cleaving = false; st.mode = null;
      bench.classList.remove('cleave-mode', 'strip-mode');
      complete(mode);
    }
  }
  ['L', 'R'].forEach(side => {
    const el = $('drag' + side);
    el.addEventListener('pointerdown', e => {
      if (e.button > 0 || !st.cleaving || st.mode !== 'cleave' || st.cut[side] || st.cutting || st.busy || el.classList.contains('drag-anim')) return;
      e.preventDefault();
      const p0 = svgPt(e); let dx = 0, dy = 0, moved = false;
      try { el.setPointerCapture(e.pointerId); } catch(_) {}
      cableDragging = true; el.classList.add('grabbing');
      const move = ev => {
        const p = svgPt(ev); dx = p.x - p0.x; dy = p.y - p0.y;
        if (Math.hypot(dx, dy) > 3) moved = true;
        el.style.transform = `translate(${dx}px,${dy}px)`;
      };
      const end = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
        cableDragging = false; el.classList.remove('grabbing');
        if (moved) { justDragged = true; setTimeout(() => { justDragged = false; }, 50); }
        const d = Math.hypot(TOOLCFG[st.mode].cutX[side] + dx - SLOT.x, CABLE_Y + dy - SLOT.y);
        if (d <= SLOT_SNAP) doCleave(side, el);
        else { if (moved) toast('info', 'Arahkan ujung kabel ke lingkaran kuning di ' + TOOLCFG[st.mode].name.toLowerCase() + '.'); springBack(el); }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
  });

  /* ---------- pengupas: seret pengupas ke kabel ---------- */
  async function doStrip(side, snapX, snapY){
    st.cutting = true;
    const mode = st.mode, c = TOOLCFG[mode];
    const dragEl = $('drag' + side);
    const setD = (x, y) => { cleaverEl.style.setProperty('--dx', x + 'px'); cleaverEl.style.setProperty('--dy', y + 'px'); };
    const markDone = () => {
      dragEl.classList.add(c.doneClass, 'handled'); $('stripTarget' + side).classList.add('handled');
      st.cut[side] = true;
      $('log').textContent = (side === 'L' ? 'Kabel kiri' : 'Kabel kanan') + c.logDone;
      updateUI();
    };
    setD(snapX, snapY);
    SFX.play('slide');
    await wait(550);
    if (c.action === 'wipe') {
      const k = svgEl.getScreenCTM().a, amp = 26 * k;      // gosok bolak-balik +/- 26 satuan SVG
      cleaverEl.classList.add('wiping');
      SFX.play('wipe');
      for (let i = 0; i < 6; i++) {
        setD(snapX + (i % 2 ? amp : -amp), snapY);
        if (i === 1) markDone();                            // gel mulai memudar saat digosok
        await wait(210);
      }
      setD(snapX, snapY);
      await wait(250);
      cleaverEl.classList.remove('wiping');
    } else {
      cleaverEl.classList.remove('press'); void cleaverEl.offsetWidth; cleaverEl.classList.add('press');
      SFX.play(mode === 'strip_coating' ? 'mill' : 'strip');
      await wait(200);
      markDone();
      await wait(1000);
    }
    setD(0, 0);
    await wait(600);
    cleaverEl.classList.remove('press');
    st.cutting = false;
    if (st.cut.L && st.cut.R) {
      st.cleaving = false; st.mode = null;
      bench.classList.remove('cleave-mode', 'strip-mode');
      complete(mode);
    }
  }
  cleaverEl.addEventListener('click', e => e.stopPropagation());
  cleaverEl.addEventListener('pointerdown', e => {
    if (e.button > 0 || !st.cleaving || !(TOOLCFG[st.mode] && TOOLCFG[st.mode].drag) || st.cutting || st.busy) return;
    e.preventDefault(); e.stopPropagation();
    const ctm = svgEl.getScreenCTM(), k = ctm.a;              // px layar per satuan SVG
    const sx = e.clientX, sy = e.clientY;
    let dx = 0, dy = 0, moved = false;
    try { cleaverEl.setPointerCapture(e.pointerId); } catch(_) {}
    cableDragging = true; cleaverEl.classList.add('grabbing');
    const move = ev => {
      dx = ev.clientX - sx; dy = ev.clientY - sy;
      if (Math.hypot(dx, dy) > 3) moved = true;
      cleaverEl.style.setProperty('--dx', dx + 'px'); cleaverEl.style.setProperty('--dy', dy + 'px');
    };
    const end = () => {
      cleaverEl.removeEventListener('pointermove', move);
      cleaverEl.removeEventListener('pointerup', end);
      cleaverEl.removeEventListener('pointercancel', end);
      cableDragging = false; cleaverEl.classList.remove('grabbing');
      if (moved) { justDragged = true; setTimeout(() => { justDragged = false; }, 50); }
      // titik lubang pengupas (satuan SVG) setelah diseret
      const ax = SLOT.x + dx / k, ay = SLOT.y + dy / k;
      let best = null, bd = Infinity;
      ['L', 'R'].forEach(sd => {
        if (st.cut[sd]) return;
        const d = Math.hypot(TOOLCFG[st.mode].cutX[sd] - ax, CABLE_Y - ay);
        if (d < bd) { bd = d; best = sd; }
      });
      if (best && bd <= SLOT_SNAP) {
        doStrip(best, (TOOLCFG[st.mode].cutX[best] - SLOT.x) * k, (CABLE_Y - SLOT.y) * k);
      } else {
        if (moved) toast('info', TOOLCFG[st.mode].hint);
        cleaverEl.style.setProperty('--dx', '0px'); cleaverEl.style.setProperty('--dy', '0px');
      }
    };
    cleaverEl.addEventListener('pointermove', move);
    cleaverEl.addEventListener('pointerup', end);
    cleaverEl.addEventListener('pointercancel', end);
  });

  /* ---------- geser sleeve ---------- */
  const svgEl = $('benchSvg'), sleeveEl = $('sleeve'), JOINT_X = 400, SNAP = 30;
  let sleeveOff = 0, sleeveTarget = null, sleeveDragging = false, justDragged = false;

  function targetOff(){
    if (sleeveTarget === null) {
      const bb = sleeveEl.querySelector('.sl-shell').getBBox();
      sleeveTarget = JOINT_X - (bb.x + bb.width / 2);
    }
    return sleeveTarget;
  }
  function canSlide(){ return bench.classList.contains('can-slide') && !st.busy; }
  function svgX(ev){
    const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse()).x;
  }
  function setSleeve(off){
    sleeveOff = off;
    sleeveEl.style.transform = `translate(${off}px,0)`;
  }
  function settleSleeve(){
    const t = targetOff();
    const hit = Math.abs(sleeveOff - t) <= SNAP;
    if (hit) setSleeve(t);
    if (hit !== !!st.slid) {
      st.slid = hit;
      if (hit) SFX.play('snap');
      bench.classList.toggle('slid', hit);
      $('log').textContent = hit
        ? 'Sleeve tepat di titik sambungan. Heater sekarang bisa dipakai.'
        : 'Sleeve keluar dari titik sambungan. Geser lagi ke tengah sebelum memanaskan.';
      updateUI();
    }
  }
  sleeveEl.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    if (!canSlide()) {
      if (st.step >= 6 || bench.classList.contains('s-sleeve')) {
        if (!bench.classList.contains('s-heat')) toast('info', 'Sleeve baru bisa digeser setelah proses fusion selesai.');
      }
      return;
    }
    e.preventDefault();
    const startX = svgX(e), startOff = sleeveOff, t = targetOff();
    let moved = false;
    try { sleeveEl.setPointerCapture(e.pointerId); } catch(_) {}
    sleeveDragging = true; bench.classList.add('dragging');
    const move = ev => {
      const dx = svgX(ev) - startX;
      if (Math.abs(dx) > 3) moved = true;
      setSleeve(Math.max(0, Math.min(t + 100, startOff + dx)));
    };
    const end = () => {
      sleeveEl.removeEventListener('pointermove', move);
      sleeveEl.removeEventListener('pointerup', end);
      sleeveEl.removeEventListener('pointercancel', end);
      sleeveDragging = false; bench.classList.remove('dragging');
      if (moved) { justDragged = true; setTimeout(() => { justDragged = false; }, 50); }
      settleSleeve();
    };
    sleeveEl.addEventListener('pointermove', move);
    sleeveEl.addEventListener('pointerup', end);
    sleeveEl.addEventListener('pointercancel', end);
  });
  bench.addEventListener('touchmove', e => { if (sleeveDragging || cableDragging) e.preventDefault(); }, {passive:false});

  bench.addEventListener('click', () => {
    if (justDragged) return;
    if (st.selected) useTool(st.selected);
    else toast('info', 'Pilih alat dulu, lalu ketuk area kerja.');
  });
  bench.addEventListener('keydown', e => {
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && canSlide()) {
      e.preventDefault();
      const t = targetOff();
      setSleeve(Math.max(0, Math.min(t + 100, sleeveOff + (e.key === 'ArrowRight' ? 20 : -20))));
      settleSleeve();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bench.click(); }
  });

  /* ---------- core flow ---------- */
  function useTool(id){
    if (st.busy || st.step >= STEPS.length) return;
    clearSelected();
    const exp = STEPS[st.step];
    if ($('tool_' + id).classList.contains('done')) { toast('err', 'Alat ini sudah dipakai.'); return; }
    if (id !== exp.id) {
      toast('err', 'Bukan alat untuk langkah ini. Cek langkah saat ini di atas.');
      bench.classList.remove('shake'); void bench.offsetWidth; bench.classList.add('shake');
      return;
    }
    if (id === 'cleave' || (TOOLCFG[id] && TOOLCFG[id].drag)) return startCleave(id);
    if (id === 'splice') return openSplicer();
    if (id === 'heat') {
      if (!st.slid) {
        toast('err', 'Geser sleeve ke titik sambungan dulu. Seret sleeve di area kerja ke tengah.');
        bench.classList.remove('shake'); void bench.offsetWidth; bench.classList.add('shake');
        return;
      }
      return openHeater();
    }
    if (id === 'test') return runOtdr();
    complete(id);
  }

  function complete(id){
    bench.classList.add('s-' + id);
    if (id === 'gloves') { handFx(); SFX.play('gloves'); }
    if (id === 'sleeve') SFX.play('sleeve');
    (FX[id] || []).forEach(a => fx(...a));
    $('tool_' + id).classList.add('done');
    $('log').textContent = STEPS[st.step].log;
    if (id === 'splice') bench.classList.add('can-slide');
    if (id === 'heat') bench.classList.remove('can-slide', 'dragging');
    st.step++;
    SFX.play(st.step >= STEPS.length ? 'finish' : 'done');
    if (id === 'test') showMeter();
    updateUI();
  }

  /* ---- Animasi tangan (sarung tangan) ----
     GANTI HAND_IMG dengan path PNG tangan kamu, contoh: 'img/alat/tangan.png'
     Kalau kosong atau gagal dimuat, dipakai gambar placeholder di bawah. */
  const HAND_IMG = '';
  const HAND_PLACEHOLDER = IMG + 'safety-gloves.png';
  function handFx(){
    const img = document.createElement('img');
    img.className = 'hand-fx'; img.alt = '';
    img.onerror = () => { img.onerror = null; img.src = HAND_PLACEHOLDER; };
    img.src = HAND_IMG || HAND_PLACEHOLDER;
    $('fxlayer').appendChild(img);
    img.addEventListener('animationend', () => img.remove());
    setTimeout(() => img.remove(), 2600);
  }

  function fx(img, emoji, x, y){
  const e = document.createElement('div');
  e.className = 'fx';
  const i = document.createElement('img');
  i.alt = ''; i.draggable = false;
  i.onerror = () => { e.textContent = emoji; };
  i.src = img;
  e.appendChild(i);
  e.style.left = x + '%'; e.style.top = y + '%';
  $('fxlayer').appendChild(e);
  e.addEventListener('animationend', () => e.remove());
  setTimeout(() => e.remove(), 1500);
}

  function updateUI(){
    const total = STEPS.length, finished = st.step >= total;
    $('instr').classList.toggle('finished', finished);
    $('btnAgain').hidden = !finished;
    if (!finished) {
      const s = STEPS[st.step];
      $('instrNum').textContent = st.step + 1;
      $('instrTotal').textContent = 'dari ' + total;
      let title = s.title, desc = s.desc;
      if (s.id === 'cleave' && st.cleaving) {
        const n = (st.cut.L ? 1 : 0) + (st.cut.R ? 1 : 0);
        title = 'Seret kabel ke cleaver';
        desc = 'Seret kabel kiri dan kanan bergantian ke lingkaran kuning di cleaver agar ujung seratnya terpotong. (' + n + '/2 terpotong)';
      }
      if (s.id === 'strip_coating' && st.cleaving) {
        const n = (st.cut.L ? 1 : 0) + (st.cut.R ? 1 : 0);
        title = 'Seret miller ke serat';
        desc = 'Seret miller ke ujung serat kiri dan kanan (lingkaran kuning) agar coating terkupas. (' + n + '/2 terkupas)';
      }
      if (s.id === 'clean' && st.cleaving) {
        const n = (st.cut.L ? 1 : 0) + (st.cut.R ? 1 : 0);
        title = 'Seret tisu ke kabel';
        desc = 'Seret tisu ke serat kiri dan kanan (lingkaran kuning) untuk menggosok gel sampai bersih. (' + n + '/2 bersih)';
      }
      if (s.id === 'strip_jacket' && st.cleaving) {
        const n = (st.cut.L ? 1 : 0) + (st.cut.R ? 1 : 0);
        title = 'Seret pengupas ke kabel';
        desc = 'Seret pengupas ke ujung kabel kiri dan kanan (lingkaran kuning) agar jaket luarnya terkupas. (' + n + '/2 terkupas)';
      }
      if (s.id === 'heat') {
        if (!st.slid) { title = 'Geser sleeve ke titik sambungan'; desc = 'Seret sleeve di area kerja ke tengah, tepat di atas sambungan. Heater baru bisa dipakai setelah sleeve berada di sana.'; }
        else { title = 'Panaskan sleeve di heater'; desc = 'Sleeve sudah di titik sambungan. Seret heater ke area kerja, lalu mulai pemanasan.'; }
      }
      $('instrTitle').textContent = title;
      $('instrDesc').textContent = desc;
    } else {
      $('instrNum').textContent = '✓';
      $('instrTotal').textContent = 'selesai';
      $('instrTitle').textContent = 'Sambungan selesai';
      $('instrDesc').textContent = st.resultText || '';
    }
    [...$('rail').children].forEach((li, i) => {
      li.classList.toggle('done', i < st.step);
      li.classList.toggle('current', i === st.step);
    });
  }

  function buildRail(){
    $('rail').innerHTML = STEPS.map((s, i) => `<li><div class="d">${i + 1}</div><span>${s.short}</span></li>`).join('');
  }

  /* ---------- OTDR: zoom out + animasi tes ---------- */
  let otdrRun = 0;
  function otdrCleanup(){
    otdrRun++;
    bench.classList.remove('otdr-mode', 'otdr-testing');
    $('otdrPulseG').style.opacity = 0;
    $('otdrRing').classList.remove('flash');
    $('otdrStL').textContent = ''; $('otdrStR').textContent = '';
  }
  function movePulse(x0, x1, dur, id){
    return new Promise(res => {
      const g = $('otdrPulseG'), a = $('otdrPulse'), b = $('otdrPulseHalo');
      g.style.opacity = 1;
      SFX.play('pulse');
      const t0 = performance.now();
      (function tick(now){
        if (id !== otdrRun) return res(false);
        const p = Math.min(1, (now - t0) / dur), x = x0 + (x1 - x0) * p;
        a.setAttribute('cx', x); b.setAttribute('cx', x);
        if (p < 1) requestAnimationFrame(tick); else res(true);
      })(t0);
    });
  }
  function otdrRing(){ SFX.play('ping'); const r = $('otdrRing'); r.classList.remove('flash'); void r.getBoundingClientRect(); r.classList.add('flash'); }
  async function runOtdr(){
    const id = ++otdrRun, alive = () => id === otdrRun;
    st.busy = true;
    // ujung kabel setelah zoom out (jaket berawal di x = -20 pada koordinat kabel)
    const endL = 400 + (-20 - 400) * OTDR_SCALE, endR = 800 - endL;
    $('otdrLeadL').setAttribute('x2', endL); $('otdrLeadR').setAttribute('x2', endR);
    $('log').textContent = 'Kabel diperkecil, OTDR dipasang di kedua ujung.';
    bench.classList.add('otdr-mode');
    await wait(1300); if (!alive()) return;

    bench.classList.add('otdr-testing');
    $('otdrStL').textContent = 'OTDR A: mengirim pulsa…';
    $('log').textContent = 'OTDR A mengirim pulsa cahaya melalui kabel.';
    if (!await movePulse(176, 400, 1300, id)) return;
    otdrRing();
    await movePulse(400, 176, 500, id);   // pantulan balik dari sambungan
    if (!alive()) return;
    $('otdrStL').textContent = 'OTDR A: selesai';

    $('otdrStR').textContent = 'OTDR B: mengirim pulsa…';
    $('log').textContent = 'OTDR B mengirim pulsa dari arah sebaliknya.';
    if (!await movePulse(624, 400, 1300, id)) return;
    otdrRing();
    await movePulse(400, 624, 500, id);
    if (!alive()) return;
    $('otdrStR').textContent = 'OTDR B: selesai';
    $('otdrPulseG').style.opacity = 0;
    bench.classList.remove('otdr-testing');
    await wait(300); if (!alive()) return;

    st.busy = false;
    complete('test');                      // menampilkan hasil redaman
    await wait(2000); if (!alive()) return;
    bench.classList.remove('otdr-mode');   // zoom kembali
    $('otdrStL').textContent = ''; $('otdrStR').textContent = '';
  }

  /* ---------- meter ---------- */
  function showMeter(){
    const v = +Math.max(0.01, st.loss + (Math.random() - .5) * .02).toFixed(2);
    const q = v <= 0.10 ? 'Sangat baik (≤ 0,10 dB)' : 'Baik, lulus (≤ 0,30 dB)';
    const t0 = performance.now(), T = 900;
    (function tick(now){
      const p = Math.min(1, (now - t0) / T);
      $('mVal').textContent = (v * p).toFixed(2);
      if (p < 1) requestAnimationFrame(tick); else $('mQ').textContent = q;
    })(t0);
    $('mQ').textContent = 'Mengukur…';
    const dy = v * 90;
    const tr = $('trace');
    tr.setAttribute('d', `M0 10 L112 18 L112 ${(18 + dy).toFixed(1)} L240 ${(26 + dy).toFixed(1)}`);
    tr.classList.remove('draw'); void tr.getBoundingClientRect(); tr.classList.add('draw');
    const text = `Redaman terukur ${v.toFixed(2)} dB — ${q.toLowerCase()}.`;
    $('log').textContent = text;
    st.resultText = text;
  }
  function resetMeter(){
    $('mVal').textContent = '--.--'; $('mQ').textContent = 'Belum diuji';
    const tr = $('trace'); tr.classList.remove('draw'); tr.setAttribute('d', 'M0 10 L112 18 L112 18 L240 26');
  }

  /* ---------- fusion splicer ---------- */
  const spDlg = $('splicerDlg'), sp = {stage:0, running:false};
  const OUT_L = 'translate(-150px,0)', OUT_R = 'translate(150px,0)';
  function lcd(a, b){ $('lcd1').textContent = a; $('lcd2').textContent = b; }
  function resetSplicer(){
    sp.stage = 0; sp.running = false;
    $('mLid').classList.remove('closed');
    $('mFibL').style.transform = OUT_L; $('mFibR').style.transform = OUT_R;
    $('ledR').classList.remove('on'); $('ledG').classList.remove('on');
    $('mArc').classList.remove('flash');
    lcd('SIAP', 'Masukkan serat');
    $('btnSplice').textContent = 'Masukkan serat ke penjepit';
    $('btnSplice').disabled = false; $('btnSpCancel').hidden = false;
  }
  function openSplicer(){
    st.busy = true; resetSplicer();
    spDlg.showModal();
  }
  spDlg.addEventListener('cancel', e => { if (sp.running) e.preventDefault(); });
  spDlg.addEventListener('close', () => { st.busy = false; });
  spDlg.addEventListener('click', e => { if (e.target === spDlg && !sp.running) spDlg.close(); });
  $('btnSpCancel').addEventListener('click', () => spDlg.close());

  $('btnSplice').addEventListener('click', async () => {
    const btn = $('btnSplice');
    if (sp.stage === 0) {
      btn.disabled = true;
      SFX.play('clamp');
      lcd('MEMUAT', 'Serat masuk penjepit');
      $('mFibL').style.transform = 'translate(-32px,0)';
      $('mFibR').style.transform = 'translate(32px,6px)';
      await wait(850);
      lcd('SERAT TERPASANG', 'Tutup penutup');
      btn.textContent = 'Tutup penutup & sambung';
      btn.disabled = false; sp.stage = 1;
      return;
    }
    if (sp.stage === 1) {
      sp.running = true; sp.stage = 2;
      btn.disabled = true; $('btnSpCancel').hidden = true;
      $('mLid').classList.add('closed');
      SFX.play('lid');
      await wait(650);
      lcd('ALIGNMENT', 'Sumbu inti disejajarkan');
      SFX.play('motor');
      $('ledR').classList.add('on');
      $('mFibR').style.transform = 'translate(32px,0)';
      await wait(950);
      lcd('PRE-FUSION', 'Ujung serat didekatkan');
      $('mFibL').style.transform = 'translate(-2px,0)';
      $('mFibR').style.transform = 'translate(2px,0)';
      await wait(850);
      lcd('ARC FUSION', 'Busur listrik aktif');
      SFX.play('arc');
      const arc = $('mArc'); arc.classList.remove('flash'); void arc.getBoundingClientRect(); arc.classList.add('flash');
      $('mFibL').style.transform = 'translate(1px,0)';
      $('mFibR').style.transform = 'translate(-1px,0)';
      await wait(700);
      st.loss = +(0.02 + Math.random() * 0.12).toFixed(2);
      $('ledR').classList.remove('on'); $('ledG').classList.add('on');
      lcd('SELESAI', 'Est. ' + st.loss.toFixed(2) + ' dB');
      SFX.play('beep');
      await wait(1300);
      $('mLid').classList.remove('closed');
      await wait(550);
      sp.running = false;
      spDlg.close();
      complete('splice');
    }
  });

  /* ---------- heater ---------- */
  const htDlg = $('heaterDlg'), ht = {running:false};
  function lerp(a, b, p){ return a + (b - a) * p; }
  function resetHeater(){
    ht.running = false;
    $('hLid').classList.remove('closed');
    $('hGlow').setAttribute('opacity', 0);
    $('heatBar').style.width = '0%';
    $('heatTemp').textContent = '25 °C';
    $('heatLabel').textContent = 'Siap memanaskan';
    const sl = $('hSleeveBody');
    sl.style.transform = 'scaleY(1)'; sl.setAttribute('fill', 'rgba(196,228,245,.6)');
    $('btnHeat').disabled = false; $('btnHtCancel').hidden = false;
  }
  function openHeater(){
    st.busy = true; resetHeater();
    htDlg.showModal();
  }
  htDlg.addEventListener('cancel', e => { if (ht.running) e.preventDefault(); });
  htDlg.addEventListener('close', () => { st.busy = false; });
  htDlg.addEventListener('click', e => { if (e.target === htDlg && !ht.running) htDlg.close(); });
  $('btnHtCancel').addEventListener('click', () => htDlg.close());

  $('btnHeat').addEventListener('click', async () => {
    ht.running = true;
    $('btnHeat').disabled = true; $('btnHtCancel').hidden = true;
    $('hLid').classList.add('closed');
    SFX.play('lid');
    await wait(600);
    $('heatLabel').textContent = 'Memanaskan…';
    SFX.play('heat');
    const T = 3600, t0 = performance.now();
    await new Promise(res => {
      const f = now => {
        const p = Math.min(1, (now - t0) / T);
        $('heatBar').style.width = (p * 100).toFixed(1) + '%';
        $('heatTemp').textContent = Math.round(lerp(25, 190, p)) + ' °C';
        $('hGlow').setAttribute('opacity', (Math.min(1, p * 1.3) * .7).toFixed(2));
        const s = Math.min(1, Math.max(0, (p - .3) / .5));
        $('hSleeveBody').style.transform = `scaleY(${lerp(1, .62, s).toFixed(3)})`;
        $('hSleeveBody').setAttribute('fill', `rgba(${Math.round(lerp(196, 246, s))},${Math.round(lerp(228, 208, s))},${Math.round(lerp(245, 130, s))},${lerp(.6, .8, s).toFixed(2)})`);
        p < 1 ? requestAnimationFrame(f) : res();
      };
      requestAnimationFrame(f);
    });
    $('heatLabel').textContent = 'Selesai — sleeve menyusut';
    SFX.play('beep');
    $('hGlow').setAttribute('opacity', 0);
    await wait(1000);
    $('hLid').classList.remove('closed');
    await wait(550);
    ht.running = false;
    htDlg.close();
    complete('heat');
  });

  /* ---------- toast & reset ---------- */
  function toast(kind, msg){
    const el = $('toast');
    el.textContent = msg; el.className = 'toast show' + (kind === 'err' ? ' err' : '');
    if (kind === 'err') SFX.play('error');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function resetAll(){
    if (spDlg.open) { sp.running = false; spDlg.close(); }
    if (htDlg.open) { ht.running = false; htDlg.close(); }
    Object.assign(st, {step:0, selected:null, busy:false, loss:null, resultText:'', slid:false, cleaving:false, mode:null, cutting:false, cut:{L:false, R:false}});
    ['dragL', 'dragR'].forEach(id => { const d = $(id); d.classList.remove('cut', 'stripped', 'cleaned', 'coated', 'handled', 'drag-anim', 'grabbing'); d.style.transform = ''; });
    cleaverEl.classList.remove('press', 'grabbing', 'wiping'); setToolImage('cleave');
    cleaverEl.style.setProperty('--dx', '0px'); cleaverEl.style.setProperty('--dy', '0px');
    ['stripTargetL', 'stripTargetR'].forEach(id => $(id).classList.remove('handled'));
    sleeveOff = 0; sleeveEl.style.transform = '';
    otdrCleanup();
    bench.className = 'bench';
    $('fxlayer').innerHTML = '';
    $('log').textContent = INTRO;
    resetMeter();
    renderTools();
    updateUI();
  }

  $('btnReset').addEventListener('click', resetAll);
  $('btnAgain').addEventListener('click', resetAll);

  buildRail();
  placeCleaver();
  setOtdrImages();
  resetAll();
})();
