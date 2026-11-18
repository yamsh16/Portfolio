const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOVER = matchMedia('(hover: hover)').matches;
const mouse = { x: -9999, y: -9999, nx: 0, ny: 0 };
addEventListener('pointermove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.nx = e.clientX / innerWidth * 2 - 1; mouse.ny = e.clientY / innerHeight * 2 - 1;
  const g = document.querySelector('.glow');
  g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
});

/* ---------- Background: drifting neural mesh ---------- */
(() => {
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  const COLORS = ['34,211,238', '139,92,246', '244,114,182'];
  const LINK = 130;
  let w, h, nodes = [];

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(80, Math.floor(w * h / 20000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
      r: Math.random() * 1.4 + .6, c: COLORS[Math.floor(Math.random() * 3)]
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
      const dx = mouse.x - n.x, dy = mouse.y - n.y;
      if (dx * dx + dy * dy < 25600) { n.x += dx * .005; n.y += dy * .005; }
    }
    ctx.lineWidth = .7;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          ctx.strokeStyle = `rgba(${a.c},${(1 - d / LINK) * .22})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${a.c},.6)`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
    }
    if (!REDUCE) requestAnimationFrame(frame);
  }
  addEventListener('resize', resize);
  resize(); frame();
})();

/* ---------- Hero: 3D rotating neural sphere ---------- */
(() => {
  const canvas = document.getElementById('orb');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const STOPS = [[34, 211, 238], [139, 92, 246], [244, 114, 182]];
  const colorAt = t => {            // t in 0..1 -> cyan > violet > pink
    const s = Math.min(1.999, t * 2), i = Math.floor(s), f = s - i;
    return STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f)).join(',');
  };

  // points: outer shell (fibonacci sphere) + a smaller inner core
  const pts = [];
  const shell = (n, radius) => {
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996323;
      pts.push({ x: Math.cos(th) * r * radius, y: y * radius, z: Math.sin(th) * r * radius, c: colorAt((y + 1) / 2) });
    }
  };
  shell(230, 1); shell(46, .48);

  // edges: each point links to its 3 nearest neighbours
  const edges = [], adj = pts.map(() => []), seen = new Set();
  pts.forEach((p, i) => {
    pts.map((q, j) => [j, (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2])
      .filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3)
      .forEach(([j]) => {
        const key = i < j ? i + '-' + j : j + '-' + i;
        if (seen.has(key)) return;
        seen.add(key); edges.push([i, j]); adj[i].push(j); adj[j].push(i);
      });
  });

  let W = 0, H = 0, visible = true, rx = -.3, ry = 0, pulses = [];
  const proj = pts.map(() => ({ x: 0, y: 0, d: 0, s: 1 }));

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    if (visible || REDUCE) {
      const t = now / 1000, cx = W / 2, cy = H / 2, R = Math.min(W, H) * .36;
      ry += ((t * .22 + mouse.nx * .7) - ry) * .06;
      rx += ((-.3 + mouse.ny * .45) - rx) * .06;
      const cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
      const breathe = 1 + Math.sin(t * 1.2) * .015;

      pts.forEach((p, i) => {
        const x = p.x * cY + p.z * sY, z0 = p.z * cY - p.x * sY;
        const y = p.y * cX - z0 * sX, z = z0 * cX + p.y * sX;
        const s = 2.8 / (2.8 + z) * breathe, o = proj[i];
        o.x = cx + x * R * s; o.y = cy + y * R * s; o.s = s; o.d = (1 - z) / 2;   // d: 1 = front
      });

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // core glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
      g.addColorStop(0, 'rgba(139,92,246,.30)'); g.addColorStop(.45, 'rgba(34,211,238,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // orbit rings
      ctx.lineWidth = 1;
      [[1.32, .34, .4], [1.5, .22, -.5]].forEach(([k, sq, rot], i) => {
        ctx.strokeStyle = `rgba(${i ? '244,114,182' : '34,211,238'},.16)`;
        ctx.beginPath(); ctx.ellipse(cx, cy, R * k, R * k * sq, rot + rx * .4, 0, 6.283); ctx.stroke();
        const a = t * (i ? -.5 : .7), ex = Math.cos(a) * R * k, ey = Math.sin(a) * R * k * sq, r0 = rot + rx * .4;
        ctx.fillStyle = `rgba(${i ? '244,114,182' : '34,211,238'},.95)`;
        ctx.beginPath(); ctx.arc(cx + ex * Math.cos(r0) - ey * Math.sin(r0), cy + ex * Math.sin(r0) + ey * Math.cos(r0), 2.6, 0, 6.283); ctx.fill();
      });

      // synapses
      ctx.lineWidth = .8;
      for (const [i, j] of edges) {
        const a = proj[i], b = proj[j], d = (a.d + b.d) / 2;
        ctx.strokeStyle = `rgba(${pts[i].c},${.05 + d * d * .4})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // neurons
      pts.forEach((p, i) => {
        const o = proj[i];
        ctx.fillStyle = `rgba(${p.c},${.25 + o.d * .75})`;
        ctx.beginPath(); ctx.arc(o.x, o.y, (.7 + o.d * 1.9) * o.s, 0, 6.283); ctx.fill();
      });

      // signals hopping from neuron to neuron
      if (!REDUCE && pulses.length < 16 && Math.random() < .2) {
        const a = Math.floor(Math.random() * pts.length);
        pulses.push({ a, b: adj[a][Math.floor(Math.random() * adj[a].length)], t: 0, hops: 7 });
      }
      ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 12; ctx.lineWidth = 1.6;
      pulses = pulses.filter(p => p.hops > 0);
      for (const p of pulses) {
        p.t += .045;
        const a = proj[p.a], b = proj[p.b], t1 = Math.min(1, p.t), t0 = Math.max(0, t1 - .35);
        const al = .35 + ((a.d + b.d) / 2) * .65;
        ctx.strokeStyle = `rgba(255,255,255,${al * .7})`;
        ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
        ctx.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${al})`;
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1, 2, 0, 6.283); ctx.fill();
        if (p.t >= 1) {
          const next = adj[p.b].filter(n => n !== p.a);
          p.a = p.b; p.b = next.length ? next[Math.floor(Math.random() * next.length)] : adj[p.b][0];
          p.t = 0; p.hops--;
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!REDUCE) requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(canvas);
  resize(); requestAnimationFrame(frame);
})();

/* ---------- Name decode + typing ---------- */
(() => {
  const el = document.getElementById('name'), final = el.textContent, glyphs = '01<>/{}[]#*+=_';
  if (!REDUCE) {
    let f = 0;
    const id = setInterval(() => {
      el.textContent = [...final].map((ch, i) =>
        ch === ' ' || i < f / 3 ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]).join('');
      if (++f > final.length * 3) { clearInterval(id); el.textContent = final; }
    }, 35);
  }

  const phrases = ['Agentic AI Engineer', 'LLM & RAG Builder', 'NLP & Machine Learning', 'Python Developer'];
  const typed = document.getElementById('typed');
  if (REDUCE) { typed.textContent = phrases[0]; return; }
  let p = 0, i = 0, del = false;
  (function tick() {
    const word = phrases[p];
    typed.textContent = word.slice(0, i);
    if (!del && i === word.length) { del = true; return setTimeout(tick, 1700); }
    if (del && i === 0) { del = false; p = (p + 1) % phrases.length; }
    i += del ? -1 : 1;
    setTimeout(tick, del ? 35 : 80);
  })();
})();

/* ---------- Scroll: reveal, counters, progress, timeline, active nav ---------- */
(() => {
  document.querySelectorAll('.stagger').forEach(s =>
    [...s.children].filter(c => !c.classList.contains('rail')).forEach((c, i) => c.style.setProperty('--i', i)));

  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('show'); io.unobserve(el);
    if (el.classList.contains('stagger')) setTimeout(() => el.classList.add('done'), 800 + el.children.length * 75);
  }), { threshold: .08 });
  document.querySelectorAll('.reveal, .stagger').forEach(el => io.observe(el));

  const cio = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = +el.dataset.count, t0 = performance.now();
    cio.unobserve(el);
    if (REDUCE) { el.textContent = end; return; }
    (function step(now) {
      const k = Math.min(1, (now - t0) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }));
  document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

  const bar = document.querySelector('.progress'), tl = document.querySelector('.timeline');
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    const r = tl.getBoundingClientRect();
    tl.style.setProperty('--p', Math.max(0, Math.min(1, (innerHeight * .65 - r.top) / r.height)) * 100 + '%');
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  const links = [...document.querySelectorAll('.nav nav a')];
  const sio = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => sio.observe(s));
})();

/* ---------- Pointer effects: spotlight, 3D tilt, magnetic buttons ---------- */
(() => {
  document.querySelectorAll('.card').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px');
    el.style.setProperty('--my', e.clientY - r.top + 'px');
  }));
  if (!HOVER || REDUCE) return;

  document.querySelectorAll('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), k = Math.min(1, 380 / r.width) * 7;
      const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateX(${-py * k}deg) rotateY(${px * k}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  document.querySelectorAll('.btn').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px,${(e.clientY - r.top - r.height / 2) * .3}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();

/* ---------- Mobile menu + footer year ---------- */
(() => {
  const btn = document.querySelector('.menu-btn'), nav = document.querySelector('.nav nav');
  btn.addEventListener('click', () => btn.setAttribute('aria-expanded', nav.classList.toggle('open')));
  nav.addEventListener('click', () => { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
  document.getElementById('year').textContent = new Date().getFullYear();
})();
