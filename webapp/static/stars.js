/* Night sky: warm gold stars that twinkle, a few with four-point sparkles,
   and an occasional shooting star. Static when the user prefers reduced motion. */
(function () {
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  let w = 0, h = 0, dpr = 1, stars = [], shooter = null, nextShot = 0;

  // Pre-rendered soft glow so thousands of draws stay cheap.
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
  const glows = [makeGlow("255,214,110"), makeGlow("255,236,170"), makeGlow("255,190,80")];

  function seed() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round((w * h) / 4200);
    stars = [];
    for (let i = 0; i < count; i++) {
      const depth = Math.random();                       // 0 far, 1 near
      const bright = Math.random() < 0.07;
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: bright ? 1.5 + Math.random() * 1.2 : 0.35 + depth * 0.95,
        a: bright ? 0.95 : 0.35 + depth * 0.5,
        glow: glows[(Math.random() * glows.length) | 0],
        speed: 0.6 + Math.random() * 1.8,
        phase: Math.random() * TAU,
        drift: 0.004 + depth * 0.018,
        sparkle: bright && Math.random() < 0.6,
      });
    }
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
    if (s.sparkle) {                                      // four-point glint
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
      vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 4),
      vy: 3 + Math.random() * 2.5,
      life: 0,
    };
    nextShot = t + 9 + Math.random() * 12;
  }

  function drawShooter() {
    if (!shooter) return;
    shooter.x += shooter.vx; shooter.y += shooter.vy; shooter.life += 1;
    const fade = Math.max(0, 1 - shooter.life / 55);
    const tail = 14;
    const grad = ctx.createLinearGradient(
      shooter.x, shooter.y, shooter.x - shooter.vx * tail, shooter.y - shooter.vy * tail);
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
    if (!reduce) {
      if (!shooter && t > nextShot) launchShooter(t);
      drawShooter();
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }

  seed();
  nextShot = 4;
  frame(0);
  if (!reduce) requestAnimationFrame(frame);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { seed(); if (reduce) frame(0); }, 150);
  });
})();
