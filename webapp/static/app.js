(() => {
  const MAX_RUL = 250;                 // the gauge ring represents 0 to 250 cycles
  const R = 170, CX = 230, CY = 230, CIRC = 2 * Math.PI * R;
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

  const PHASES = [
    { lit: 1.0, name: "Healthy" }, { lit: 0.85, name: "Strong" }, { lit: 0.65, name: "Aging" },
    { lit: 0.5, name: "Halfway" }, { lit: 0.35, name: "Wearing" }, { lit: 0.2, name: "Watch closely" },
    { lit: 0.08, name: "Service soon" }, { lit: 0.0, name: "End of life" },
  ];
  const phaseOf = (rul) => Math.min(7, Math.max(0, Math.floor((1 - Math.min(rul, MAX_RUL) / MAX_RUL) * 8)));

  const $ = (id) => document.getElementById(id);
  const state = { features: [], models: [], engines: [], results: [], selected: "Gradient Boosting",
                  predictions: null, trueRul: null, engineId: null, trajectory: null };

  /* ---------- gauge ---------- */
  function polar(value) {
    const angle = (Math.min(value, MAX_RUL) / MAX_RUL) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  }

  function drawDial() {
    let html = "";
    for (let v = 0; v < MAX_RUL; v += 10) {
      const major = v % 50 === 0;
      const a = (v / MAX_RUL) * 2 * Math.PI - Math.PI / 2;
      const r1 = R + 10, r2 = R + (major ? 24 : 17);
      html += `<line class="tick${major ? " major" : ""}" x1="${CX + r1 * Math.cos(a)}" y1="${CY + r1 * Math.sin(a)}" x2="${CX + r2 * Math.cos(a)}" y2="${CY + r2 * Math.sin(a)}"/>`;
      if (major && v > 0) {
        const rl = R + 40;
        html += `<text class="tick-label" x="${CX + rl * Math.cos(a)}" y="${CY + rl * Math.sin(a)}">${v}</text>`;
      }
    }
    $("dial-ticks").innerHTML = html;
  }

  let rafId;
  function animateNumber(el, to) {
    cancelAnimationFrame(rafId);
    if (reduce) { el.textContent = Math.round(to); return; }
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
    const arc = $("arc"), head = $("head"), marker = $("true-marker");

    const len = (Math.min(value, MAX_RUL) / MAX_RUL) * CIRC;
    arc.style.transition = reduce ? "none" : "stroke-dasharray 0.9s cubic-bezier(0.2,0.8,0.2,1)";
    arc.style.strokeDasharray = `${len} ${CIRC}`;

    const p = polar(value);
    head.setAttribute("cx", p.x); head.setAttribute("cy", p.y); head.setAttribute("opacity", 1);

    if (state.trueRul != null) {
      const t = polar(state.trueRul);
      marker.setAttribute("transform", `translate(${t.x} ${t.y})`);
      marker.setAttribute("opacity", 1);
    } else {
      marker.setAttribute("opacity", 0);
    }
    animateNumber($("rul"), value);

    if (state.trueRul != null) {
      const diff = value - state.trueRul;
      const word = Math.abs(diff) < 0.5 ? "right on target"
        : diff > 0 ? `${diff.toFixed(0)} cycles too optimistic` : `${(-diff).toFixed(0)} cycles too cautious`;
      $("compare").innerHTML = `NASA recorded <b>${state.trueRul}</b> cycles, ${word}`;
    } else {
      $("compare").innerHTML = "&nbsp;";
    }
  }

  /* ---------- moon phases ---------- */
  function moonSvg(lit, uid) {
    const r = 44, c = 50, rx = r * Math.abs(2 * lit - 1);
    const half = `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} Z`;
    const ell = `<ellipse cx="${c}" cy="${c}" rx="${rx}" ry="${r}" fill="${lit >= 0.5 ? "#fff" : "#000"}"/>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><mask id="mm-${uid}"><rect width="100" height="100" fill="#000"/><path d="${half}" fill="#fff"/>${ell}</mask></defs>
      <circle cx="${c}" cy="${c}" r="${r}" fill="#0a0a12" stroke="rgba(245,196,81,0.28)" stroke-width="0.8"/>
      <g transform="translate(100 0) scale(-1 1)"><g mask="url(#mm-${uid})">
        <circle cx="${c}" cy="${c}" r="${r}" fill="url(#gold-disc)" filter="url(#glitter)"/>
      </g></g></svg>`;
  }

  function installSvgDefs() {
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    holder.innerHTML = `<svg width="0" height="0"><defs>
      <radialGradient id="gold-disc" cx="38%" cy="35%" r="75%">
        <stop offset="0" stop-color="#ffe9a8"/><stop offset="0.55" stop-color="#d9a441"/><stop offset="1" stop-color="#7a5514"/>
      </radialGradient>
      <filter id="glitter" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.6  0 0 0 2.2 -0.95" result="sp"/>
        <feComposite in="sp" in2="SourceGraphic" operator="in" result="spk"/>
        <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="spk"/></feMerge>
      </filter></defs></svg>`;
    document.body.prepend(holder);
  }

  function renderPhases() {
    const value = Math.max(0, state.predictions[state.selected]);
    const now = phaseOf(value);
    $("moons").innerHTML = PHASES.map((p, i) =>
      `<div class="moon${i === now ? " is-now" : ""}"${i === now ? ' aria-current="true"' : ""}>${moonSvg(p.lit, i)}<span>${p.name}</span></div>`).join("");
    let text = `${state.selected} puts this engine in the “${PHASES[now].name}” phase with ${Math.round(value)} cycles left.`;
    if (state.trueRul != null) {
      const real = phaseOf(state.trueRul);
      text += real === now ? ` NASA’s true value agrees.`
        : ` NASA’s true value, ${state.trueRul} cycles, is “${PHASES[real].name}”.`;
    }
    $("phase-text").textContent = text;
  }

  /* ---------- journey chart ---------- */
  function renderJourney() {
    const t = state.trajectory;
    if (!t) return;
    const pred = t.predictions[state.selected];
    const W = 1000, H = 340, L = 52, Rr = 18, T = 16, B = 36;
    const yMax = Math.ceil(Math.max(...t.true_rul, ...pred) / 50) * 50;
    const xMax = t.cycles[t.cycles.length - 1];
    const sx = (c) => L + ((c - 1) / Math.max(1, xMax - 1)) * (W - L - Rr);
    const sy = (v) => T + (1 - Math.max(0, v) / yMax) * (H - T - B);
    const path = (arr) => arr.map((v, i) => `${sx(t.cycles[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");

    let grid = "";
    for (let v = 0; v <= yMax; v += 50) {
      grid += `<line class="grid-line" x1="${L}" x2="${W - Rr}" y1="${sy(v)}" y2="${sy(v)}"/>
               <text class="axis-label" x="${L - 10}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
    }
    const step = Math.max(10, Math.ceil(xMax / 8 / 10) * 10);
    for (let c = step; c <= xMax; c += step) {
      grid += `<text class="axis-label" x="${sx(c)}" y="${H - 12}" text-anchor="middle">${c}</text>`;
    }
    grid += `<text class="axis-label" x="${(L + W - Rr) / 2}" y="${H}" text-anchor="middle" dy="-0">cycle</text>`;

    const lx = sx(xMax), ly = sy(pred[pred.length - 1]);
    $("journey").innerHTML = `${grid}
      <polyline class="line-true" points="${path(t.true_rul)}"/>
      <polyline class="line-pred" points="${path(pred)}"/>
      <circle cx="${lx}" cy="${ly}" r="14" fill="url(#planet-glow)"/>
      <circle cx="${lx}" cy="${ly}" r="3.2" fill="#fff8dd"/>`;

    const err = pred.map((p, i) => Math.abs(p - t.true_rul[i]));
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const q = Math.max(1, Math.floor(err.length / 4));
    $("journey-text").textContent =
      `${state.selected} on engine ${state.engineId}: on average ${mean(err).toFixed(0)} cycles away from the truth across ${err.length} observed cycles. ` +
      `In the first quarter of the history it is ${mean(err.slice(0, q)).toFixed(0)} cycles off; in the last quarter, ${mean(err.slice(-q)).toFixed(0)}.`;
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
    const max = Math.max(MAX_RUL * 0.5, ...Object.values(preds), state.trueRul || 0) * 1.1;
    $("bars").innerHTML = state.models.map((name) => {
      const v = Math.max(0, preds[name]);
      const sel = name === state.selected ? " is-selected" : "";
      const tr = state.trueRul != null
        ? `<span class="bar-true" style="left:${Math.min(100, (state.trueRul / max) * 100)}%"></span>` : "";
      return `<div class="bar-row${sel}">
        <div class="bar-name">${name}</div>
        <div class="bar-track"><div class="bar-fill" data-w="${(v / max) * 100}"></div>${tr}</div>
        <div class="bar-value" title="${preds[name] < 0 ? "Negative: impossible, the model extrapolated below zero" : ""}">${preds[name].toFixed(1)}</div></div>`;
    }).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll(".bar-fill").forEach((b) => (b.style.transform = `scaleX(${b.dataset.w / 100})`));
    }));
  }

  function renderChips() {
    $("model-chips").innerHTML = state.models.map((m) =>
      `<button class="chip" type="button" aria-pressed="${m === state.selected}" data-model="${m}">${m}</button>`).join("");
  }

  function renderResults() {
    renderGauge(); renderPhases(); renderBars(); renderJourney();
  }

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


  /* ---------- AI agent demo ---------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const pretty = (o) => JSON.stringify(o, null, 2);
  let agentBusy = false;

  function addMsg(kind, label, html) {
    const log = $("agent-log");
    const empty = log.querySelector(".agent-empty");
    if (empty) empty.remove();
    const el = document.createElement("div");
    el.className = `msg ${kind}`;
    el.innerHTML = `<small>${label}</small>${html}`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function runTool(name, args) {
    const steps = document.querySelectorAll(".loop li");
    steps.forEach((li) => li.classList.remove("pulse"));
    steps[2].classList.add("pulse");
    addMsg("tool", "Tool call", `<pre>${name}(${pretty(args)})</pre>`);
    await sleep(500);
    const res = await fetch("/api/agent/call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, arguments: args }),
    }).then((r) => r.json());
    steps[3].classList.add("pulse");
    const shown = pretty(res.result);
    addMsg("tool", "Tool result", `<pre>${shown.length > 900 ? shown.slice(0, 900) + "\n…" : shown}</pre>`);
    await sleep(500);
    return res.result;
  }

  async function typeAnswer(text) {
    const el = addMsg("answer", "Answer", `<span class="caret"></span>`);
    const span = document.createElement("span");
    el.insertBefore(span, el.lastChild);
    if (reduce) { span.textContent = text; el.querySelector(".caret")?.classList.remove("caret"); return; }
    for (const word of text.split(" ")) {
      span.textContent += (span.textContent ? " " : "") + word;
      $("agent-log").scrollTop = $("agent-log").scrollHeight;
      await sleep(35);
    }
    el.querySelector(".caret")?.classList.remove("caret");
  }

  async function runAgent() {
    if (agentBusy || state.engineId == null) return;
    agentBusy = true;
    $("agent-run").disabled = true;
    $("agent-log").innerHTML = "";
    const steps = document.querySelectorAll(".loop li");
    try {
      const kind = $("agent-prompt").value;
      const id = state.engineId;
      steps[0].classList.add("pulse");
      if (kind === "brief") {
        addMsg("user", "You", `Should engine ${id} go in for maintenance soon?`);
        await sleep(600);
        steps.forEach((li) => li.classList.remove("pulse")); steps[1].classList.add("pulse");
        addMsg("think", "Agent thinks", `I need this engine’s remaining life first, so I will call predict_rul.`);
        await sleep(700);
        const p = await runTool("predict_rul", { engine_id: id });
        if (p.error) { await typeAnswer(p.error); return; }
        addMsg("think", "Agent thinks", `Now I need a recommendation, so I will call maintenance_brief.`);
        await sleep(700);
        const b = await runTool("maintenance_brief", { engine_id: id });
        steps.forEach((li) => li.classList.remove("pulse")); steps[4].classList.add("pulse");
        const negatives = Object.entries(p.all_models).filter(([, v]) => v < 0).map(([n]) => n);
        let text = `Engine ${id}: ${p.model} estimates ${p.predicted_rul_cycles} cycles left, so it is in the “${p.life_phase}” phase. ` +
          `NASA’s recorded value is ${p.nasa_true_rul_cycles} cycles. ${b.recommendation} ${b.caution}`;
        if (negatives.length) text += ` ${negatives.join(" and ")} predicted a negative life, which is impossible, so I trust the tree-based models here.`;
        await typeAnswer(text);
      } else {
        addMsg("user", "You", "How accurate are your models?");
        await sleep(600);
        steps.forEach((li) => li.classList.remove("pulse")); steps[1].classList.add("pulse");
        addMsg("think", "Agent thinks", "This is about model quality, so I will call compare_models.");
        await sleep(700);
        const c = await runTool("compare_models", {});
        steps.forEach((li) => li.classList.remove("pulse")); steps[4].classList.add("pulse");
        const best = c.results.reduce((a, b) => (a.RMSE < b.RMSE ? a : b));
        const worst = c.results.reduce((a, b) => (a.RMSE > b.RMSE ? a : b));
        await typeAnswer(`On the NASA test set the best model is ${best.Model}: it is off by ${best.MAE.toFixed(1)} cycles on average ` +
          `(RMSE ${best.RMSE.toFixed(1)}, R² ${best["R²"].toFixed(2)}). The weakest is ${worst.Model} at ${worst.MAE.toFixed(1)} cycles. ` +
          `Treat every estimate as a prototype, not a maintenance order.`);
      }
    } catch (e) {
      addMsg("answer", "Answer", "The tool call failed. Check that the API is running.");
    } finally {
      document.querySelectorAll(".loop li").forEach((li) => li.classList.remove("pulse"));
      agentBusy = false;
      $("agent-run").disabled = false;
    }
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
    state.predictions = (await res.json()).predictions;
    renderResults();
  }

  async function loadEngine(id) {
    const engine = state.engines.find((e) => e.engine_id === Number(id));
    state.engineId = engine.engine_id;
    state.features.forEach((name) => ($("in-" + name).value = engine.features[name]));
    state.trueRul = engine.true_rul;
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
    installSvgDefs();
    drawDial();
    try {
      const [meta, engines] = await Promise.all([fetchJson("/api/meta"), fetchJson("/api/engines")]);
      Object.assign(state, { features: meta.features, models: meta.models, results: meta.results, engines });
    } catch (e) {
      $("compare").textContent = "The API is not running. Start it with: python -m uvicorn webapp.server:app";
      return;
    }
    $("engine").innerHTML = state.engines.map((e) => `<option value="${e.engine_id}">Engine ${e.engine_id}</option>`).join("");
    buildForm(); renderChips(); buildTable();
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
    $("agent-run").addEventListener("click", runAgent);
    fetchJson("/api/agent/tools").then((t) => { $("tool-schemas").textContent = JSON.stringify(t, null, 2); }).catch(() => {});

    // start with the engine that has the longest observed history: the richest charts
    const start = state.engines.reduce((a, b) => (b.features.cycle > a.features.cycle ? b : a));
    $("engine").value = start.engine_id;
    loadEngine(start.engine_id);
  }

  init();
})();
