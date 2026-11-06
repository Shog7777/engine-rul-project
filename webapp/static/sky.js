/* Daylight sky behind the page. Aircraft do not fly in straight lines: they soar in
   circles like birds, weave in S-curves like butterflies, hover and dart like bees,
   and the fast jets throw in a loop now and then. Flocks of birds circle between them,
   clouds drift, and rockets launch from below with flames and smoke.
   Everything is frozen in place when the user prefers reduced motion. */
(function () {
  const canvas = document.getElementById("sky");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  /* ---- aircraft outlines, nose up, on a 200 x 200 grid ---- */
  const P = (d) => new Path2D(d);
  const shapes = {
    airliner: {
      body: ["M100 8C108 8 112 20 112 40L112 150C112 170 106 188 100 196C94 188 88 170 88 150L88 40C88 20 92 8 100 8Z",
        "M112 70L186 118L186 128L112 104Z", "M88 70L14 118L14 128L88 104Z",
        "M112 160L148 180L148 186L112 176Z", "M88 160L52 180L52 186L88 176Z"].map(P),
      engines: [[142, 86, 12, 26], [46, 86, 12, 26]], contrail: true,
    },
    cargo: {
      body: ["M100 8C109 8 114 20 114 40L114 150C114 170 107 188 100 196C93 188 86 170 86 150L86 40C86 20 91 8 100 8Z",
        "M114 66L190 114L190 126L114 106Z", "M86 66L10 114L10 126L86 106Z",
        "M114 160L150 180L150 187L114 177Z", "M86 160L50 180L50 187L86 177Z"].map(P),
      engines: [[132, 78, 11, 24], [162, 96, 11, 24], [57, 78, 11, 24], [27, 96, 11, 24]], contrail: true,
    },
    bizjet: {
      body: ["M100 12C106 12 109 22 109 42L109 140C109 162 105 184 100 192C95 184 91 162 91 140L91 42C91 22 94 12 100 12Z",
        "M109 78L170 114L170 122L109 104Z", "M91 78L30 114L30 122L91 104Z",
        "M109 164L134 180L134 185L109 176Z", "M91 164L66 180L66 185L91 176Z"].map(P),
      engines: [[110, 130, 10, 28], [80, 130, 10, 28]], contrail: true,
    },
    heli: {
      body: [P("M95 120h10v62h-10z M92 176h16v10H92z"), (() => { const p = new Path2D(); p.ellipse(100, 90, 22, 38, 0, 0, TAU); return p; })()],
      engines: [[90, 70, 20, 30]], rotor: { type: "heli", cx: 100, cy: 90 },
    },
    drone: {
      body: [P("M82 82h36v36H82z"), P("M100 100L46 46 M100 100L154 46 M100 100L46 154 M100 100L154 154")],
      engines: [[92, 92, 16, 16]], rotor: { type: "quad", pts: [[46, 46], [154, 46], [46, 154], [154, 154]] },
    },
  };

  /* flight styles: how an aircraft turns */
  const PLAN = [
    ["airliner", "circle"], ["airliner", "weave"], ["airliner", "circle"], ["bizjet", "loop"], ["bizjet", "weave"],
    ["cargo", "circle"], ["heli", "bee"], ["drone", "bee"], ["drone", "bee"], ["airliner", "loop"],
  ];

  let w = 0, h = 0, dpr = 1, planes = [], clouds = [], birds = [], rockets = [], particles = [], last = 0, clock = 0;

  /* ---- cloud sprite ---- */
  const cloudSprite = (() => {
    const c = document.createElement("canvas");
    c.width = 360; c.height = 160;
    const g = c.getContext("2d");
    [[70, 100, 60], [140, 80, 70], [210, 90, 62], [275, 104, 52], [175, 112, 80]].forEach(([x, y, r]) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.6, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
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

    birds = Array.from({ length: 2 }, (_, f) => ({
      cx: w * (0.25 + 0.5 * f), cy: h * (0.3 + 0.3 * f), rx: rand(120, 260), ry: rand(70, 140),
      speed: rand(0.18, 0.3) * (f ? -1 : 1), phase: rand(0, TAU),
      members: Array.from({ length: 6 }, (__, k) => ({ lag: k * 0.16, off: rand(-14, 14), flap: rand(0, TAU) })),
    }));

    rockets = Array.from({ length: Math.max(1, Math.round(w / 700)) }, (_, i) => makeRocket(i * 6 + 2));
    particles = [];
  }

  function makePlane(kind, style) {
    const sh = shapes[kind];
    const layer = Math.random();                        // 0 far, 1 near
    return {
      kind, style, sh,
      size: sh.rotor ? 34 + layer * 40 : 34 + layer * 86,
      speed: sh.rotor ? rand(18, 42) : rand(46, 96) * (0.7 + layer * 0.5),
      x: rand(0, w), y: rand(h * 0.05, h * 0.95), th: rand(0, TAU),
      dir: Math.random() < 0.5 ? 1 : -1,
      amp: rand(0.35, 0.9), freq: rand(0.25, 0.6), ph: rand(0, TAU),
      loopAt: rand(3, 9), loopLeft: 0,
      alpha: 0.3 + layer * 0.42, spin: rand(0, TAU), trail: [],
      wx: rand(-6, 6), wy: rand(-3, 3),
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
    if (p.style === "circle") {
      turn = p.dir * p.amp * 0.9;                        // steady turn: soaring circles
    } else if (p.style === "weave") {
      turn = p.amp * 1.3 * Math.sin(clock * p.freq * 2 + p.ph);   // S-curves like a butterfly
    } else if (p.style === "loop") {
      p.loopAt -= dt;
      if (p.loopAt < 0 && p.loopLeft <= 0) { p.loopLeft = 3.2; p.loopAt = rand(7, 14); }
      if (p.loopLeft > 0) { p.loopLeft -= dt; turn = p.dir * 1.9; }              // loop the loop
      else turn = 0.18 * Math.sin(clock * 0.5 + p.ph);
    } else {                                              // bee: wandering, hovering, darting
      turn = 1.6 * Math.sin(clock * 1.1 + p.ph) * Math.sin(clock * 0.37 + p.ph * 2);
    }
    turn = steerHome(p, turn);
    p.th += turn * dt;
    const pace = p.style === "bee" ? 0.35 + 0.65 * Math.abs(Math.sin(clock * 0.6 + p.ph)) : 1;
    p.x += (Math.cos(p.th) * p.speed * pace + p.wx) * dt;
    p.y += (Math.sin(p.th) * p.speed * pace + p.wy) * dt;
    if (p.sh.contrail) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 70) p.trail.shift();
    }
  }

  function drawPlane(p, t) {
    if (p.sh.contrail && p.trail.length > 2) {           // contrail follows the curve
      ctx.lineCap = "round";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.4, p.size * 0.04);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.globalAlpha = (i / p.trail.length) * 0.6 * (0.5 + p.alpha);
        ctx.beginPath();
        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.th + Math.PI / 2);
    const k = p.size / 200;
    ctx.scale(k, k);
    ctx.translate(-100, -100);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = "#fff6e2";
    ctx.strokeStyle = "#2f1b1b";
    ctx.lineWidth = 3 / Math.max(k * 6, 0.6) + 1.2;
    ctx.lineJoin = "round";
    p.sh.body.forEach((path) => { ctx.fill(path); ctx.stroke(path); });
    ctx.fillStyle = "#ff8a66";
    ctx.strokeStyle = "#ca413f";
    p.sh.engines.forEach(([x, y, ww, hh]) => {
      ctx.beginPath(); ctx.roundRect(x, y, ww, hh, Math.min(ww, hh) / 2); ctx.fill(); ctx.stroke();
    });
    const r = p.sh.rotor;
    if (r) {
      ctx.strokeStyle = "#2f1b1b"; ctx.lineWidth = 4; ctx.lineCap = "round";
      const a = reduce ? p.spin : p.spin + t * (r.type === "heli" ? 9 : 40);
      const blade = (cx, cy, len) => {
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * len, cy - Math.sin(a) * len);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      };
      if (r.type === "heli") {
        ctx.globalAlpha = p.alpha * 0.35; ctx.beginPath(); ctx.arc(r.cx, r.cy, 82, 0, TAU); ctx.stroke();
        ctx.globalAlpha = p.alpha; blade(r.cx, r.cy, 82);
      } else {
        r.pts.forEach(([cx, cy]) => {
          ctx.globalAlpha = p.alpha * 0.35; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, TAU); ctx.stroke();
          ctx.globalAlpha = p.alpha; blade(cx, cy, 28);
        });
      }
    }
    ctx.restore();
  }

  /* ---- birds circling in a flock ---- */
  function drawBirds(t) {
    ctx.strokeStyle = "#2f1b1b";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    birds.forEach((f) => {
      f.members.forEach((m) => {
        const a = f.phase + (reduce ? 0 : t) * f.speed - m.lag * Math.sign(f.speed);
        const x = f.cx + Math.cos(a) * f.rx + m.off;
        const y = f.cy + Math.sin(a * 1.3) * f.ry + m.off * 0.6;
        const heading = Math.atan2(Math.cos(a * 1.3) * 1.3 * f.ry, -Math.sin(a) * f.rx) * Math.sign(f.speed || 1);
        const flap = reduce ? 3 : Math.sin(t * 7 + m.flap) * 5;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(heading);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(-8, flap - 2); ctx.quadraticCurveTo(-4, -flap - 3, 0, 0);
        ctx.quadraticCurveTo(4, -flap - 3, 8, flap - 2);
        ctx.stroke();
        ctx.restore();
      });
    });
  }

  /* ---- rockets launching with flame and smoke ---- */
  function makeRocket(delay) {
    return { state: "wait", at: delay, x: 0, y: 0, vy: 0, vx: 0, t: 0, size: rand(70, 110), tint: ["#ca413f", "#36627d", "#ff5f34"][(Math.random() * 3) | 0] };
  }
  const rocketBody = new Path2D("M-9 -30C-9 -50 -4 -62 0 -66C4 -62 9 -50 9 -30L9 36L-9 36Z");
  const rocketFins = new Path2D("M-9 18L-24 46L-9 36Z M9 18L24 46L9 36Z");

  function stepRocket(r, dt) {
    if (r.state === "wait") {
      r.at -= dt;
      if (r.at <= 0) { r.state = "fly"; r.x = rand(w * 0.06, w * 0.94); r.y = h + 90; r.vy = -70; r.vx = rand(-18, 18); r.t = 0; }
      return;
    }
    r.t += dt;
    r.vy = Math.max(-560, r.vy - (90 + r.t * 90) * dt);
    r.x += (r.vx + Math.sin(r.t * 1.4) * 22) * dt;
    r.y += r.vy * dt;
    for (let i = 0; i < 3; i++) {
      particles.push({ x: r.x + rand(-3, 3), y: r.y + r.size * 0.45, vx: rand(-22, 22), vy: rand(40, 120) - r.vy * 0.15,
        life: 0, max: rand(0.9, 1.8), r: rand(3, 6) });
    }
    if (r.y < -140) { r.state = "wait"; r.at = rand(8, 16); }
  }

  function drawRocket(r) {
    if (r.state !== "fly") return;
    const ang = Math.atan2(r.vy, r.vx + Math.sin(r.t * 1.4) * 22) + Math.PI / 2;
    const k = r.size / 120;
    ctx.save();
    ctx.translate(r.x, r.y); ctx.rotate(ang); ctx.scale(k, k);
    const flame = ctx.createLinearGradient(0, 36, 0, 110 + Math.random() * 18);
    flame.addColorStop(0, "rgba(255,244,190,0.95)"); flame.addColorStop(0.4, "rgba(255,150,40,0.85)"); flame.addColorStop(1, "rgba(255,90,20,0)");
    ctx.globalAlpha = 1; ctx.fillStyle = flame;
    ctx.beginPath(); ctx.moveTo(-7, 36); ctx.quadraticCurveTo(0, 130, 7, 36); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff6e2"; ctx.strokeStyle = "#2f1b1b"; ctx.lineWidth = 2.4; ctx.lineJoin = "round";
    ctx.fill(rocketBody); ctx.stroke(rocketBody);
    ctx.fillStyle = r.tint; ctx.fill(rocketFins); ctx.stroke(rocketFins);
    ctx.beginPath(); ctx.moveTo(-9, -34); ctx.quadraticCurveTo(0, -78, 9, -34); ctx.closePath(); ctx.fillStyle = r.tint; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -14, 5.5, 0, TAU); ctx.fillStyle = "#9fc6da"; ctx.fill(); ctx.stroke();
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
      ctx.globalAlpha = c.a;
      ctx.drawImage(cloudSprite, c.x, c.y, 360 * c.s, 160 * c.s);
    }
    if (!reduce) { rockets.forEach((r) => stepRocket(r, dt)); }
    drawParticles(reduce ? 0 : dt);
    rockets.forEach(drawRocket);
    drawBirds(t);
    for (const p of planes) { if (!reduce) stepPlane(p, dt); drawPlane(p, t); }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }

  seed();
  if (reduce) { rockets.forEach((r) => { r.state = "fly"; r.x = w * 0.8; r.y = h * 0.45; r.vy = -300; r.vx = 0; r.t = 1; }); }
  frame(0);
  if (!reduce) requestAnimationFrame(frame);

  let timer;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { seed(); if (reduce) frame(0); }, 150);
  });
})();
