(() => {
  const MAX_RUL = 250;                 // the gauge ring represents 0 to 250 cycles
  const R = 170, CX = 230, CY = 230, CIRC = 2 * Math.PI * R;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const state = { features: [], models: [], engines: [], results: [], selected: "Gradient Boosting",
                  predictions: null, trueRul: null };

  // ---------- gauge ----------
  function polar(value) {
    const angle = (Math.min(value, MAX_RUL) / MAX_RUL) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  }

  function drawDial() {
    const g = $("dial-ticks");
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
    g.innerHTML = html;
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
      marker.setAttribute("transform", `translate(${t.x} ${t.y}) rotate(0)`);
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

  // ---------- model bars ----------
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
        <div class="bar-value">${v.toFixed(1)}</div></div>`;
    }).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll(".bar-fill").forEach((b) => (b.style.width = b.dataset.w + "%"));
    }));
  }

  function renderChips() {
    $("model-chips").innerHTML = state.models.map((m) =>
      `<button class="chip" type="button" aria-pressed="${m === state.selected}" data-model="${m}">${m}</button>`).join("");
  }

  function renderResults() {
    renderGauge();
    renderBars();
  }

  // ---------- data ----------
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

  function loadEngine(id) {
    const engine = state.engines.find((e) => e.engine_id === Number(id));
    state.features.forEach((name) => ($("in-" + name).value = engine.features[name]));
    state.trueRul = engine.true_rul;
    return predict();
  }

  function buildForm() {
    $("form").innerHTML = state.features.map((name) =>
      `<div class="field"><label for="in-${name}">${name}</label>
       <input id="in-${name}" type="number" step="any" inputmode="decimal" required></div>`).join("");
  }

  function buildTable() {
    const best = state.results.reduce((a, b) => (a.RMSE < b.RMSE ? a : b)).Model;
    $("perf").querySelector("tbody").innerHTML = state.results.map((r) =>
      `<tr><td>${r.Model}</td><td class="${r.Model === best ? "best" : ""}">${r.MAE.toFixed(2)}</td>
       <td class="${r.Model === best ? "best" : ""}">${r.RMSE.toFixed(2)}</td>
       <td class="${r.Model === best ? "best" : ""}">${r["R²"].toFixed(3)}</td></tr>`).join("");
  }

  async function init() {
    drawDial();
    try {
      const [meta, engines] = await Promise.all([
        fetch("/api/meta").then((r) => r.json()), fetch("/api/engines").then((r) => r.json()),
      ]);
      Object.assign(state, { features: meta.features, models: meta.models, results: meta.results, engines });
    } catch (e) {
      $("compare").textContent = "The API is not running. Start it with: python -m uvicorn webapp.server:app";
      return;
    }
    const engines = state.engines;
    $("engine").innerHTML = engines.map((e) => `<option value="${e.engine_id}">Engine ${e.engine_id}</option>`).join("");
    buildForm(); renderChips(); buildTable();

    $("engine").addEventListener("change", (e) => loadEngine(e.target.value));
    $("model-chips").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-model]");
      if (!btn || !state.predictions) return;
      state.selected = btn.dataset.model;
      renderChips(); renderResults();
    });
    $("form").addEventListener("submit", (e) => { e.preventDefault(); predict(); });

    loadEngine(engines[0].engine_id);
  }

  init();
})();
