/* OptiSplice Lab: sesi siswa (identitas, timer, skor, bukti JPG).
   Pasang SATU baris ini di index.html, tepat sebelum </body> (setelah <script> utama):
   <script src="js/sesi_siswa.js"></script>
   Gayanya ada di css/sesi.css. */
(() => {
  const $ = id => document.getElementById(id);
  const TITLES = ['Pakai sarung tangan','Kupas jaket luar kabel','Bersihkan serat dengan alkohol','Kupas coating serat','Potong dengan fiber cleaver','Pasang sleeve pelindung','Jalankan fusion splicer','Geser sleeve, lalu panaskan','Ukur redaman sambungan'];
  const N = TITLES.length;
  const S = {running:false, t0:0, elapsed:0, errors:0, log:[], report:null};
  let student = {name:'', absen:'', mode:'belajar'};
  const MODE = {belajar:'Belajar', ujian:'Ujian'};

  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const hash = t => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).toUpperCase().padStart(7, '0'); };

  /* ---------- HTML ---------- */

  document.body.insertAdjacentHTML('beforeend', `
<dialog id="startDlg" aria-labelledby="stTitle">
  <form class="dlg" id="startForm" autocomplete="off" novalidate>
    <h2 id="stTitle">Sebelum mulai</h2>
    <p>Isi identitasmu dan pilih mode. Timer berjalan begitu kamu menekan Mulai simulasi, dan nilainya tercatat atas namamu.</p>
    <label class="fld"><span>Nama lengkap</span><input id="inName" maxlength="40"></label>
    <label class="fld"><span>Nomor absen</span><input id="inAbsen" inputmode="numeric" maxlength="3"></label>
    <fieldset class="modes"><legend>Mode</legend>
      <label class="mode"><input type="radio" name="mode" value="belajar" checked><b>Belajar</b><small>Langkah, petunjuk, dan catatan tampil.</small></label>
      <label class="mode"><input type="radio" name="mode" value="ujian"><b>Ujian</b><small>Tanpa petunjuk. Hanya simulasi dan nilai.</small></label>
    </fieldset>
    <p class="fld-err" id="stErr" role="alert"></p>
    <div class="actions"><button class="btn" type="submit">Mulai simulasi</button></div>
  </form>
</dialog>
<dialog id="resultDlg" aria-labelledby="rsTitle">
  <div class="dlg">
    <h2 id="rsTitle">Hasil simulasi</h2>
    <div id="resBody"></div>
    <div class="actions">
      <button class="btn alt" id="btnResClose">Tutup</button>
      <button class="btn" id="btnJpg">Unduh bukti (JPG)</button>
    </div>
  </div>
</dialog>`);

  const sound = $('btnSound');
  sound.insertAdjacentHTML('beforebegin', '<span class="who" id="who"></span><span class="timer" aria-label="Waktu berjalan">⏱ <b id="timerVal">00:00</b></span>');
  const again = $('btnAgain'), box = document.createElement('div');
  box.style.cssText = 'display:grid;gap:8px';
  box.innerHTML = '<button class="btn alt" id="btnResult" hidden>Lihat nilai</button>';
  again.parentNode.insertBefore(box, again); box.appendChild(again);

  /* ---------- identitas & timer ---------- */
  function openStart(){
    const d = $('startDlg'); if (d.open) return;
    $('inName').value = student.name; $('inAbsen').value = student.absen; $('stErr').textContent = '';
    document.querySelector('input[name=mode][value=' + student.mode + ']').checked = true;
    d.showModal();
  }
  $('startDlg').addEventListener('cancel', e => e.preventDefault());
  $('startForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('inName').value.trim().replace(/\s+/g, ' '), absen = $('inAbsen').value.trim();
    if (name.length < 3) { $('stErr').textContent = 'Isi nama lengkap, minimal 3 huruf.'; $('inName').focus(); return; }
    if (!/^\d{1,3}$/.test(absen) || +absen < 1) { $('stErr').textContent = 'Nomor absen harus angka, contoh: 7.'; $('inAbsen').focus(); return; }
    const mode = document.querySelector('input[name=mode]:checked').value;
    student = {name, absen: String(+absen), mode};
    document.body.classList.toggle('exam-mode', mode === 'ujian');
    $('who').textContent = name + ' · No. ' + student.absen + ' · ' + MODE[mode];
    $('startDlg').close();
    Object.assign(S, {running:true, t0:performance.now(), elapsed:0, errors:0, log:[], report:null});
  });

  function resetSession(){
    Object.assign(S, {running:false, elapsed:0, errors:0, log:[], report:null});
    $('timerVal').textContent = '00:00';
    $('btnResult').hidden = true;
    if ($('resultDlg').open) $('resultDlg').close();
    openStart();
  }
  $('btnReset').addEventListener('click', resetSession);
  again.addEventListener('click', resetSession);

  /* kesalahan = salah pilih alat / memanaskan sebelum sleeve digeser (dibaca dari toast merah) */
  const toastEl = $('toast');
  new MutationObserver(() => {
    if (S.running && toastEl.classList.contains('err') && /^(Bukan alat|Geser sleeve ke titik)/.test(toastEl.textContent)) S.errors++;
  }).observe(toastEl, {childList:true, characterData:true, subtree:true});

  /* pantau kemajuan: langkah selesai = alat bertanda .done */
  setInterval(() => {
    if (!S.running) return;
    S.elapsed = performance.now() - S.t0;
    $('timerVal').textContent = fmt(S.elapsed);
    const n = document.querySelectorAll('.tool.done').length;
    while (S.log.length < n && S.log.length < N) S.log.push(S.elapsed);
    if (n >= N && !/^Mengukur/.test($('mQ').textContent) && $('mVal').textContent !== '--.--') finish();
  }, 200);

  function finish(){
    S.running = false;
    S.elapsed = S.log[N - 1] || S.elapsed;           // waktu berhenti saat langkah terakhir selesai
    $('timerVal').textContent = fmt(S.elapsed);
    buildReport();
    $('btnResult').hidden = false;
    const rp = S.report;
    setTimeout(() => { if (S.report === rp) showResult(); }, 2600);   // setelah animasi OTDR zoom kembali
  }

  /* Skor: prosedur 50 + ketepatan 30 (-5 per kesalahan) + kecepatan 20 (penuh <= 3 menit, nol >= 10 menit) */
  function buildReport(){
    const sec = S.elapsed / 1000;
    const kete = Math.max(0, 30 - S.errors * 5);
    const cepat = Math.round(20 * Math.max(0, Math.min(1, (600 - sec) / 420)));
    const total = 50 + kete + cepat;
    const gr = total >= 90 ? ['A','Sangat baik'] : total >= 80 ? ['B','Baik'] : total >= 70 ? ['C','Cukup'] : ['D','Perlu mengulang'];
    const d = new Date();
    const tgl = d.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}) + ', ' + d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}).replace('.', ':');
    S.report = {
      name: student.name, absen: student.absen, mode: student.mode, tgl, dur: fmt(S.elapsed), total, grade: gr[0], gradeTxt: gr[1],
      parts: [
        ['Prosedur lengkap (' + N + '/' + N + ' langkah)', 50, 50],
        ['Ketepatan alat (' + S.errors + ' kesalahan)', kete, 30],
        ['Kecepatan (' + fmt(S.elapsed) + ')', cepat, 20]
      ],
      steps: TITLES.map((t, i) => [t, fmt((S.log[i] || 0) - (S.log[i - 1] || 0))]),
      loss: parseFloat($('mVal').textContent) || 0, lossQ: $('mQ').textContent,
      id: 'OSL-' + hash(student.name + '|' + student.absen + '|' + Date.now() + '|' + total)
    };
  }

  function showResult(){
    const r = S.report; if (!r) return;
    $('resBody').innerHTML =
      '<div class="res-top"><div class="res-score"><b>' + r.total + '</b><span>dari 100 · nilai ' + r.grade + ' (' + r.gradeTxt + ')</span></div>' +
      '<dl class="res-id"><dt>Nama</dt><dd>' + esc(r.name) + '</dd><dt>No. absen</dt><dd>' + esc(r.absen) + '</dd><dt>Mode</dt><dd>' + MODE[r.mode] + '</dd><dt>Waktu</dt><dd>' + r.dur + '</dd><dt>Tanggal</dt><dd>' + esc(r.tgl) + '</dd></dl></div>' +
      '<h3>Rincian nilai</h3>' + r.parts.map(p => '<div class="res-row"><span>' + esc(p[0]) + '</span><b>' + p[1] + ' / ' + p[2] + '</b></div><div class="res-bar"><i style="width:' + (100 * p[1] / p[2]) + '%"></i></div>').join('') +
      '<h3>Langkah yang dikerjakan</h3><ul class="res-steps">' + r.steps.map(x => '<li><span>' + esc(x[0]) + '</span><em>' + x[1] + '</em></li>').join('') + '</ul>' +
      '<h3>Hasil sambungan</h3><div class="res-row"><span>Redaman terukur</span><b>' + r.loss.toFixed(2) + ' dB</b></div><div class="res-row"><span>' + esc(r.lossQ) + '</span></div>' +
      '<p class="res-code">ID bukti: ' + r.id + '</p>';
    if (!$('resultDlg').open) $('resultDlg').showModal();
  }

  async function downloadJpg(){
    const r = S.report; if (!r) return;
    try { await document.fonts.ready; } catch(_) {}
    const W = 900, H = 1340, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const FH = '"Bricolage Grotesque","Instrument Sans",system-ui,sans-serif', FB = '"Instrument Sans",system-ui,sans-serif', FM = '"Share Tech Mono",ui-monospace,monospace';
    const T = (t, x, y, size, color, o = {}) => { g.font = (o.w || 400) + ' ' + size + 'px ' + (o.f || FB); g.fillStyle = color; g.textAlign = o.a || 'left'; g.textBaseline = 'alphabetic'; g.fillText(String(t), x, y, o.max); };
    const bx = (x, y, w, h, rad, fill) => { g.fillStyle = fill; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, rad); else g.rect(x, y, w, h); g.fill(); };
    const head = (t, y) => { T(t, 40, y, 26, '#1B2320', {w:700, f:FH}); bx(40, y + 10, 60, 5, 2, '#F2C230'); };
    const MUTED = '#5B6862', INK = '#1B2320';

    bx(0, 0, W, H, 0, '#F7F8F5');
    bx(0, 0, W, 130, 0, INK);
    bx(40, 52, 24, 14, 7, '#F2C230'); bx(76, 52, 24, 14, 7, '#F2C230');
    g.fillStyle = '#5CC8E0'; g.beginPath(); g.arc(70, 59, 7, 0, 7); g.fill();
    T('OptiSplice Lab', 120, 64, 38, '#FFFFFF', {w:700, f:FH});
    T('Bukti simulasi fusion splicing', 120, 98, 20, '#C9D1CC');
    bx(640, 46, 220, 46, 23, r.mode === 'ujian' ? '#F2C230' : '#1E7F55');
    T('MODE ' + MODE[r.mode].toUpperCase(), 750, 77, 22, r.mode === 'ujian' ? INK : '#FFFFFF', {a:'center', w:700, f:FH});

    [['Nama', r.name], ['No. absen', r.absen], ['Mode', MODE[r.mode]], ['Waktu', r.dur], ['Tanggal', r.tgl]].forEach((row, i) => {
      T(row[0], 40, 200 + i * 40, 20, MUTED);
      T(row[1], 190, 200 + i * 40, 26, INK, {w:600, max:380});
    });
    bx(600, 165, 260, 190, 20, INK);
    T(r.total, 730, 275, 100, '#F2C230', {a:'center', w:700, f:FH});
    T('dari 100', 730, 310, 20, '#C9D1CC', {a:'center'});
    T('Nilai ' + r.grade + ' · ' + r.gradeTxt, 730, 338, 18, '#FFFFFF', {a:'center', max:230});

    head('Rincian nilai', 420);
    r.parts.forEach((p, i) => {
      const y = 470 + i * 58;
      T(p[0], 40, y, 20, INK, {max:640});
      T(p[1] + ' / ' + p[2], 860, y, 20, INK, {a:'right', w:700});
      bx(40, y + 12, 820, 10, 5, '#CDD4CE');
      if (p[1] > 0) bx(40, y + 12, Math.max(10, 820 * p[1] / p[2]), 10, 5, '#1E7F55');
    });

    head('Langkah yang dikerjakan', 670);
    r.steps.forEach((x, i) => {
      const y = 725 + i * 42;
      g.fillStyle = '#1E7F55'; g.beginPath(); g.arc(52, y - 7, 12, 0, 7); g.fill();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(46, y - 7); g.lineTo(51, y - 2); g.lineTo(59, y - 12); g.stroke();
      T((i + 1) + '. ' + x[0], 80, y, 20, INK, {max:640});
      T(x[1], 860, y, 20, MUTED, {a:'right', f:FM});
    });

    head('Hasil sambungan', 1115);
    T('Redaman terukur ' + r.loss.toFixed(2) + ' dB', 40, 1170, 26, INK, {w:600});
    T(r.lossQ, 40, 1205, 20, MUTED, {max:820});

    bx(40, 1250, 820, 2, 1, '#CDD4CE');
    T('ID bukti: ' + r.id, 40, 1292, 22, INK, {w:700, f:FM});
    T('Dibuat otomatis oleh OptiSplice Lab · ' + r.tgl, 40, 1322, 16, MUTED, {max:820});

    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'Bukti-Simulasi_' + r.absen + '_' + r.name.replace(/[^\w]+/g, '_') + '.jpg';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/jpeg', .92);
  }
  $('btnJpg').addEventListener('click', downloadJpg);
  $('btnResult').addEventListener('click', showResult);
  $('btnResClose').addEventListener('click', () => $('resultDlg').close());
  $('resultDlg').addEventListener('click', e => { if (e.target === $('resultDlg')) $('resultDlg').close(); });

  openStart();
})();