/* Sky behind the page. Aircraft are drawn as fine engineering wireframes (fuselage frames,
   wing ribs and spars, engine nacelles) in the page palette, and they fly like birds, not
   in straight lines: they soar in circles, weave in S-curves, hover and dart like bees, and
   the jets throw a loop now and then. Clouds drift and wireframe rockets climb through
   the sky with flame and smoke. Frozen in place when the user prefers reduced motion. */
(function () {
  const canvas = document.getElementById("sky");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const lerp = (a, b, t) => a + (b - a) * t;

  const INK = "#2f1b1b", TEAL = "#36627d", ORANGE = "#ff5f34", RED = "#ca413f", CREAM = "#fff6e2";

  /* ---------- wireframe geometry, nose up, on a 200 x 200 grid ---------- */
  // Builds Path2D objects once: outline (heavy), detail (hairline) and engines.
  function buildAircraft(spec) {
    const outline = new Path2D(), detail = new Path2D(), engines = new Path2D(), enginesDetail = new Path2D(), fill = new Path2D();
    const half = (y) => {                                   // fuselage half-width along the length
      if (y < spec.noseEnd) return spec.fw * Math.sin(((y - 8) / (spec.noseEnd - 8)) * Math.PI / 2) ** 0.8;
      if (y < spec.tailStart) return spec.fw;
      return spec.fw * Math.max(0, 1 - (y - spec.tailStart) / (spec.length - spec.tailStart)) ** 0.9;
    };
    const mirror = (x) => 200 - x;

    // fuselage outline
    const steps = 48;
    const right = [], left = [];
    for (let i = 0; i <= steps; i++) {
      const y = 8 + (spec.length - 8) * (i / steps);
      right.push([100 + half(y), y]); left.push([100 - half(y), y]);
    }
    outline.moveTo(right[0][0], right[0][1]);
    right.forEach(([x, y]) => outline.lineTo(x, y));
    for (let i = left.length - 1; i >= 0; i--) outline.lineTo(left[i][0], left[i][1]);
    outline.closePath();
    fill.addPath(outline);
    // frames, spine, cockpit, windows
    for (let y = 14; y < spec.length - 6; y += 6) {
      const hw = half(y);
      if (hw > 0.8) { detail.moveTo(100 - hw, y); detail.lineTo(100 + hw, y); }
    }
    detail.moveTo(100, 8); detail.lineTo(100, spec.length);
    detail.moveTo(100 - spec.fw * 0.55, 20); detail.lineTo(100 - spec.fw * 0.3, 28); detail.lineTo(100 + spec.fw * 0.3, 28); detail.lineTo(100 + spec.fw * 0.55, 20);
    for (let y = spec.noseEnd + 4; y < spec.tailStart - 6; y += 4) {
      [-1, 1].forEach((s) => { detail.moveTo(100 + s * (spec.fw - 2.4), y); detail.lineTo(100 + s * (spec.fw - 2.4), y + 1.6); });
    }

    // wing (and tailplane) with ribs, spars, slats and flaps; mirrored to the other side
    const addWing = (w, ribs, withFlaps) => {
      const pts = ["root", "tip"].map((k) => w[k]);              // [x, yLE, yTE]
      const LE = (t) => [lerp(pts[0][0], pts[1][0], t), lerp(pts[0][1], pts[1][1], t)];
      const TE = (t) => [lerp(pts[0][0], pts[1][0], t), lerp(pts[0][2], pts[1][2], t)];
      [false, true].forEach((flip) => {
        const X = (x) => (flip ? mirror(x) : x);
        outline.moveTo(X(pts[0][0]), pts[0][1]); outline.lineTo(X(pts[1][0]), pts[1][1]);
        outline.lineTo(X(pts[1][0]), pts[1][2]); outline.lineTo(X(pts[0][0]), pts[0][2]); outline.closePath();
        fill.moveTo(X(pts[0][0]), pts[0][1]); fill.lineTo(X(pts[1][0]), pts[1][1]); fill.lineTo(X(pts[1][0]), pts[1][2]); fill.lineTo(X(pts[0][0]), pts[0][2]); fill.closePath();
        for (let i = 1; i <= ribs; i++) {
          const t = i / ribs, a = LE(t), b = TE(t);
          detail.moveTo(X(a[0]), a[1]); detail.lineTo(X(b[0]), b[1]);
        }
        const along = (f, t0, t1) => {
          const p0 = [lerp(LE(t0)[0], TE(t0)[0], f), lerp(LE(t0)[1], TE(t0)[1], f)];
          const p1 = [lerp(LE(t1)[0], TE(t1)[0], f), lerp(LE(t1)[1], TE(t1)[1], f)];
          detail.moveTo(X(p0[0]), p0[1]); detail.lineTo(X(p1[0]), p1[1]);
        };
        along(0.28, 0, 1); along(0.66, 0, 1);
        if (withFlaps) { along(0.12, 0.05, 0.95); along(0.82, 0.08, 0.98); }
      });
    };
    addWing(spec.wing, spec.ribs, true);
    addWing(spec.tail, 4, false);

    // engines: nacelle, intake ring and pylon
    spec.engines.forEach(([x, y, r, len]) => {
      [x, mirror(x)].forEach((ex) => {
        engines.roundRect(ex - r, y, r * 2, len, r * 0.9);
        enginesDetail.ellipse(ex, y + r * 0.45, r * 0.78, r * 0.45, 0, 0, TAU);
        enginesDetail.moveTo(ex - r, y + len * 0.55); enginesDetail.lineTo(ex + r, y + len * 0.55);
        enginesDetail.moveTo(ex, y + len); enginesDetail.lineTo(ex, y + len + 5);
      });
    });
    return { outline, detail, engines, enginesDetail, fill, prop: spec.prop || null };
  }

  const kinds = {
    airliner: buildAircraft({
      fw: 11, length: 196, noseEnd: 34, tailStart: 150, ribs: 9,
      wing: { root: [111, 70, 104], tip: [188, 120, 130] }, tail: { root: [105, 160, 176], tip: [150, 181, 187] },
      engines: [[142, 80, 6.5, 30]],
    }),
    quad: buildAircraft({
      fw: 13, length: 196, noseEnd: 36, tailStart: 150, ribs: 11,
      wing: { root: [113, 64, 108], tip: [192, 116, 128] }, tail: { root: [107, 160, 178], tip: [152, 181, 188] },
      engines: [[132, 74, 6, 28], [165, 94, 6, 28]],
    }),
    bizjet: buildAircraft({
      fw: 8, length: 192, noseEnd: 38, tailStart: 140, ribs: 7,
      wing: { root: [108, 80, 104], tip: [168, 114, 122] }, tail: { root: [104, 164, 177], tip: [136, 180, 185] },
      engines: [[117, 128, 5, 28]],
    }),
    uav: (() => {
      const g = buildAircraft({
        fw: 5.5, length: 170, noseEnd: 30, tailStart: 120, ribs: 14,
        wing: { root: [105, 78, 94], tip: [196, 82, 92] }, tail: { root: [103, 150, 160], tip: [132, 174, 182] },
        engines: [[150, 86, 3, 14], [172, 86, 3, 14]],
      });
      g.prop = { cx: 100, cy: 176, r: 20 };
      return g;
    })(),
  };

  const PLAN = [
    ["airliner", "circle"], ["airliner", "weave"], ["quad", "circle"], ["bizjet", "loop"], ["airliner", "loop"],
    ["uav", "bee"], ["quad", "weave"], ["bizjet", "circle"], ["uav", "bee"], ["airliner", "circle"],
  ];

  /* ---------- wireframe rocket ---------- */
  const rocket = (() => {
    const outline = new Path2D("M0 -92C9 -76 13 -52 13 -30L13 78L-13 78L-13 -30C-13 -52 -9 -76 0 -92Z");
    const detail = new Path2D();
    [-52, -30, 8, 30, 54].forEach((y) => { detail.moveTo(-13, y); detail.lineTo(13, y); });
    detail.moveTo(0, -92); detail.lineTo(0, 78);
    detail.moveTo(-6, -30); detail.lineTo(-6, 78); detail.moveTo(6, -30); detail.lineTo(6, 78);
    detail.moveTo(-13, 62); detail.lineTo(-30, 96); detail.lineTo(-13, 80);
    detail.moveTo(13, 62); detail.lineTo(30, 96); detail.lineTo(13, 80);
    detail.moveTo(-8, 78); detail.lineTo(-11, 92); detail.lineTo(11, 92); detail.lineTo(8, 78);
    detail.ellipse(0, -34, 5, 5, 0, 0, TAU);
    return { outline, detail };
  })();

  let w = 0, h = 0, dpr = 1, planes = [], clouds = [], rockets = [], particles = [], last = 0, clock = 0;

  const cloudSprite = (() => {
    const c = document.createElement("canvas");
    c.width = 360; c.height = 160;
    const g = c.getContext("2d");
    [[70, 100, 60], [140, 80, 70], [210, 90, 62], [275, 104, 52], [175, 112, 80]].forEach(([x, y, r]) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.95)"); grad.addColorStop(0.6, "rgba(255,255,255,0.45)"); grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
    });
    return c;
  })();

  function seed() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clouds = Array.from({ length: Math.max(5, Math.round(w / 220)) }, () => {
      const s = rand(0.6, 1.9);
      return { x: rand(-200, w + 200), y: rand(0, h), s, v: 4 + s * 5, a: rand(0.35, 0.75) };
    });
    const count = Math.max(8, Math.round(w / 150));
    planes = Array.from({ length: count }, (_, i) => makePlane(...PLAN[i % PLAN.length]));
    rockets = Array.from({ length: Math.max(1, Math.round(w / 700)) }, (_, i) => makeRocket(i * 6 + 2));
    particles = [];
  }

  function makePlane(kind, style) {
    const layer = Math.random();
    return {
      kind, style, g: kinds[kind],
      size: kind === "uav" ? 46 + layer * 54 : 44 + layer * 90,
      speed: kind === "uav" ? rand(20, 44) : rand(46, 96) * (0.7 + layer * 0.5),
      x: rand(0, w), y: rand(h * 0.05, h * 0.95), th: rand(0, TAU),
      dir: Math.random() < 0.5 ? 1 : -1,
      amp: rand(0.35, 0.9), freq: rand(0.25, 0.6), ph: rand(0, TAU),
      loopAt: rand(3, 9), loopLeft: 0,
      alpha: 0.4 + layer * 0.5, trail: [], wx: rand(-6, 6), wy: rand(-3, 3),
    };
  }

  function steerHome(p, turn) {
    const m = 60;
    if (p.x < -m || p.x > w + m || p.y < -m || p.y > h + m) {
      const want = Math.atan2(h / 2 - p.y, w / 2 - p.x);
      return Math.max(-1.6, Math.min(1.6, wrapAngle(want - p.th) * 2.2));
    }
    return turn;
  }

  function stepPlane(p, dt) {
    let turn;
    if (p.style === "circle") turn = p.dir * p.amp * 0.9;                                     // soaring circles
    else if (p.style === "weave") turn = p.amp * 1.3 * Math.sin(clock * p.freq * 2 + p.ph);  // butterfly S-curves
    else if (p.style === "loop") {
      p.loopAt -= dt;
      if (p.loopAt < 0 && p.loopLeft <= 0) { p.loopLeft = 3.2; p.loopAt = rand(7, 14); }
      if (p.loopLeft > 0) { p.loopLeft -= dt; turn = p.dir * 1.9; } else turn = 0.18 * Math.sin(clock * 0.5 + p.ph);
    } else turn = 1.6 * Math.sin(clock * 1.1 + p.ph) * Math.sin(clock * 0.37 + p.ph * 2);   // bee
    turn = steerHome(p, turn);
    p.th += turn * dt;
    const pace = p.style === "bee" ? 0.35 + 0.65 * Math.abs(Math.sin(clock * 0.6 + p.ph)) : 1;
    p.x += (Math.cos(p.th) * p.speed * pace + p.wx) * dt;
    p.y += (Math.sin(p.th) * p.speed * pace + p.wy) * dt;
    if (p.kind !== "uav") { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 70) p.trail.shift(); }
  }

  function drawPlane(p, t) {
    if (p.trail.length > 2) {
      ctx.lineCap = "round"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1.2, p.size * 0.03);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.globalAlpha = (i / p.trail.length) * 0.55 * (0.5 + p.alpha);
        ctx.beginPath(); ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y); ctx.lineTo(p.trail[i].x, p.trail[i].y); ctx.stroke();
      }
    }
    const k = p.size / 200, g = p.g;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.th + Math.PI / 2); ctx.scale(k, k); ctx.translate(-100, -100);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.globalAlpha = p.alpha * 0.9; ctx.fillStyle = CREAM; ctx.fill(g.fill);
    ctx.globalAlpha = p.alpha * 0.85; ctx.strokeStyle = TEAL; ctx.lineWidth = 0.9 / k * 0.8; ctx.stroke(g.detail);
    ctx.globalAlpha = p.alpha; ctx.strokeStyle = INK; ctx.lineWidth = 1.7 / k * 0.8; ctx.stroke(g.outline);
    ctx.fillStyle = "#ffd2c2"; ctx.fill(g.engines);
    ctx.strokeStyle = RED; ctx.lineWidth = 1.6 / k * 0.8; ctx.stroke(g.engines);
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 1 / k * 0.8; ctx.stroke(g.enginesDetail);
    if (g.prop) {                                                       // pusher propeller of the UAV
      const a = reduce ? 0.6 : t * 38;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4 / k * 0.8; ctx.globalAlpha = p.alpha * 0.4;
      ctx.beginPath(); ctx.arc(g.prop.cx, g.prop.cy, g.prop.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = p.alpha; ctx.lineWidth = 2.2 / k * 0.8;
      ctx.beginPath(); ctx.moveTo(g.prop.cx - Math.cos(a) * g.prop.r, g.prop.cy - Math.sin(a) * g.prop.r);
      ctx.lineTo(g.prop.cx + Math.cos(a) * g.prop.r, g.prop.cy + Math.sin(a) * g.prop.r); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- rockets ---------- */
  function makeRocket(delay) {
    return { state: "wait", at: delay, x: 0, y: 0, vy: 0, vx: 0, t: 0, size: rand(80, 120), tint: [RED, TEAL, ORANGE][(Math.random() * 3) | 0] };
  }
  function stepRocket(r, dt) {
    if (r.state === "wait") {
      r.at -= dt;
      if (r.at <= 0) { r.state = "fly"; r.x = rand(w * 0.06, w * 0.94); r.y = h + 110; r.vy = -70; r.vx = rand(-18, 18); r.t = 0; }
      return;
    }
    r.t += dt;
    r.vy = Math.max(-560, r.vy - (90 + r.t * 90) * dt);
    r.x += (r.vx + Math.sin(r.t * 1.4) * 22) * dt;
    r.y += r.vy * dt;
    for (let i = 0; i < 3; i++) {
      particles.push({ x: r.x + rand(-3, 3), y: r.y + r.size * 0.5, vx: rand(-22, 22), vy: rand(40, 120) - r.vy * 0.15, life: 0, max: rand(0.9, 1.8), r: rand(3, 6) });
    }
    if (r.y < -160) { r.state = "wait"; r.at = rand(8, 16); }
  }
  function drawRocket(r) {
    if (r.state !== "fly") return;
    const ang = Math.atan2(r.vy, r.vx + Math.sin(r.t * 1.4) * 22) + Math.PI / 2;
    const k = r.size / 190;
    ctx.save();
    ctx.translate(r.x, r.y); ctx.rotate(ang); ctx.scale(k, k);
    const flame = ctx.createLinearGradient(0, 92, 0, 190 + Math.random() * 24);
    flame.addColorStop(0, "rgba(255,244,190,0.95)"); flame.addColorStop(0.4, "rgba(255,95,52,0.85)"); flame.addColorStop(1, "rgba(255,95,52,0)");
    ctx.globalAlpha = 1; ctx.fillStyle = flame;
    ctx.beginPath(); ctx.moveTo(-9, 92); ctx.quadraticCurveTo(0, 200, 9, 92); ctx.closePath(); ctx.fill();
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.92; ctx.fillStyle = CREAM; ctx.fill(rocket.outline);
    ctx.strokeStyle = r.tint; ctx.lineWidth = 1.2 / k * 0.8; ctx.stroke(rocket.detail);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8 / k * 0.8; ctx.stroke(rocket.outline);
    ctx.restore();
  }
  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 9;
      const k = q.life / q.max;
      if (k >= 1) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.fillStyle = k < 0.3 ? "#ffb347" : k < 0.55 ? "#f7d9b0" : "#ffffff";
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
    }
  }

  function frame(ms) {
    const t = ms / 1000;
    const dt = last ? Math.min(0.05, t - last) : 0;
    last = t; clock = t;
    ctx.clearRect(0, 0, w, h);
    for (const c of clouds) {
      if (!reduce) { c.x += c.v * dt; if (c.x > w + 200) { c.x = -400 * c.s; c.y = rand(0, h); } }
      ctx.globalAlpha = c.a; ctx.drawImage(cloudSprite, c.x, c.y, 360 * c.s, 160 * c.s);
    }
    if (!reduce) rockets.forEach((r) => stepRocket(r, dt));
    drawParticles(reduce ? 0 : dt);
    rockets.forEach(drawRocket);
    for (const p of planes) { if (!reduce) stepPlane(p, dt); drawPlane(p, t); }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }


  /* ---------- blueprint cards: the same wireframes, white on teal, for the fleet panel ---------- */
  function drawBlueprint(cv) {
    const g = kinds[cv.dataset.kind];
    if (!g) return;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const cw = cv.clientWidth, ch = cv.clientHeight;
    cv.width = cw * d; cv.height = ch * d;
    const c = cv.getContext("2d");
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = "#36627d"; c.fillRect(0, 0, cw, ch);
    for (let x = 0; x <= cw; x += 10) { c.strokeStyle = x % 50 === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"; c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, ch); c.stroke(); }
    for (let y = 0; y <= ch; y += 10) { c.strokeStyle = y % 50 === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"; c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(cw, y + 0.5); c.stroke(); }
    const size = Math.min(cw, ch) * 0.92, k = size / 200;
    c.translate(cw / 2 - size / 2, ch / 2 - size / 2); c.scale(k, k);
    c.lineJoin = "round"; c.lineCap = "round";
    c.fillStyle = "rgba(255,255,255,0.1)"; c.fill(g.fill);
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 0.8 / k; c.stroke(g.detail);
    c.strokeStyle = "#ffffff"; c.lineWidth = 1.6 / k; c.stroke(g.outline);
    c.fillStyle = "rgba(255,95,52,0.28)"; c.fill(g.engines);
    c.strokeStyle = "#ff5f34"; c.lineWidth = 1.5 / k; c.stroke(g.engines);
    c.lineWidth = 0.9 / k; c.stroke(g.enginesDetail);
    if (g.prop) { c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 1 / k; c.beginPath(); c.arc(g.prop.cx, g.prop.cy, g.prop.r, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(g.prop.cx - g.prop.r, g.prop.cy); c.lineTo(g.prop.cx + g.prop.r, g.prop.cy); c.stroke(); }
  }
  const drawCards = () => document.querySelectorAll("canvas.ac[data-kind]").forEach(drawBlueprint);
  drawCards();

  seed();
  if (reduce) rockets.forEach((r) => { r.state = "fly"; r.x = w * 0.8; r.y = h * 0.45; r.vy = -300; r.vx = 0; r.t = 1; });
  frame(0);
  if (!reduce) requestAnimationFrame(frame);

  let timer;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { seed(); drawCards(); if (reduce) frame(0); }, 150);
  });
})();
