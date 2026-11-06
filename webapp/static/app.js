(() => {
  const MAX_RUL = 150;                      // the dial shows 0 to 150 cycles
  const CAP = 125;                          // the models are trained on min(RUL, 125)
  const CX = 230, CY = 230, R = 170;
  const START = -225, SWEEP = 270;          // degrees: dial opens at the bottom, like an engine gauge
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const NAMES = {
    cycle: "Operating cycle", setting_1: "Operating setting 1", setting_2: "Operating setting 2",
    sensor_2: "LPC outlet temperature", sensor_3: "HPC outlet temperature", sensor_4: "LPT outlet temperature",
    sensor_6: "Bypass duct pressure", sensor_7: "HPC outlet pressure", sensor_8: "Fan speed",
    sensor_9: "Core speed", sensor_11: "HPC outlet static pressure", sensor_12: "Fuel flow ratio",
    sensor_13: "Corrected fan speed", sensor_14: "Corrected core speed", sensor_15: "Bypass ratio",
    sensor_17: "Bleed enthalpy", sensor_20: "HPT coolant bleed", sensor_21: "LPT coolant bleed",
  };
  const friendly = (f) => NAMES[f] || f;

  const STAGES = [
    { name: "Healthy", tone: "green" }, { name: "Strong", tone: "green" }, { name: "Aging", tone: "green" },
    { name: "Halfway", tone: "amber" }, { name: "Wearing", tone: "amber" }, { name: "Watch closely", tone: "amber" },
    { name: "Service soon", tone: "red" }, { name: "End of life", tone: "red" },
  ];
  const stageOf = (rul) => Math.min(7, Math.max(0, Math.floor((1 - Math.min(Math.max(rul, 0), CAP) / CAP) * 8)));

  const $ = (id) => document.getElementById(id);
  const state = { features: [], models: [], engines: [], results: [], selected: "Gradient Boosting",
                  predictions: null, trueRul: null, engineId: null, trajectory: null,
                  base: null, engineTrue: null, edited: false, outside: [] };

  /* ---------- dial ---------- */
  const angleOf = (v) => START + (Math.min(Math.max(v, 0), MAX_RUL) / MAX_RUL) * SWEEP;   // degrees
  const pt = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  };
  function arcPath(v0, v1, r) {
    const a = pt(angleOf(v0), r), b = pt(angleOf(v1), r);
    const large = angleOf(v1) - angleOf(v0) > 180 ? 1 : 0;
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }

  function drawDial() {
    // colour bands: red 0-30, orange 30-80, teal 80-150
    $("bands").innerHTML =
      `<path class="band red" d="${arcPath(0, 30, R)}"/>` +
      `<path class="band amber" d="${arcPath(30, 80, R)}"/>` +
      `<path class="band green" d="${arcPath(80, MAX_RUL, R)}"/>`;
    let html = "";
    for (let v = 0; v <= MAX_RUL; v += 5) {
      const major = v % 25 === 0, a = angleOf(v);
      const p1 = pt(a, R + 12), p2 = pt(a, R + (major ? 28 : 20));
      html += `<line class="tick${major ? " major" : ""}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>`;
      if (major) {
        const l = pt(a, R + 46);
        html += `<text class="tick-label" x="${l.x}" y="${l.y}">${v}</text>`;
      }
    }
    $("dial-ticks").innerHTML = html;

    // turbofan blades behind the readout
    let blades = "";
    for (let i = 0; i < 18; i++) {
      blades += `<path transform="rotate(${i * 20} ${CX} ${CY})" d="M ${CX} ${CY - 22} C ${CX + 26} ${CY - 70}, ${CX + 34} ${CY - 110}, ${CX + 10} ${CY - 128} C ${CX + 8} ${CY - 100}, ${CX + 4} ${CY - 60}, ${CX} ${CY - 22} Z"/>`;
    }
    $("fan").innerHTML = blades;

    let mini = "";
    for (let i = 0; i < 8; i++) {
      mini += `<path transform="rotate(${i * 45} 16 16)" d="M16 16 C19 11 21 7 18 4 C17 8 16 12 16 16Z" fill="currentColor"/>`;
    }
    $("brand-fan").innerHTML = mini;
  }

  let rafId;
  function animateNumber(el, to) {
    cancelAnimationFrame(rafId);
    if (reduce || document.hidden) { el.textContent = Math.round(to); el.dataset.v = to; return; }
    const from = parseFloat(el.dataset.v || "0");
    const start = performance.now(), dur = 900;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = from + (to - from) * e;
      el.textContent = Math.round(v);
      el.dataset.v = v;
      if (k < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function renderGauge() {
    const value = Math.max(0, state.predictions[state.selected]);
    $("needle").style.transform = `rotate(${angleOf(value) + 90}deg)`;

    const bug = $("true-bug");
    if (state.trueRul != null) {
      const a = angleOf(state.trueRul), p = pt(a, R - 24);
      bug.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${a + 90})`);
      bug.setAttribute("opacity", 1);
    } else {
      bug.setAttribute("opacity", 0);
    }
    animateNumber($("rul"), value);
    $("unit").textContent = value >= CAP - 5 ? "cycles left (125 or more)" : "cycles left";

    if (state.trueRul != null) {
      const diff = value - state.trueRul;
      const word = Math.abs(diff) < 0.5 ? "right on target"
        : diff > 0 ? `${diff.toFixed(0)} cycles too optimistic` : `${(-diff).toFixed(0)} cycles too cautious`;
      $("compare").innerHTML = `NASA recorded <b>${state.trueRul}</b> cycles, ${word}`;
    } else {
      const far = state.outside.length ? ` Some readings (${state.outside.slice(0, 3).join(", ")}${state.outside.length > 3 ? "…" : ""}) are outside the range seen in training, so treat the estimate with caution.` : "";
      $("compare").innerHTML = state.edited ? "Edited readings, so there is no NASA value to compare." + far : "&nbsp;";
    }
  }

  /* ---------- life stage panel ---------- */
  function renderStage() {
    const value = Math.max(0, state.predictions[state.selected]);
    const now = stageOf(value);
    $("stage").innerHTML = STAGES.map((s, i) =>
      `<div class="cell${i === now ? " is-now" : ""}" role="listitem" data-tone="${s.tone}"${i === now ? ' aria-current="true"' : ""}>${s.name}</div>`).join("");
    let text = `${state.selected} puts this engine in the “${STAGES[now].name}” stage with ${Math.round(value)} cycles left.`;
    if (state.trueRul != null) {
      const real = stageOf(state.trueRul);
      text += real === now ? " NASA’s true value agrees."
        : ` NASA’s true value, ${state.trueRul} cycles, is “${STAGES[real].name}”.`;
    }
    $("phase-text").textContent = text;
  }

  /* ---------- journey chart ---------- */
  function renderJourney() {
    const t = state.trajectory;
    if (!t) return;
    const pred = t.predictions[state.selected];
    const trueShown = t.true_rul.map((v) => Math.min(v, CAP));
    const W = 1000, H = 340, L = 52, Rr = 18, T = 16, B = 36;
    const yMax = Math.ceil(Math.max(...trueShown, ...pred) / 25) * 25;
    const xMax = t.cycles[t.cycles.length - 1];
    const sx = (c) => L + ((c - 1) / Math.max(1, xMax - 1)) * (W - L - Rr);
    const sy = (v) => T + (1 - Math.max(0, v) / yMax) * (H - T - B);
    const path = (arr) => arr.map((v, i) => `${sx(t.cycles[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");

    let grid = "";
    for (let v = 0; v <= yMax; v += 25) {
      grid += `<line class="grid-line" x1="${L}" x2="${W - Rr}" y1="${sy(v)}" y2="${sy(v)}"/>
               <text class="axis-label" x="${L - 10}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
    }
    const step = Math.max(10, Math.ceil(xMax / 8 / 10) * 10);
    for (let c = step; c <= xMax; c += step) {
      grid += `<text class="axis-label" x="${sx(c)}" y="${H - 12}" text-anchor="middle">${c}</text>`;
    }
    grid += `<text class="axis-label" x="${(L + W - Rr) / 2}" y="${H}" text-anchor="middle">cycle</text>`;

    const lx = sx(xMax), ly = sy(pred[pred.length - 1]);
    $("journey").innerHTML = `${grid}
      <polyline class="line-true" points="${path(trueShown)}"/>
      <polyline class="line-pred" points="${path(pred)}"/>
      <circle class="dot-pred" cx="${lx}" cy="${ly}" r="5"/>`;

    const err = pred.map((p, i) => Math.abs(p - trueShown[i]));
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const q = Math.max(1, Math.floor(err.length / 4));
    const pl = (n) => `${n} cycle${n === 1 ? "" : "s"}`;
    const m = (a) => Math.round(mean(a));
    $("journey-text").textContent =
      `${state.selected} on engine ${state.engineId}: on average ${pl(m(err))} away from the truth (capped at 125, like the training target) across ${err.length} observed cycles. ` +
      `In the first quarter of the history it is ${pl(m(err.slice(0, q)))} off; in the last quarter, ${pl(m(err.slice(-q)))}.`;
  }

  /* ---------- sensor signals ---------- */
  function renderSignals() {
    const t = state.trajectory;
    if (!t) return;
    $("signals").innerHTML = Object.entries(t.sensors).map(([name, vals]) => {
      const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
      const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1) * 200).toFixed(1)},${(52 - ((v - lo) / span) * 48 - 2).toFixed(1)}`).join(" ");
      const k = Math.max(1, Math.min(5, Math.floor(vals.length / 4)));
      const first = vals.slice(0, k).reduce((a, b) => a + b, 0) / k;
      const last = vals.slice(-k).reduce((a, b) => a + b, 0) / k;
      const pct = ((last - first) / Math.abs(first)) * 100;
      const dir = Math.abs(pct) < 0.05 ? "barely moved" : pct > 0 ? `rose ${pct.toFixed(1)}%` : `fell ${(-pct).toFixed(1)}%`;
      return `<div class="signal"><b>${friendly(name)}</b><small>${name}</small>
        <svg viewBox="0 0 200 52" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>
        <span class="delta">${dir} over the observed cycles</span></div>`;
    }).join("");
  }

  /* ---------- model bars ---------- */
  function renderBars() {
    const preds = state.predictions;
    const trueShown = state.trueRul == null ? 0 : Math.min(state.trueRul, MAX_RUL);
    const max = Math.max(MAX_RUL * 0.5, ...Object.values(preds), trueShown) * 1.1;
    $("bars").innerHTML = state.models.map((name) => {
      const v = Math.max(0, preds[name]);
      const sel = name === state.selected ? " is-selected" : "";
      const tr = state.trueRul != null
        ? `<span class="bar-true" style="left:${Math.min(100, (trueShown / max) * 100)}%" title="NASA recorded ${state.trueRul} cycles"></span>` : "";
      const note = preds[name] < 0 ? "Negative: impossible, the model extrapolated below zero" : "";
      return `<div class="bar-row${sel}">
        <div class="bar-name">${name}</div>
        <div class="bar-track"><div class="bar-fill" data-w="${(v / max) * 100}"></div>${tr}</div>
        <div class="bar-value" title="${note}">${preds[name].toFixed(1)}</div></div>`;
    }).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll(".bar-fill").forEach((b) => (b.style.transform = `scaleX(${b.dataset.w / 100})`));
    }));
  }

  function renderChips() {
    $("model-chips").innerHTML = state.models.map((m) =>
      `<button class="chip" type="button" aria-pressed="${m === state.selected}" data-model="${m}">${m}</button>`).join("");
  }

  function renderResults() { renderGauge(); renderStage(); renderBars(); renderJourney(); }

  /* ---------- static sections ---------- */
  function renderImportance(rows) {
    const top = rows.slice(0, 8);
    $("importance").innerHTML = top.map((r) =>
      `<div class="imp-row"><div class="imp-name">${friendly(r.feature)}<small>${r.feature}</small></div>
       <div class="imp-track"><div class="imp-fill" data-w="${r.importance / top[0].importance}"></div></div>
       <div class="imp-val">${(r.importance * 100).toFixed(1)}%</div></div>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll(".imp-fill").forEach((b) => (b.style.transform = `scaleX(${b.dataset.w})`));
    }));
  }

  function renderFacts(d) {
    const items = [
      ["Engines in the training data", d.engines],
      ["Sensor readings", d.readings.toLocaleString("en-US")],
      ["Median engine life", `${d.median_life} cycles`],
      ["Shortest and longest life", `${d.shortest_life} to ${d.longest_life}`],
      ["Inputs per model", d.features],
    ];
    $("facts").innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }


  /* ---------- engineering drawing: simplified turbofan section ---------- */
  function buildEngine() {
    const lerp = (x, x0, x1, y0, y1) => y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    const casing = (x) => (x < 180 ? -50 : x < 330 ? lerp(x, 180, 330, -50, -44) : x < 480 ? lerp(x, 330, 480, -44, -31) : x < 580 ? -33 : lerp(x, 580, 770, -33, -46));
    const hub = (x) => (x < 180 ? -26 : x < 330 ? lerp(x, 180, 330, -26, -22) : x < 480 ? lerp(x, 330, 480, -22, -13) : x < 580 ? -9 : lerp(x, 580, 770, -9, -14));
    const f = (n) => n.toFixed(1);

    let half = "";
    // outer nacelle (cowl) and the inner wall of the bypass duct
    half += `<path class="ln" d="M 78,-46 C 76,-84 122,-100 196,-102 L 610,-102 C 730,-102 810,-80 872,-30"/>`;
    half += `<path class="ln" d="M 78,-46 C 92,-62 112,-70 142,-72 L 330,-72"/>`;
    half += `<path class="ln" d="M 330,-44 L 480,-31 L 580,-33 L 770,-46 L 872,-30"/>`;       // core cowl
    half += `<path class="thin" d="M 330,-72 L 330,-44"/>`;
    // spinner and fan disc
    half += `<path class="tint" d="M 78,0 C 90,-14 112,-24 146,-28 L 146,0 Z"/>`;
    // fan blades
    for (let i = 0; i < 3; i++) {
      const x = 152 + i * 7;
      half += `<path class="tint" d="M ${x},-27 L ${x + 5},-27 L ${x + 11},-93 L ${x + 6},-93 Z"/>`;
    }
    // compressor and turbine blades: lines between hub and casing
    const blade = (x) => `<line class="thin" x1="${x}" y1="${f(hub(x))}" x2="${x}" y2="${f(casing(x))}"/>`;
    for (let x = 196; x <= 322; x += 14) half += blade(x);                     // LPC
    for (let x = 342; x <= 472; x += 10) half += blade(x);                     // HPC
    for (let x = 592; x <= 612; x += 20) half += blade(x);                     // HPT
    for (let x = 650; x <= 746; x += 24) half += blade(x);                     // LPT
    // hub line along the core
    half += `<path class="ln" d="M 146,-26 L 330,-22 L 480,-13 L 580,-9 L 770,-14 L 872,-6"/>`;
    // combustor and fuel injectors
    half += `<path class="tint" d="M 486,-12 L 486,-32 C 520,-40 556,-40 576,-34 L 576,-10 C 556,-4 520,-4 486,-12 Z"/>`;
    for (let x = 500; x <= 556; x += 18) half += `<circle class="fuel" cx="${x}" cy="-22" r="4"/>`;
    // nozzle plug
    half += `<path class="tint" d="M 790,-8 L 872,-6 L 872,0 L 790,0 Z"/>`;
    half += `<path class="tint" d="M 772,-12 C 800,-12 830,-9 872,0 L 772,0 Z" opacity="0.0"/>`;

    // airflow in the bypass duct
    const flow = (y) => `<path class="flow" d="M 345,${y} L 640,${y} C 720,${y} 800,${y + 8} 880,${y + 20}"/>`;

    // sensor markers: [sensor number, x of station on the casing, marker x, marker y, highlighted]
    const markers = [
      [2, 325, 325, -86, false], [3, 470, 446, -70, false], [11, 470, 470, -86, true],
      [7, 470, 494, -70, true], [12, 530, 540, -86, true], [4, 748, 748, -86, true],
    ];
    let mk = "";
    markers.forEach(([n, sx, mx, my, on]) => {
      const sy = casing(sx);
      mk += `<g class="mk${on ? " on" : ""}"><line class="mk-leader" x1="${mx}" y1="${my + 8}" x2="${sx}" y2="${sy}"/>
        <circle cx="${sx}" cy="${sy}" r="2.6"/><circle cx="${mx}" cy="${my}" r="9"/><text x="${mx}" y="${my}">${n}</text></g>`;
    });

    // component labels along the bottom
    const labels = [["Fan", 168], ["LPC", 260], ["HPC", 405], ["Combustor", 531], ["HPT", 602], ["LPT", 698], ["Nozzle", 830]];
    let lab = "";
    labels.forEach(([t, x]) => {
      lab += `<line class="leader" x1="${x}" y1="${f(-hub(x) + 10)}" x2="${x}" y2="100"/><text class="label" x="${x}" y="116">${t}</text>`;
    });

    $("engine-drawing").insertAdjacentHTML("beforeend", `
      <line class="center" x1="40" y1="165" x2="900" y2="165"/>
      <g transform="translate(0 165)">${half}${flow(-54)}${mk}</g>
      <g transform="translate(0 165) scale(1 -1)">${half}</g>
      <g transform="translate(0 165)">${lab}</g>
      <line class="dim" x1="78" y1="304" x2="872" y2="304"/>
      <line class="dim" x1="78" y1="298" x2="78" y2="310"/><line class="dim" x1="872" y1="298" x2="872" y2="310"/>
      <text class="dim-text" x="475" y="322">Air flows from left to right. Simplified, not to scale.</text>`);
  }

  /* ---------- data flow ---------- */
  const fetchJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });

  function readInputs() {
    const f = {};
    state.features.forEach((name) => (f[name] = parseFloat($("in-" + name).value)));
    return f;
  }

  async function predict() {
    const features = readInputs();
    if (Object.values(features).some((v) => Number.isNaN(v))) {
      $("compare").textContent = "Every reading needs a number before the models can estimate.";
      return;
    }
    const res = await fetch("/api/predict", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ features }),
    });
    if (!res.ok) { $("compare").textContent = "The estimate failed. Check the readings and try again."; return; }
    const body = await res.json();
    state.predictions = body.predictions;
    state.outside = body.outside_training_range || [];
    // once the readings differ from the NASA engine, its true RUL no longer applies
    state.edited = !!state.base && state.features.some((n) => Math.abs(features[n] - state.base[n]) > 1e-9);
    state.trueRul = state.edited ? null : state.engineTrue;
    renderResults();
  }

  async function loadEngine(id) {
    const engine = state.engines.find((e) => e.engine_id === Number(id));
    state.engineId = engine.engine_id;
    state.features.forEach((name) => ($("in-" + name).value = engine.features[name]));
    state.base = { ...engine.features };
    state.engineTrue = engine.true_rul;
    state.trueRul = engine.true_rul;
    state.edited = false;
    state.trajectory = null;
    const trajectory = fetchJson(`/api/trajectory/${engine.engine_id}`).then((t) => (state.trajectory = t)).catch(() => null);
    await predict();
    await trajectory;
    renderJourney(); renderSignals();
  }

  function buildForm() {
    $("form").innerHTML = state.features.map((name) =>
      `<div class="field"><label for="in-${name}" title="${friendly(name)}">${name}</label>
       <input id="in-${name}" type="number" step="any" inputmode="decimal" required></div>`).join("");
  }

  function buildTable() {
    const best = state.results.reduce((a, b) => (a.RMSE < b.RMSE ? a : b)).Model;
    $("perf").querySelector("tbody").innerHTML = state.results.map((r) => {
      const c = r.Model === best ? ' class="best"' : "";
      return `<tr><td>${r.Model}</td><td${c}>${r.MAE.toFixed(2)}</td><td${c}>${r.RMSE.toFixed(2)}</td><td${c}>${r["R²"].toFixed(3)}</td></tr>`;
    }).join("");
  }

  async function init() {
    drawDial();
    buildEngine();
    try {
      const [meta, engines] = await Promise.all([fetchJson("/api/meta"), fetchJson("/api/engines")]);
      Object.assign(state, { features: meta.features, models: meta.models, results: meta.results, engines });
    } catch (e) {
      $("compare").textContent = "The API is not running. Start it with: python -m uvicorn webapp.server:app";
      return;
    }
    $("engine").innerHTML = state.engines.map((e) => `<option value="${e.engine_id}">Engine ${e.engine_id}</option>`).join("");
    buildForm(); renderChips(); buildTable();
    const best = state.results.reduce((a, b) => (a.RMSE < b.RMSE ? a : b));
    $("tb-model").textContent = best.Model;
    $("tb-mae").textContent = `${best.MAE.toFixed(2)} cycles`;
    fetchJson("/api/importance").then(renderImportance).catch(() => {});
    fetchJson("/api/dataset").then(renderFacts).catch(() => {});

    $("engine").addEventListener("change", (e) => loadEngine(e.target.value));
    $("model-chips").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-model]");
      if (!btn || !state.predictions) return;
      state.selected = btn.dataset.model;
      renderChips(); renderResults();
    });
    $("form").addEventListener("submit", (e) => { e.preventDefault(); predict(); });

    // start with the engine that has the longest observed history: the richest charts
    const start = state.engines.reduce((a, b) => (b.features.cycle > a.features.cycle ? b : a));
    $("engine").value = start.engine_id;
    loadEngine(start.engine_id);
  }

  init();
})();
