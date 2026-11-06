/* "On the track": a red sports car shot like a car advert at full speed. The camera pans
   with the car, so the background turns into streaks, the kerbs and road markings rush
   past, the wheels blur, light sweeps across the paint and sparks fly from the rear.
   The car is a generic supercar silhouette drawn here, not any manufacturer's design.
   Frozen in a single frame when the user prefers reduced motion. */
(function () {
  const canvas = document.getElementById("track");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  let w = 0, h = 0, dpr = 1, streaks = [], sparks = [], last = 0, clock = 0, kerb = 0, mount = 0;

  /* car outline, nose to the right, local grid 420 x 120, ground at y = 115 */
  const bodyPath = new Path2D(
    "M8 90C4 80 6 68 20 62L86 54C110 50 138 44 168 34C190 26 232 22 258 28C280 33 304 46 338 56" +
    "C372 62 398 68 412 78C418 83 418 89 412 92L396 94L366 94L20 94Z");
  const glassPath = new Path2D("M176 36C196 29 232 26 255 31L300 49L190 49Z");
  const intakePath = new Path2D("M128 66L168 62L176 78L138 82Z");
  const doorPath = new Path2D("M190 50C196 62 200 76 204 88");
  const WHEELS = [[88, 88], [330, 88]];

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    size();
    streaks = Array.from({ length: 34 }, () => ({
      x: rand(0, w), y: rand(h * 0.08, h * 0.88), len: rand(90, 420), v: rand(1100, 2600), a: rand(0.12, 0.5), wd: rand(1, 2.4),
    }));
    sparks = [];
  }

  const roadTop = () => h * 0.7;

  function backdrop(t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#36627d"); g.addColorStop(0.42, "#e9a47c"); g.addColorStop(0.68, "#ff5f34"); g.addColorStop(1, "#ca413f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const sun = ctx.createRadialGradient(w * 0.18, roadTop() - 24, 4, w * 0.18, roadTop() - 24, h * 0.8);
    sun.addColorStop(0, "rgba(255,244,214,1)"); sun.addColorStop(0.25, "rgba(255,196,130,0.7)"); sun.addColorStop(1, "rgba(255,120,60,0)");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
    // far hills, blurred by the pan
    ctx.fillStyle = "rgba(47,27,27,0.55)";
    ctx.beginPath(); ctx.moveTo(0, roadTop());
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, roadTop() - 26 - Math.abs(Math.sin((x - mount) * 0.006)) * 46 - Math.sin((x - mount) * 0.02) * 6);
    ctx.lineTo(w, roadTop()); ctx.closePath(); ctx.fill();
    // road
    const road = ctx.createLinearGradient(0, roadTop(), 0, h);
    road.addColorStop(0, "#3a3b3b"); road.addColorStop(1, "#1d1818");
    ctx.fillStyle = road; ctx.fillRect(0, roadTop(), w, h - roadTop());
    // kerb stripes rushing past
    const kh = 9;
    for (let x = -80 + (kerb % 80); x < w + 80; x += 40) {
      ctx.fillStyle = Math.round((x - (kerb % 80) + 80) / 40) % 2 ? "#ffebc2" : "#ca413f";
      ctx.fillRect(x, roadTop(), 40, kh);
    }
    // lane markings stretched into dashes
    ctx.fillStyle = "rgba(255,235,194,0.9)";
    for (let x = -300 + ((kerb * 2.4) % 300); x < w + 300; x += 300) ctx.fillRect(x, roadTop() + (h - roadTop()) * 0.62, 190, 4);
  }

  function drawStreaks(dt) {
    ctx.lineCap = "round";
    for (const s of streaks) {
      if (!reduce) { s.x -= s.v * dt; if (s.x + s.len < 0) { s.x = w + rand(0, 200); s.y = rand(h * 0.08, h * 0.88); } }
      const grad = ctx.createLinearGradient(s.x, 0, s.x + s.len, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(1, `rgba(255,244,224,${s.a})`);
      ctx.strokeStyle = grad; ctx.lineWidth = s.wd;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len, s.y); ctx.stroke();
    }
  }

  function wheel(cx, cy, spin) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = "#0e0c0c"; ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#2b2626"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke();
    const rim = ctx.createRadialGradient(-5, -6, 2, 0, 0, 19);
    rim.addColorStop(0, "#f3f1ee"); rim.addColorStop(0.6, "#a9a5a2"); rim.addColorStop(1, "#4c4847");
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(0, 0, 18.5, 0, TAU); ctx.fill();
    // spinning spokes, repeated with low alpha so the wheel reads as motion blur
    for (let b = 0; b < 5; b++) {
      ctx.save(); ctx.rotate(spin - b * 0.11);
      ctx.globalAlpha = reduce ? 0.9 : 0.34 - b * 0.05;
      ctx.fillStyle = "#26211f";
      for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.fillRect(-1.6, 3, 3.2, 14); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ca413f"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();   // centre cap
    ctx.restore();
  }

  function drawCar(t, dt) {
    const cw = Math.min(w * 0.8, 640), s = cw / 420;
    const bob = reduce ? 0 : Math.sin(t * 17) * 0.8 + Math.sin(t * 3.1) * 1.2;
    const x = w * 0.5 - cw / 2 + (reduce ? 0 : Math.sin(t * 0.7) * 10);
    const y = roadTop() + (h - roadTop()) * 0.42 - 115 * s + bob;

    // contact shadow
    const sh = ctx.createRadialGradient(x + cw * 0.5, y + 117 * s, 4, x + cw * 0.5, y + 117 * s, cw * 0.56);
    sh.addColorStop(0, "rgba(0,0,0,0.65)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.translate(0, 0); ctx.scale(1, 0.16); ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(x + cw * 0.5, (y + 117 * s) / 0.16, cw * 0.56, 0, TAU); ctx.fill(); ctx.restore();

    // ghost copies behind the car sell the speed
    if (!reduce) {
      for (let i = 3; i >= 1; i--) { ctx.save(); ctx.globalAlpha = 0.07 * (4 - i); ctx.translate(x - i * 22, y); ctx.scale(s, s); ctx.fillStyle = "#ff8a66"; ctx.fill(bodyPath); ctx.restore(); }
    }

    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    // wheels first so the arches overlap them
    WHEELS.forEach(([cx, cy]) => wheel(cx, cy, clock * 46));
    // paint
    const paint = ctx.createLinearGradient(0, 22, 0, 96);
    paint.addColorStop(0, "#ff6a55"); paint.addColorStop(0.22, "#e1252b"); paint.addColorStop(0.62, "#a3121b"); paint.addColorStop(1, "#4a0a10");
    ctx.fillStyle = paint; ctx.fill(bodyPath);
    // wheel arches
    ctx.fillStyle = "#120c0c";
    WHEELS.forEach(([cx, cy]) => { ctx.beginPath(); ctx.arc(cx, cy, 31, Math.PI, TAU); ctx.fill(); });
    WHEELS.forEach(([cx, cy]) => wheel(cx, cy, clock * 46));
    // glass
    const glass = ctx.createLinearGradient(0, 28, 0, 50);
    glass.addColorStop(0, "#0f1a22"); glass.addColorStop(0.6, "#1c3544"); glass.addColorStop(1, "#6a98ad");
    ctx.fillStyle = glass; ctx.fill(glassPath);
    ctx.fillStyle = "#0b0707"; ctx.fill(intakePath);
    ctx.strokeStyle = "rgba(20,5,5,0.7)"; ctx.lineWidth = 1.2; ctx.stroke(doorPath);
    // light sweeping over the paint (clipped to the body)
    ctx.save(); ctx.clip(bodyPath);
    const sweepX = reduce ? 210 : ((t * 140) % 620) - 100;
    const sweep = ctx.createLinearGradient(sweepX - 40, 0, sweepX + 40, 0);
    sweep.addColorStop(0, "rgba(255,255,255,0)"); sweep.addColorStop(0.5, "rgba(255,255,255,0.55)"); sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep; ctx.fillRect(0, 0, 420, 100);
    ctx.restore();
    // shoulder highlight and shut line
    ctx.strokeStyle = "rgba(255,226,214,0.55)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(34, 62); ctx.bezierCurveTo(110, 52, 220, 40, 342, 60); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(206, 88); ctx.lineTo(300, 70); ctx.stroke();
    // lights
    ctx.fillStyle = "#fff7d6"; ctx.beginPath(); ctx.moveTo(392, 74); ctx.lineTo(411, 79); ctx.lineTo(398, 83); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff3b3b"; ctx.fillRect(6, 66, 14, 5);
    ctx.restore();

    // light glows
    const head = ctx.createRadialGradient(x + 408 * s, y + 79 * s, 2, x + 408 * s, y + 79 * s, 70 * s);
    head.addColorStop(0, "rgba(255,247,214,0.9)"); head.addColorStop(1, "rgba(255,247,214,0)");
    ctx.fillStyle = head; ctx.fillRect(x + 330 * s, y + 20 * s, 190 * s, 120 * s);
    const tail = ctx.createRadialGradient(x + 10 * s, y + 68 * s, 1, x + 10 * s, y + 68 * s, 40 * s);
    tail.addColorStop(0, "rgba(255,59,59,0.8)"); tail.addColorStop(1, "rgba(255,59,59,0)");
    ctx.fillStyle = tail; ctx.fillRect(x - 40 * s, y + 20 * s, 100 * s, 100 * s);

    // sparks from the rear
    if (!reduce) {
      for (let i = 0; i < 2; i++) sparks.push({ x: x + 14 * s, y: y + 96 * s, vx: -rand(260, 620), vy: rand(-90, 40), life: 0, max: rand(0.25, 0.6) });
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
        const k = p.life / p.max; if (k >= 1) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#ffd6a0"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function frame(ms) {
    const t = ms / 1000;
    const dt = last ? Math.min(0.05, t - last) : 0;
    last = t; clock = t;
    if (!reduce) { kerb += dt * 1400; mount += dt * 160; }
    backdrop(t);
    drawStreaks(dt);
    drawCar(t, dt);
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);   // speed vignette
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(30,10,10,0.5)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    if (!reduce) requestAnimationFrame(frame);
  }

  seed();
  frame(0);
  if (!reduce) requestAnimationFrame(frame);
  window.addEventListener("resize", () => { seed(); if (reduce) frame(0); });
})();
