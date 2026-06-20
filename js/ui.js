/* =========================================================================
 * GameMatch — UI controller. Wires screens, rendering and game flow.
 * ========================================================================= */
(function (GM) {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const state = { humanFormationId: null, result: null, aiPick: null };

  /* ---------- screen switching ---------- */
  function show(screenId) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
    $("#" + screenId).classList.add("is-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- mini pitch renderer ---------- */
  function renderPitch(container, formationId, sideClass) {
    container.classList.add("mini-pitch");
    container.innerHTML = "";
    GM.formationPositions(formationId).forEach((p) => {
      const dot = el("span", "dot");
      if (p.role === "GK") dot.classList.add("dot--GK");
      else if (sideClass) dot.classList.add("dot--" + sideClass);
      // invert y so attackers point "up" the pitch
      dot.style.left = p.x + "%";
      dot.style.top = (100 - p.y) + "%";
      container.appendChild(dot);
    });
  }

  /* ---------- screen 1: formation cards ---------- */
  function buildSetup() {
    const grid = $("#formation-grid");
    grid.innerHTML = "";
    GM.FORMATIONS.forEach((f) => {
      const card = el("div", "card");
      card.dataset.id = f.id;

      const pitch = el("div", "");
      renderPitch(pitch, f.id, null);

      card.appendChild(el("h3", "card__name", f.name));
      card.appendChild(el("div", "card__nick", f.nick));
      card.appendChild(pitch);
      card.appendChild(el("p", "card__blurb", f.blurb));

      const tags = el("div", "card__tags");
      tags.appendChild(el("span", "tag tag--pro", "＋ " + f.strengths[0].split(" ").slice(0, 4).join(" ")));
      tags.appendChild(el("span", "tag tag--con", "－ " + f.weaknesses[0].split(" ").slice(0, 4).join(" ")));
      card.appendChild(tags);

      card.addEventListener("click", () => selectFormation(f.id));
      grid.appendChild(card);
    });
  }

  function selectFormation(id) {
    state.humanFormationId = id;
    document.querySelectorAll(".card").forEach((c) =>
      c.classList.toggle("is-selected", c.dataset.id === id));
    const f = GM.formationById(id);
    $("#selection-readout").innerHTML =
      `You'll line up in a <b>${f.name}</b> — ${f.nick}. Ready when you are.`;
    $("#kickoff-btn").disabled = false;
  }

  /* ---------- kickoff -> simulate -> result ---------- */
  function kickoff() {
    if (!state.humanFormationId) return;
    state.aiPick = GM.aiPick();
    state.result = GM.simulate(state.humanFormationId, state.aiPick.formation.id);

    show("screen-match");
    const anim = $("#kickoff-anim");
    const content = $("#match-content");
    anim.classList.add("is-on");
    content.classList.remove("is-on");
    $("#kickoff-text").textContent =
      `${state.aiPick.manager.name} sets up in a ${state.aiPick.formation.name}... we're underway!`;

    setTimeout(() => {
      anim.classList.remove("is-on");
      content.classList.add("is-on");
      renderResult();
    }, 1900);
  }

  /* ---------- render the result ---------- */
  function renderResult() {
    const r = state.result;
    $("#home-formation").textContent = r.home.formation.name;
    $("#away-formation").textContent = r.away.formation.name;
    $("#scoreline").textContent = r.scoreline;

    const tag = $("#result-tag");
    if (r.winner === "home") { tag.textContent = "YOU WIN"; tag.style.color = "var(--good)"; }
    else if (r.winner === "away") { tag.textContent = "YOU LOSE"; tag.style.color = "var(--away)"; }
    else { tag.textContent = "DRAW"; tag.style.color = "var(--gold)"; }

    $("#match-verdict").innerHTML =
      `<b>${state.aiPick.reasoning}</b><br>` + GM.explain(r, "home");

    renderPitch($("#pitch-home"), r.home.formation.id, "home");
    renderPitch($("#pitch-away"), r.away.formation.id, "away");
    $("#pitch-home-cap").textContent = `You · ${r.home.formation.name}`;
    $("#pitch-away-cap").textContent = `Opposition · ${r.away.formation.name}`;

    renderStats(r);
    renderTimeline(r);
  }

  function statRow(name, h, a, suffix) {
    suffix = suffix || "";
    const total = (h + a) || 1;
    const hp = Math.round((h / total) * 100);
    return `
      <div class="stat__row">
        <div class="stat__head"><b>${h}${suffix}</b><span class="stat__name">${name}</span><b>${a}${suffix}</b></div>
        <div class="stat__bar"><i class="h" style="width:${hp}%"></i><i class="a" style="width:${100 - hp}%"></i></div>
      </div>`;
  }

  function renderStats(r) {
    $("#stats").innerHTML = [
      statRow("Possession", r.home.possession, r.away.possession, "%"),
      statRow("Shots", r.home.shots, r.away.shots),
      statRow("On Target", r.home.sot, r.away.sot),
      statRow("Expected Goals", r.home.xg, r.away.xg),
      statRow("Midfield", r.home.control, r.away.control),
      statRow("Solidity", r.home.solidity, r.away.solidity),
    ].join("");
  }

  function renderTimeline(r) {
    const list = $("#timeline");
    list.innerHTML = "";
    r.events.forEach((e) => {
      const mine = e.side === "home";
      const li = el("li", e.type === "goal" ? "goal " + (mine ? "" : "them") : "");
      const icon = e.type === "goal" ? "⚽" : "🅰";
      li.innerHTML = `<span class="min">${e.minute}'</span><span class="ic">${icon}</span>` +
        `<span>${mine ? "YOU" : "THEM"} — ${e.text}</span>`;
      list.appendChild(li);
    });
  }

  /* ---------- screen 3: analyst chat ---------- */
  function openAnalysis() {
    show("screen-analysis");
    const chat = $("#chat");
    if (!chat.dataset.seeded) {
      addBubble("analyst", "Analyst", GM.explain(state.result, "home") +
        " What would you like to know?");
      chat.dataset.seeded = "1";
    }
    buildSuggestions();
  }

  function buildSuggestions() {
    const box = $("#suggestions");
    box.innerHTML = "";
    GM.analystSuggestions().forEach((q) => {
      const chip = el("button", "chip", q);
      chip.type = "button";
      chip.addEventListener("click", () => ask(q));
      box.appendChild(chip);
    });
  }

  function addBubble(kind, who, text) {
    const chat = $("#chat");
    const b = el("div", "bubble bubble--" + kind);
    b.appendChild(el("span", "who", who));
    b.appendChild(el("span", "", text));
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  function ask(q) {
    if (!q || !q.trim()) return;
    addBubble("user", "You", q);
    const reply = GM.answer(q, state.result, "home");
    setTimeout(() => addBubble("analyst", "Analyst", reply), 250);
  }

  /* ---------- new game ---------- */
  function newGame() {
    state.humanFormationId = null;
    state.result = null;
    state.aiPick = null;
    $("#kickoff-btn").disabled = true;
    $("#selection-readout").textContent = "No formation selected yet.";
    document.querySelectorAll(".card").forEach((c) => c.classList.remove("is-selected"));
    const chat = $("#chat");
    chat.innerHTML = "";
    delete chat.dataset.seeded;
    show("screen-setup");
  }

  /* ---------- bind & boot ---------- */
  function boot() {
    buildSetup();
    $("#kickoff-btn").addEventListener("click", kickoff);
    $("#to-analysis-btn").addEventListener("click", openAnalysis);
    $("#back-to-match-btn").addEventListener("click", () => show("screen-match"));
    $("#newgame-btn-1").addEventListener("click", newGame);
    $("#newgame-btn-2").addEventListener("click", newGame);
    $("#ask-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#ask-input");
      ask(input.value);
      input.value = "";
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})(window.GameMatch = window.GameMatch || {});
