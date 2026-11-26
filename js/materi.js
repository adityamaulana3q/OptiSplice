/* materi.js — menandai bagian yang sedang dibaca pada daftar isi (materi.html).
   Bagian aktif = bagian terakhir yang batas atasnya sudah melewati garis 140 px dari atas layar. */
(() => {
  const links = [...document.querySelectorAll('.toc a')];
  const sections = links.map(a => document.getElementById(a.hash.slice(1)));
  let queued = false, current = null;
  const update = () => {
    queued = false;
    let id = sections[0].id;
    sections.forEach(s => { if (s.getBoundingClientRect().top <= 140) id = s.id; });
    if (id === current) return;
    current = id;
    links.forEach(a => {
      const on = a.hash === '#' + id;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();
