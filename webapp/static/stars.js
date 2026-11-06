/* Night sky: warm gold stars that twinkle, slow golden comets with dusty tails,
   an occasional shooting star, and a gold ringed planet in the corner.
   Everything is static when the user prefers reduced motion. */
(function () {
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  let w = 0, h = 0, dpr = 1, stars = [], comets = [], shooter = null, nextShot = 4;

  function makeGlow(rgb) {
    const s = 64, c = document.createElement("canvas");
    c.width = c.height = s;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.18, `rgba(${rgb},0.55)`);
    grad.addColorStop(0.5, `rgba(${rgb},0.12)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return c;
  }
  const glows = [makeGlow("255,214,110"), makeGlow("255,236,170"), makeGlow("240,176,70")];

  function seed() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round((w * h) / 4000);
    stars = [];
    for (let i = 0; i < count; i++) {
      const depth = Math.random();
      const bright = Math.random() < 0.07;
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: bright ? 1.5 + Math.random() * 1.2 : 0.35 + depth * 0.95,
        a: bright ? 0.95 : 0.35 + depth * 0.5,
        glow: glows[(Math.random() * glows.length) | 0],
        speed: 0.6 + Math.random() * 1.8, phase: Math.random() * TAU,
        drift: 0.004 + depth * 0.018,
        sparkle: bright && Math.random() < 0.6,
      });
    }

    // Slow comets travelling to the lower left, each with a tail of golden dust.
    comets = [];
    const n = Math.max(4, Math.round(w / 220));
    for (let i = 0; i < n; i++) comets.push(makeComet(true));
  }

  function makeComet(anywhere) {
    const size = 0.7 + Math.random() * 1.3;
    const angle = (200 + Math.random() * 18) * Math.PI / 180;       // heading down-left
    const speed = 0.18 + Math.random() * 0.3 + size * 0.08;
    const len = 90 + Math.random() * 190 * size;
    const dust = [];
    const count = Math.round(40 + len / 2.2);
    for (let i = 0; i < count; i++) {
      const t = Math.pow(Math.random(), 1.4);
      dust.push({ t, off: (Math.random() - 0.5) * (4 + t * 26) * size, r: 0.4 + Math.random() * 1.1,
                  a: 0.25 + Math.random() * 0.75, tw: Math.random() * TAU });
    }
    return {
      x: anywhere ? Math.random() * (w + 300) : w + len * 0.5 + Math.random() * 300,
      y: anywhere ? Math.random() * h * 0.9 - len * 0.2 : -len * 0.3 - Math.random() * h * 0.4,
      dx: Math.cos(angle), dy: -Math.sin(angle), speed, len, size, dust,
      glow: glows[(Math.random() * glows.length) | 0],
    };
  }

  function drawComet(c, t) {
    // The tail trails behind the head, so it points up and to the right.
    const tx = -c.dx, ty = -c.dy, px = -ty, py = tx;
    for (const d of c.dust) {
      const dist = d.t * c.len;
      const x = c.x + tx * dist + px * d.off;
      const y = c.y + ty * dist + py * d.off;
      const fade = Math.pow(1 - d.t, 1.5);
      const flick = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * 3 + d.tw);
      ctx.globalAlpha = fade * d.a * flick * 0.9;
      ctx.fillStyle = d.t < 0.35 ? "#ffe9a8" : "#e9a93e";
      ctx.beginPath();
      ctx.arc(x, y, d.r * c.size * (1 - d.t * 0.5), 0, TAU);
      ctx.fill();
    }
    const grad = ctx.createLinearGradient(c.x, c.y, c.x + tx * c.len * 0.7, c.y + ty * c.len * 0.7);
    grad.addColorStop(0, "rgba(255,226,140,0.55)");
    grad.addColorStop(1, "rgba(240,170,60,0)");
    ctx.globalAlpha = 1;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.4 * c.size;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + tx * c.len * 0.7, c.y + ty * c.len * 0.7);
    ctx.stroke();
    const s = 22 * c.size;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(c.glow, c.x - s, c.y - s, s * 2, s * 2);
    ctx.fillStyle = "#fffbe6";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 1.7 * c.size, 0, TAU);
    ctx.fill();
  }

  function drawStar(s, t) {
    const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
    const alpha = s.a * tw;
    const size = s.r * (s.sparkle ? 11 : 6);
    ctx.globalAlpha = alpha * 0.85;
    ctx.drawImage(s.glow, s.x - size, s.y - size, size * 2, size * 2);
    ctx.globalAlpha = Math.min(1, alpha + 0.15);
    ctx.fillStyle = "#fff4cc";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.75, 0, TAU);
    ctx.fill();
    if (s.sparkle) {
      const len = s.r * 7 * (0.7 + 0.3 * tw);
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = "#ffe9a8";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
      ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
      ctx.stroke();
    }
  }

  function launchShooter(t) {
    const fromLeft = Math.random() < 0.5;
    shooter = {
      x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
      y: Math.random() * h * 0.45,
      vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 4), vy: 3 + Math.random() * 2.5, life: 0,
    };
    nextShot = t + 8 + Math.random() * 10;
  }

  function drawShooter() {
    if (!shooter) return;
    shooter.x += shooter.vx; shooter.y += shooter.vy; shooter.life += 1;
    const fade = Math.max(0, 1 - shooter.life / 55), tail = 14;
    const grad = ctx.createLinearGradient(shooter.x, shooter.y,
      shooter.x - shooter.vx * tail, shooter.y - shooter.vy * tail);
    grad.addColorStop(0, `rgba(255,236,170,${0.9 * fade})`);
    grad.addColorStop(1, "rgba(255,200,90,0)");
    ctx.globalAlpha = 1;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(shooter.x, shooter.y);
    ctx.lineTo(shooter.x - shooter.vx * tail, shooter.y - shooter.vy * tail);
    ctx.stroke();
    if (fade <= 0 || shooter.x < -50 || shooter.x > w + 50 || shooter.y > h + 50) shooter = null;
  }

  function frame(ms) {
    const t = ms / 1000;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!reduce) {
        s.x -= s.drift; s.y += s.drift * 0.35;
        if (s.x < -10) s.x = w + 10;
        if (s.y > h + 10) s.y = -10;
      }
      drawStar(s, t);
    }
    for (let i = 0; i < comets.length; i++) {
      const c = comets[i];
      if (!reduce) {
        c.x += c.dx * c.speed; c.y += c.dy * c.speed;
        if (c.x < -c.len - 40 || c.y > h + c.len + 40) comets[i] = makeComet(false);
      }
      drawComet(c, t);
    }
    if (!reduce) {
      if (!shooter && t > nextShot) launchShooter(t);
      drawShooter();
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }

  seed();
  frame(0);
  if (!reduce) requestAnimationFrame(frame);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { seed(); drawPlanet(); if (reduce) frame(0); }, 150);
  });

  /* ---------- gold ringed planet (drawn once) ---------- */
  function drawPlanet() {
    const pc = document.getElementById("planet");
    const pctx = pc.getContext("2d");
    const size = Math.min(Math.max(window.innerWidth * 0.5, 360), 700);
    const d = Math.min(window.devicePixelRatio || 1, 2);
    pc.style.width = size + "px"; pc.style.height = size + "px";
    pc.width = size * d; pc.height = size * d;
    pctx.setTransform(d, 0, 0, d, 0, 0);
    pctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2, R = size * 0.2, tilt = -0.42;

    function ring(rx, width, alpha, front) {
      pctx.save();
      pctx.translate(cx, cy); pctx.rotate(tilt); pctx.scale(1, 0.26);
      pctx.beginPath();
      pctx.arc(0, 0, rx, front ? 0 : Math.PI, front ? Math.PI : TAU);
      pctx.lineWidth = width;
      pctx.strokeStyle = `rgba(222,170,70,${alpha})`;
      pctx.stroke();
      pctx.restore();
    }
    const rings = [[R * 1.45, 10, 0.55], [R * 1.62, 22, 0.4], [R * 1.78, 5, 0.6], [R * 1.92, 14, 0.3], [R * 2.1, 3, 0.45]];
    rings.forEach(([rx, wd, a]) => ring(rx, wd, a, false));        // back half behind the planet

    pctx.save();
    pctx.beginPath(); pctx.arc(cx, cy, R, 0, TAU); pctx.clip();
    const base = pctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
    base.addColorStop(0, "#f3cf7e"); base.addColorStop(0.5, "#b88a34"); base.addColorStop(1, "#4a3512");
    pctx.fillStyle = base; pctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    for (let i = 0; i < 26; i++) {                                 // cloud bands
      const y = cy - R + (i / 26) * R * 2 + (Math.random() - 0.5) * 6;
      pctx.fillStyle = `rgba(${Math.random() < 0.5 ? "255,226,150" : "70,45,10"},${0.05 + Math.random() * 0.14})`;
      pctx.fillRect(cx - R, y, R * 2, 3 + Math.random() * 9);
    }
    for (let i = 0; i < 900; i++) {                                // golden grain
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * R;
      pctx.fillStyle = `rgba(255,${200 + Math.random() * 40 | 0},120,${Math.random() * 0.25})`;
      pctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.3, 1.3);
    }
    const shade = pctx.createRadialGradient(cx - R * 0.5, cy - R * 0.5, R * 0.3, cx + R * 0.2, cy + R * 0.2, R * 1.25);
    shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(3,3,6,0.88)");
    pctx.fillStyle = shade; pctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    pctx.restore();

    rings.forEach(([rx, wd, a]) => ring(rx, wd, a, true));         // front half over the planet
  }
  drawPlanet();
})();
