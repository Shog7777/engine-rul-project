/* Ground scene near the end of the page: mountains at sunrise, a road with fast sports
   cars (generic coupe silhouettes, wheels and speed lines), and a rocket on a launch
   pad that lifts off from time to time. Frozen when the user prefers reduced motion. */
(function () {
  const canvas = document.getElementById("ground");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  let w = 0, h = 0, dpr = 1, cars = [], rocket, smoke = [], last = 0, dashOffset = 0;

  /* sports coupe, side view, nose to the right, drawn on a 200 x 80 grid */
  const carBody = new Path2D("M6 56L6 46C18 41 36 39 58 35L84 19C92 14 124 13 138 21L168 35C184 39 196 45 196 56Z");
  const carGlass = new Path2D("M92 23C100 19 122 19 132 25L152 35L88 35Z");
  const carWing = new Path2D("M10 40L10 30L30 30L30 34L16 36Z");

  const palette = [
    { body: "#ca413f", trim: "#7a1f1e" },     // cool red
    { body: "#ff5f34", trim: "#8a2d12" },     // orange
    { body: "#ffebc2", trim: "#404241" },     // cream
    { body: "#36627d", trim: "#1b3442" },     // sky teal
  ];

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    size();
    cars = palette.map((c, i) => ({
      ...c, lane: i % 2, dir: i % 2 ? -1 : 1,
      x: rand(0, w), speed: rand(260, 460), scale: rand(0.8, 1.0), spin: 0,
    }));
    rocket = { state: "wait", at: 3, y: 0, vy: 0, t: 0 };
    smoke = [];
  }

  const padX = () => Math.min(w - 60, w * 0.86);
  const groundY = () => h - 84;           // top of the road

  function drawBackdrop() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#9fc6da"); g.addColorStop(0.55, "#ffebc2"); g.addColorStop(1, "#ffb98f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const sun = ctx.createRadialGradient(w * 0.22, h * 0.62, 4, w * 0.22, h * 0.62, 90);
    sun.addColorStop(0, "rgba(255,247,214,1)"); sun.addColorStop(0.35, "rgba(255,214,140,0.6)"); sun.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
    const ridge = (base, amp, color, seedPhase) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 10) {
        const y = base - Math.abs(Math.sin(x * 0.011 + seedPhase)) * amp - Math.sin(x * 0.031 + seedPhase * 2) * amp * 0.25;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    };
    ridge(groundY() - 6, 70, "rgba(54,98,125,0.42)", 1.2);
    ridge(groundY() + 4, 44, "rgba(54,98,125,0.72)", 3.4);
    // road
    ctx.fillStyle = "#404241"; ctx.fillRect(0, groundY(), w, h - groundY());
    ctx.fillStyle = "#ff5f34"; ctx.fillRect(0, groundY(), w, 3);
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
    ctx.lineDashOffset = -dashOffset;
    ctx.beginPath(); ctx.moveTo(0, groundY() + 44); ctx.lineTo(w, groundY() + 44); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCar(c) {
    const y = groundY() + (c.lane ? 16 : -8);
    ctx.save();
    ctx.translate(c.x, y);
    ctx.scale(c.dir * c.scale, c.scale);
    // speed lines behind the car
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.75 - i * 0.15;
      ctx.beginPath(); ctx.moveTo(-12 - i * 6, 28 + i * 7); ctx.lineTo(-70 - i * 22 - c.speed * 0.06, 28 + i * 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.body; ctx.strokeStyle = "#2f1b1b"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.fill(carBody); ctx.stroke(carBody);
    ctx.fillStyle = c.trim; ctx.fill(carWing); ctx.stroke(carWing);
    ctx.fillStyle = "#bcd9e6"; ctx.fill(carGlass); ctx.stroke(carGlass);
    ctx.fillStyle = "#fff6c9"; ctx.fillRect(186, 46, 8, 5);                 // headlight
    [52, 150].forEach((wx) => {                                             // wheels with spokes
      ctx.save(); ctx.translate(wx, 58); ctx.rotate(c.spin);
      ctx.fillStyle = "#2f1b1b"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.stroke(); }
      ctx.restore();
    });
    ctx.restore();
  }

  /* rocket on the pad */
  const body = new Path2D("M-9 -30C-9 -50 -4 -62 0 -66C4 -62 9 -50 9 -30L9 36L-9 36Z");
  const fins = new Path2D("M-9 18L-24 46L-9 36Z M9 18L24 46L9 36Z");

  function drawRocket() {
    const x = padX();
    const base = groundY();
    // launch tower
    ctx.strokeStyle = "#2f1b1b"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 46, base); ctx.lineTo(x - 46, base - 120); ctx.moveTo(x - 46, base - 100); ctx.lineTo(x - 22, base - 100);
    ctx.moveTo(x - 46, base - 60); ctx.lineTo(x - 22, base - 60); ctx.stroke();
    const k = 1.05;
    const y = rocket.state === "fly" ? rocket.y : base - 44 * k;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    if (rocket.state === "fly") {
      const f = ctx.createLinearGradient(0, 36, 0, 120 + Math.random() * 20);
      f.addColorStop(0, "rgba(255,244,190,0.95)"); f.addColorStop(0.4, "rgba(255,150,40,0.85)"); f.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(-7, 36); ctx.quadraticCurveTo(0, 140, 7, 36); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#fff6e2"; ctx.strokeStyle = "#2f1b1b"; ctx.lineWidth = 2.4; ctx.lineJoin = "round";
    ctx.fill(body); ctx.stroke(body);
    ctx.fillStyle = "#ca413f"; ctx.fill(fins); ctx.stroke(fins);
    ctx.beginPath(); ctx.moveTo(-9, -34); ctx.quadraticCurveTo(0, -78, 9, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -14, 5.5, 0, TAU); ctx.fillStyle = "#9ad1ff"; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function stepRocket(dt) {
    const base = groundY();
    if (rocket.state === "wait") {
      rocket.at -= dt;
      if (rocket.at <= 0) { rocket.state = "fly"; rocket.y = base - 46; rocket.vy = -20; rocket.t = 0; }
    } else {
      rocket.t += dt;
      rocket.vy = Math.max(-620, rocket.vy - (160 + rocket.t * 220) * dt);
      rocket.y += rocket.vy * dt;
      for (let i = 0; i < 4; i++) smoke.push({ x: padX() + rand(-6, 6), y: rocket.y + 50, vx: rand(-40, 40), vy: rand(30, 90), life: 0, max: rand(0.8, 1.7), r: rand(4, 8) });
      if (rocket.y < -150) { rocket.state = "wait"; rocket.at = rand(5, 9); }
    }
  }

  function drawSmoke(dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const q = smoke[i];
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 12;
      const k = q.life / q.max;
      if (k >= 1) { smoke.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.fillStyle = k < 0.25 ? "#ffb347" : "#ffffff";
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(ms) {
    const t = ms / 1000;
    const dt = last ? Math.min(0.05, t - last) : 0;
    last = t;
    if (!reduce) {
      dashOffset = (dashOffset + 380 * dt) % 48;
      cars.forEach((c) => {
        c.x += c.dir * c.speed * dt; c.spin += c.dir * c.speed * dt * 0.08;
        if (c.dir > 0 && c.x > w + 260) c.x = -260;
        if (c.dir < 0 && c.x < -260) c.x = w + 260;
      });
      stepRocket(dt);
    }
    drawBackdrop();
    drawSmoke(reduce ? 0 : dt);
    drawRocket();
    cars.forEach(drawCar);
    if (!reduce) requestAnimationFrame(frame);
  }

  seed();
  if (reduce) { rocket.state = "fly"; rocket.y = groundY() - 160; rocket.vy = -300; }
  frame(0);
  if (!reduce) requestAnimationFrame(frame);
  window.addEventListener("resize", () => { seed(); if (reduce) frame(0); });
})();
