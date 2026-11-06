/* "On the pad": a launch vehicle in the same engineering-blueprint style as the aircraft.
   White fine lines on sky teal, with dimension lines and callouts while it waits on the
   pad. Then it lifts off: the callouts fade, the grid streams downward and the engines
   burn orange. Frozen in a single frame when the user prefers reduced motion. */
(function () {
  const canvas = document.getElementById("launch");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  let w = 0, h = 0, dpr = 1, state = "wait", at = 4, y = 0, vy = 0, t = 0, gridShift = 0, smoke = [], last = 0;

  /* rocket geometry in local units, nose at y = -100, engines at y = 100 */
  const hull = new Path2D("M0 -104C10 -86 15 -58 15 -34L15 90L-15 90L-15 -34C-15 -58 -10 -86 0 -104Z");
  const boosters = new Path2D();
  [-1, 1].forEach((s) => {
    boosters.roundRect(s > 0 ? 15 : -27, -12, 12, 98, 5);
    boosters.moveTo(s * 15, -12); boosters.quadraticCurveTo(s * 21, -34, s * 21, -34);
    boosters.moveTo(s * 15, -12); boosters.lineTo(s * 21, -34); boosters.lineTo(s * 27 - (s > 0 ? 0 : 0), -12);
  });
  const lines = new Path2D();
  [-60, -34, -4, 26, 56].forEach((yy) => { lines.moveTo(-15, yy); lines.lineTo(15, yy); });
  lines.moveTo(0, -104); lines.lineTo(0, 90); lines.moveTo(-7, -34); lines.lineTo(-7, 90); lines.moveTo(7, -34); lines.lineTo(7, 90);
  lines.ellipse(0, -42, 5.5, 5.5, 0, 0, TAU);
  const fins = new Path2D("M-15 60L-36 104L-15 90Z M15 60L36 104L15 90Z");
  const bells = new Path2D();
  [-9, 0, 9].forEach((bx) => { bells.moveTo(bx - 4, 90); bells.lineTo(bx - 6, 102); bells.lineTo(bx + 6, 102); bells.lineTo(bx + 4, 90); });

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const padY = () => h - 56;           // top of the pad
  const scale = () => Math.min(1.05, h / 330);
  const padPos = () => padY() - 102 * scale();    // rocket centre when standing

  function reset() { state = "wait"; at = reduce ? 0 : 3.5; y = padPos(); vy = 0; t = 0; smoke = []; }

  function grid() {
    ctx.fillStyle = "#36627d"; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,255,255,0.07)"); g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const step = 16;
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += step) { ctx.strokeStyle = x % (step * 5) === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.09)"; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
    for (let yy = -step * 5; yy <= h + step * 5; yy += step) {
      const yv = yy + (gridShift % (step * 5));
      ctx.strokeStyle = Math.round(yy / step) % 5 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.09)";
      ctx.beginPath(); ctx.moveTo(0, yv + 0.5); ctx.lineTo(w, yv + 0.5); ctx.stroke();
    }
  }

  function pad() {
    const py = padY();
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(0, py, w, h - py);
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1;
    for (let x = -h; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + (h - py), py); ctx.stroke(); }
    // launch tower
    const tx = w / 2 + 70 * scale();
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tx, py); ctx.lineTo(tx, py - 190 * scale()); ctx.moveTo(tx + 12, py); ctx.lineTo(tx + 12, py - 190 * scale()); ctx.stroke();
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 9; i++) { const yy = py - i * 21 * scale(); ctx.beginPath(); ctx.moveTo(tx, yy); ctx.lineTo(tx + 12, yy - 21 * scale()); ctx.moveTo(tx + 12, yy); ctx.lineTo(tx, yy - 21 * scale()); ctx.stroke(); }
  }

  function annotations(alpha) {
    if (alpha <= 0.02) return;
    const s = scale(), cx = w / 2, cy = padPos();
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1;
    ctx.font = "11px 'B612 Mono', ui-monospace, Consolas, monospace";
    const call = (label, ry, side) => {
      const x0 = cx + side * 26 * s, x1 = cx + side * 96 * s, yy = cy + ry * s;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.lineTo(x1 + side * 12, yy - 12); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0, yy, 2.4, 0, TAU); ctx.fill();
      ctx.textAlign = side > 0 ? "left" : "right"; ctx.fillText(label, x1 + side * 16, yy - 12);
    };
    call("Payload", -70, -1); call("Stage 2", -4, -1); call("Boosters", 52, -1); call("Engines", 98, 1);
    // height dimension line on the left
    const dx = cx - 120 * s, top = cy - 104 * s, bottom = cy + 104 * s;
    ctx.beginPath(); ctx.moveTo(dx, top); ctx.lineTo(dx, bottom);
    ctx.moveTo(dx - 5, top); ctx.lineTo(dx + 5, top); ctx.moveTo(dx - 5, bottom); ctx.lineTo(dx + 5, bottom); ctx.stroke();
    ctx.save(); ctx.translate(dx - 8, cy); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText("Illustration, not to scale", 0, 0); ctx.restore();
    ctx.restore();
  }

  function rocketDraw(cy, flame) {
    const s = scale(), cx = w / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (flame > 0) {
      const f = ctx.createLinearGradient(0, 100, 0, 100 + 110 * flame + Math.random() * 18);
      f.addColorStop(0, "rgba(255,244,190,0.95)"); f.addColorStop(0.4, "rgba(255,95,52,0.9)"); f.addColorStop(1, "rgba(255,95,52,0)");
      ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(-14, 100); ctx.quadraticCurveTo(0, 100 + 190 * flame, 14, 100); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill(hull); ctx.fill(boosters);
    ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.5 / s;
    ctx.stroke(hull); ctx.stroke(boosters); ctx.stroke(fins);
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 0.9 / s; ctx.stroke(lines);
    ctx.strokeStyle = "#ff5f34"; ctx.lineWidth = 1.6 / s; ctx.stroke(bells);
    ctx.restore();
  }

  function frame(ms) {
    const sec = ms / 1000;
    const dt = last ? Math.min(0.05, sec - last) : 0;
    last = sec;
    if (!reduce) {
      if (state === "wait") { at -= dt; if (at <= 0) { state = "fly"; t = 0; vy = -10; } }
      else {
        t += dt; vy = Math.max(-640, vy - (140 + t * 200) * dt); y += vy * dt;
        gridShift += -vy * dt * 0.7;
        for (let i = 0; i < 4; i++) smoke.push({ x: w / 2 + rand(-8, 8), y: y + 110 * scale(), vx: rand(-50, 50), vy: rand(40, 120), life: 0, max: rand(0.9, 1.8), r: rand(4, 8) });
        if (y < -220) reset();
      }
    }
    grid(); pad();
    smoke.forEach((q, i) => {
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 12;
      const k = q.life / q.max; if (k >= 1) { smoke[i] = null; return; }
      ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = k < 0.25 ? "#ffb347" : "#ffffff"; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
    });
    smoke = smoke.filter(Boolean); ctx.globalAlpha = 1;
    const standing = state === "wait";
    const fade = standing ? 1 : Math.max(0, 1 - t * 2.2);
    annotations(reduce ? 1 : fade);
    rocketDraw(standing ? padPos() : y, standing ? 0 : Math.min(1, t * 2));
    // title block like a technical drawing
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1; ctx.strokeRect(w - 150.5, 8.5, 140, 38);
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.font = "10px 'B612 Mono', ui-monospace, Consolas, monospace"; ctx.textAlign = "left";
    ctx.fillText("LAUNCH VEHICLE", w - 142, 24); ctx.fillText("Sheet 1 of 1", w - 142, 38);
    if (!reduce) requestAnimationFrame(frame);
  }

  size(); reset();
  if (reduce) { state = "fly"; t = 0.4; y = h * 0.4; }
  frame(0);
  if (!reduce) requestAnimationFrame(frame);
  window.addEventListener("resize", () => { size(); reset(); if (reduce) { state = "fly"; y = h * 0.4; frame(0); } });
})();
