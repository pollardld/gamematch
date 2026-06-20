/* =========================================================================
 * GameMatch — Match analyst
 * Produces the post-match explanation and answers the human's follow-up
 * questions using the real simulation data. Intent is matched on keywords so
 * the user can ask in natural language.
 * ========================================================================= */
(function (GM) {
  "use strict";

  // Perspective helper: from the human's point of view.
  function sides(result, humanSide) {
    const human = result[humanSide];
    const opp = result[humanSide === "home" ? "away" : "home"];
    let outcome = "drew";
    if (result.winner === humanSide) outcome = "won";
    else if (result.winner !== "draw") outcome = "lost";
    return { human, opp, outcome };
  }

  /* -- the headline post-match explanation ----------------------------- */
  function explain(result, humanSide) {
    const { human, opp, outcome } = sides(result, humanSide);
    const lines = [];

    if (outcome === "won") {
      lines.push(`Your ${human.formation.name} beat the ${opp.formation.name} ${result.scoreline}.`);
    } else if (outcome === "lost") {
      lines.push(`Your ${human.formation.name} lost to the ${opp.formation.name} ${result.scoreline}.`);
    } else {
      lines.push(`Your ${human.formation.name} and the ${opp.formation.name} shared the spoils, ${result.scoreline}.`);
    }

    if (result.decisive.length) {
      lines.push("The match turned on: " + result.decisive.slice(0, 2).map((d) => d.text).join("; ") + ".");
    } else {
      lines.push("It was a finely balanced contest with little between the two shapes.");
    }
    return lines.join(" ");
  }

  /* -- counter-formation: best answer to a given opponent shape -------- */
  function bestCounter(oppId) {
    const opp = GM.formationById(oppId);
    let best = null;
    GM.FORMATIONS.forEach((f) => {
      if (f.id === oppId) return;
      const H = GM.profile(f), A = GM.profile(opp);
      const myEdge = GM.tacticalEdges(f, opp).reduce((t, e) => t + e.value, 0);
      const oppEdge = GM.tacticalEdges(opp, f).reduce((t, e) => t + e.value, 0);
      const myAtt = H.creativity + Math.max(0, H.width - A.compactness) * 0.45 + myEdge;
      const opAtt = A.creativity + Math.max(0, A.width - H.compactness) * 0.45 + oppEdge;
      const diff = myAtt / A.solidity - opAtt / H.solidity;
      const reason = GM.tacticalEdges(f, opp).filter((e) => e.value > 0).map((e) => e.reason)[0];
      if (!best || diff > best.diff) best = { f, diff, reason };
    });
    return best;
  }

  /* -- intent router for follow-up questions --------------------------- */
  function answer(q, result, humanSide) {
    const text = (q || "").toLowerCase();
    const { human, opp, outcome } = sides(result, humanSide);
    const test = (...words) => words.some((w) => text.includes(w));

    // Why did I win / lose / what happened
    if (test("why", "how come", "explain", "what happened", "reason")) {
      if (!result.decisive.length) {
        return `Honestly, very little separated the shapes — ${human.formation.name} and ${opp.formation.name} cancelled each other out, and the ${result.scoreline} reflects a true coin-flip of a game.`;
      }
      const verb = outcome === "won" ? "edged it" : outcome === "lost" ? "came up short" : "couldn't be separated";
      return `You ${verb}. ` + result.decisive.map((d) => `• ${d.zone}: ${d.text}`).join("  ");
    }

    // Midfield battle
    if (test("midfield", "control", "engine room")) {
      const winner = human.possession >= opp.possession ? human : opp;
      const owner = winner === human ? "You" : opp.formation.name;
      return `${owner} controlled midfield — ${human.formation.name} had ${human.possession}% of the ball against ${opp.formation.name}'s ${opp.possession}% (midfield ratings ${human.control} vs ${opp.control}). More central bodies and pressing intensity tilt this battle.`;
    }

    // Possession
    if (test("possession", "the ball", "ball")) {
      return `Possession finished ${human.possession}%–${opp.possession}% in ${human.possession >= opp.possession ? "your" : "their"} favour. It's driven by the midfield battle: the shape that wins the central numbers game keeps the ball.`;
    }

    // Chances / shots / xG / deserve / lucky
    if (test("chance", "shot", "xg", "deserve", "lucky", "fair", "fortunate")) {
      const verdict = human.xg > opp.xg
        ? "you created the better openings"
        : human.xg < opp.xg
        ? "they created the better openings"
        : "chances were even";
      let luck = "";
      if (outcome === "won" && human.xg < opp.xg) luck = " You rode your luck a little — the xG suggests it could have gone either way.";
      if (outcome === "lost" && human.xg > opp.xg) luck = " Hard lines — by the xG you arguably deserved more.";
      return `Shots ${human.shots}–${opp.shots}, on target ${human.sot}–${opp.sot}, xG ${human.xg}–${opp.xg}. So ${verdict}.${luck}`;
    }

    // Counter / what should I have played / better formation / suggestion
    if (test("counter", "should i", "better", "instead", "beat them", "suggest", "recommend", "what formation", "next time")) {
      const c = bestCounter(opp.formationId);
      const because = c.reason ? ` because ${c.reason.toLowerCase()}` : " thanks to a favourable tactical matchup";
      return `Against a ${opp.formation.name}, the strongest answer is a ${c.f.name} (${c.f.nick})${because}. Key idea: ${c.f.strengths[0].toLowerCase()}.`;
    }

    // Weakness of opponent / their weakness
    if (test("their weak", "opponent weak", "exploit", "weakness of", "weaknesses")) {
      return `The ${opp.formation.name}'s soft spots: ${opp.formation.weaknesses.join("; ")}. Target those areas to hurt it.`;
    }

    // My formation strengths / about my shape
    if (test("my formation", "my shape", "my strength", "strengths of", "good about")) {
      return `Your ${human.formation.name} (${human.formation.nick}) — strengths: ${human.formation.strengths.join("; ")}. Watch out: ${human.formation.weaknesses.join("; ")}.`;
    }

    // Key moments / goals / timeline
    if (test("key moment", "goal", "scored", "timeline", "when")) {
      const goals = result.events.filter((e) => e.type === "goal");
      if (!goals.length) return "No goals to report — it finished goalless, decided by defensive discipline rather than a moment of quality.";
      return "Key moments: " + goals.map((g) => `${g.minute}' ${g.side === humanSide ? "YOU" : "THEM"} — ${g.text}`).join("  ");
    }

    // Tactics / matchup generally
    if (test("tactic", "matchup", "match-up", "shape", "formation")) {
      if (human.edges.concat(opp.edges).length === 0) {
        return `Tactically it was even — ${human.formation.name} vs ${opp.formation.name} produced no decisive mismatch, so individual zones (midfield ${human.control}–${opp.control}, defence ${human.solidity}–${opp.solidity}) settled it.`;
      }
      const all = [].concat(human.edges, opp.edges).filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
      return "Tactical read: " + (all.length ? all.map((e) => e.reason).join("; ") + "." : "a balanced, even matchup.");
    }

    // Fallback — restate the explanation plus a nudge.
    return explain(result, humanSide) + " Ask me about the midfield battle, possession, chances (xG), key moments, or what formation would counter them.";
  }

  // A few suggested questions to seed the UI.
  function suggestions() {
    return [
      "Why did I get that result?",
      "Who won the midfield battle?",
      "Did I deserve to win?",
      "What should I have played instead?",
      "What are their weaknesses?",
      "What were the key moments?",
    ];
  }

  GM.explain = explain;
  GM.answer = answer;
  GM.bestCounter = bestCounter;
  GM.analystSuggestions = suggestions;
})(window.GameMatch = window.GameMatch || {});
