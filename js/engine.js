/* =========================================================================
 * GameMatch — Simulation engine
 * Turns two formation choices into a believable 90-minute result by modelling
 * the midfield battle (possession), width-vs-compactness chance creation, and
 * tactical rock-paper-scissors edges. Produces xG, goals, stats, an event
 * timeline and a decisive-zone breakdown for the analyst.
 * ========================================================================= */
(function (GM) {
  "use strict";

  /* -- small maths helpers --------------------------------------------- */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Poisson sample (Knuth) — turns an xG value into an actual goal count.
  function poisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  const has = (f, tag) => f.tags.indexOf(tag) !== -1;

  /* -- tactical rock-paper-scissors ------------------------------------
   * Returns an attacking xG bonus for `att` versus `def`, plus a reason that
   * the analyst can quote. Positive = att benefits, negative = att struggles.
   */
  function tacticalEdges(att, def) {
    const edges = [];
    const add = (value, reason) => edges.push({ value, reason });

    if (has(def, "threeAtBack") && has(att, "wideAttack")) {
      add(0.55, `${att.name}'s wide attack exploited the channels behind ${def.name}'s back three`);
    }
    if (has(def, "highPress") && has(att, "counter")) {
      add(0.5, `${att.name} sprang counters in behind ${def.name}'s high press`);
    }
    if (has(att, "midControl") && has(def, "twoStrikers") && !has(def, "midControl")) {
      add(0.35, `${att.name} overloaded a thinner midfield and dictated play`);
    }
    if (has(att, "wideAttack") && !has(def, "lowBlock") && def.ratings.compactness <= 6) {
      add(0.25, `${att.name} found joy in wide areas against a stretched shape`);
    }
    if (has(def, "lowBlock") && has(att, "wideAttack")) {
      add(-0.35, `${def.name}'s low block crowded out ${att.name}'s wide threat`);
    }
    if (has(att, "twoStrikers") && has(def, "fiveAtBack")) {
      add(-0.4, `${att.name}'s strikers were outnumbered by five defenders`);
    }
    if (has(att, "highPress") && (has(def, "doublePivot") || has(def, "holding"))) {
      add(-0.2, `${def.name}'s deep-lying screen resisted the press`);
    }
    if (has(att, "lowBlock") && !has(att, "counter")) {
      add(-0.2, `${att.name} sat too deep to threaten consistently`);
    }
    return edges;
  }

  /* -- build a team's match profile ------------------------------------ */
  function profile(f) {
    const r = f.ratings;
    return {
      formation: f,
      control: r.midfield + r.press * 0.4, // who runs the midfield
      creativity: r.attack,
      width: r.width,
      compactness: r.compactness,
      solidity: r.defense + r.compactness * 0.5,
    };
  }

  /* -- core: simulate one fixture -------------------------------------- */
  function simulate(homeId, awayId) {
    const homeF = GM.formationById(homeId);
    const awayF = GM.formationById(awayId);
    const H = profile(homeF);
    const A = profile(awayF);

    // Midfield battle -> possession share.
    const homePoss = H.control / (H.control + A.control);
    const awayPoss = 1 - homePoss;

    // Width vs opponent compactness creates openings.
    const homeWidthEdge = Math.max(0, H.width - A.compactness);
    const awayWidthEdge = Math.max(0, A.width - H.compactness);

    // Tactical edges (with reasons kept for the analyst).
    const homeEdges = tacticalEdges(homeF, awayF);
    const awayEdges = tacticalEdges(awayF, homeF);
    const sum = (arr) => arr.reduce((t, e) => t + e.value, 0);

    // Attacking strength faced against opposing solidity.
    const homeAttack = H.creativity + homeWidthEdge * 0.45 + sum(homeEdges);
    const awayAttack = A.creativity + awayWidthEdge * 0.45 + sum(awayEdges);

    // Expected goals. Possession amplifies chance volume.
    let homeXG = clamp(1.5 * (homeAttack / A.solidity) * (0.55 + homePoss), 0.15, 4.2);
    let awayXG = clamp(1.5 * (awayAttack / H.solidity) * (0.55 + awayPoss), 0.15, 4.2);

    // Actual goals via Poisson sampling.
    const homeGoals = poisson(homeXG);
    const awayGoals = poisson(awayXG);

    // Derived stats.
    const homeShots = Math.max(homeGoals, Math.round(homeXG * 6 + Math.random() * 4));
    const awayShots = Math.max(awayGoals, Math.round(awayXG * 6 + Math.random() * 4));
    const homeSot = clamp(Math.round(homeShots * 0.42 + Math.random()), homeGoals, homeShots);
    const awaySot = clamp(Math.round(awayShots * 0.42 + Math.random()), awayGoals, awayShots);

    const home = team(homeF, H, homeGoals, homeXG, homeShots, homeSot, Math.round(homePoss * 100), homeEdges, homeWidthEdge);
    const away = team(awayF, A, awayGoals, awayXG, awayShots, awaySot, 100 - Math.round(homePoss * 100), awayEdges, awayWidthEdge);

    const events = buildTimeline(home, away);
    const decisive = decisiveFactors(home, away);

    let winner = "draw";
    if (homeGoals > awayGoals) winner = "home";
    else if (awayGoals > homeGoals) winner = "away";

    return {
      home, away, events, winner,
      scoreline: `${homeGoals} – ${awayGoals}`,
      decisive,
    };
  }

  function team(f, prof, goals, xg, shots, sot, poss, edges, widthEdge) {
    return {
      formation: f,
      formationId: f.id,
      goals, xg: +xg.toFixed(2), shots, sot, possession: poss,
      edges, widthEdge,
      control: +prof.control.toFixed(1),
      creativity: prof.creativity,
      solidity: +prof.solidity.toFixed(1),
    };
  }

  /* -- timeline of goals & flavour moments ----------------------------- */
  function buildTimeline(home, away) {
    const events = [];
    const minutes = new Set();
    const uniqueMinute = () => {
      let m;
      do { m = 1 + Math.floor(Math.random() * 90); } while (minutes.has(m));
      minutes.add(m);
      return m;
    };

    [["home", home], ["away", away]].forEach(([sideKey, t]) => {
      for (let i = 0; i < t.goals; i++) {
        events.push({ minute: uniqueMinute(), side: sideKey, type: "goal",
          text: `GOAL — ${t.formation.name} strike!` });
      }
      // a near-miss for colour if they created a lot but didn't always score
      if (t.shots - t.goals >= 5 && Math.random() < 0.7) {
        events.push({ minute: uniqueMinute(), side: sideKey, type: "chance",
          text: `${t.formation.name} go close — a fine save denies them` });
      }
    });

    if (events.length === 0) {
      events.push({ minute: uniqueMinute(), side: "home", type: "chance",
        text: "A cagey, tactical affair with few clear openings" });
    }
    return events.sort((a, b) => a.minute - b.minute);
  }

  /* -- work out which battles decided the match ------------------------ */
  function decisiveFactors(home, away) {
    const factors = [];
    const possDiff = home.possession - away.possession;
    if (Math.abs(possDiff) >= 8) {
      const w = possDiff > 0 ? home : away;
      factors.push({ zone: "Midfield", magnitude: Math.abs(possDiff) / 10,
        text: `${w.formation.name} won the midfield battle with ${w.possession}% possession` });
    }
    const xgDiff = home.xg - away.xg;
    if (Math.abs(xgDiff) >= 0.4) {
      const w = xgDiff > 0 ? home : away;
      factors.push({ zone: "Attack", magnitude: Math.abs(xgDiff),
        text: `${w.formation.name} created the better chances (${w.xg} xG vs ${(w === home ? away : home).xg})` });
    }
    const solDiff = home.solidity - away.solidity;
    if (Math.abs(solDiff) >= 1.5) {
      const w = solDiff > 0 ? home : away;
      factors.push({ zone: "Defence", magnitude: Math.abs(solDiff) / 3,
        text: `${w.formation.name} was the more solid defensive shape` });
    }
    // strongest tactical edge across both teams
    let bestEdge = null;
    [home, away].forEach((t) => t.edges.forEach((e) => {
      if (e.value > 0 && (!bestEdge || e.value > bestEdge.value)) bestEdge = e;
    }));
    if (bestEdge) {
      factors.push({ zone: "Tactics", magnitude: bestEdge.value * 1.5, text: bestEdge.reason });
    }
    return factors.sort((a, b) => b.magnitude - a.magnitude);
  }

  GM.simulate = simulate;
  GM.profile = profile;
  GM.tacticalEdges = tacticalEdges;
  GM._clamp = clamp;
})(window.GameMatch = window.GameMatch || {});
