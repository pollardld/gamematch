/* =========================================================================
 * GameMatch — AI opposition manager
 * Picks a formation without seeing the human's choice (selections are
 * simultaneous), but reasons about it: each manager has a personality that
 * biases selection, and choices are weighted by each shape's average
 * expected-goal-difference across the whole field of opponents.
 * ========================================================================= */
(function (GM) {
  "use strict";

  const MANAGERS = [
    { name: "Gaffer Vidic",  style: "a pragmatic, defence-first manager", bias: { lowBlock: 1.6, compact: 1.4, defensive: 1.5, attacking: 0.6 } },
    { name: "Coach Marenco", style: "a possession-obsessed tactician",     bias: { midControl: 1.7, doublePivot: 1.4, balanced: 1.2 } },
    { name: "Boss Lindqvist", style: "a fearless, all-out-attack coach",   bias: { attacking: 1.8, wideAttack: 1.5, highPress: 1.4, lowBlock: 0.4 } },
    { name: "Mister Okafor", style: "a balanced, modern strategist",        bias: { balanced: 1.6, midControl: 1.3, holding: 1.3 } },
  ];

  // Average expected-goal-difference of a formation against the whole field.
  function fieldStrength(formationId) {
    const me = GM.formationById(formationId);
    let total = 0, n = 0;
    GM.FORMATIONS.forEach((opp) => {
      if (opp.id === formationId) return;
      const H = GM.profile(me), A = GM.profile(opp);
      const myEdge = GM.tacticalEdges(me, opp).reduce((t, e) => t + e.value, 0);
      const oppEdge = GM.tacticalEdges(opp, me).reduce((t, e) => t + e.value, 0);
      const myAtt = H.creativity + Math.max(0, H.width - A.compactness) * 0.45 + myEdge;
      const opAtt = A.creativity + Math.max(0, A.width - H.compactness) * 0.45 + oppEdge;
      total += myAtt / A.solidity - opAtt / H.solidity;
      n++;
    });
    return total / n;
  }

  function pick() {
    const manager = MANAGERS[Math.floor(Math.random() * MANAGERS.length)];

    // Score every formation: base field strength + personality bias.
    const scored = GM.FORMATIONS.map((f) => {
      let biasMult = 1;
      f.tags.forEach((tag) => {
        if (manager.bias[tag] != null) biasMult *= manager.bias[tag];
      });
      const base = fieldStrength(f.id) + 1.2; // shift positive for weighting
      return { f, weight: Math.max(0.05, base) * biasMult };
    });

    // Weighted random choice — strong-but-not-deterministic.
    const total = scored.reduce((t, s) => t + s.weight, 0);
    let roll = Math.random() * total;
    let chosen = scored[0];
    for (const s of scored) {
      roll -= s.weight;
      if (roll <= 0) { chosen = s; break; }
    }

    return {
      manager,
      formation: chosen.f,
      reasoning: `${manager.name}, ${manager.style}, lines up in a ${chosen.f.name} — ${chosen.f.blurb}`,
    };
  }

  GM.aiPick = pick;
})(window.GameMatch = window.GameMatch || {});
