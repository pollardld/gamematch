/* =========================================================================
 * GameMatch — Formations knowledge base
 * Each formation carries zone ratings (1-10), tactical tags used by the
 * simulation engine, and human-readable strengths / weaknesses.
 * ========================================================================= */
(function (GM) {
  "use strict";

  /* Ratings scale 1-10:
   *   defense     – solidity of the defensive line / ability to deny chances
   *   midfield    – control of the central battle (drives possession)
   *   attack      – goal threat / quality of final-third bodies
   *   width       – ability to stretch play and create from wide areas
   *   compactness – how hard the shape is to play through centrally
   *   press       – appetite & structure for winning the ball high
   */
  const FORMATIONS = [
    {
      id: "4-4-2",
      name: "4-4-2",
      nick: "The Classic",
      blurb: "Two banks of four and a strike partnership. Balanced and familiar.",
      ratings: { defense: 7, midfield: 6, attack: 7, width: 7, compactness: 7, press: 6 },
      tags: ["balanced", "twoStrikers", "flatBank"],
      strengths: [
        "Natural width from two wide midfielders",
        "Strike partnership occupies both centre-backs",
        "Solid, well-drilled defensive bank of four",
      ],
      weaknesses: [
        "Can be outnumbered in central midfield (only two)",
        "Midfield gets overrun by three-man midfields",
      ],
    },
    {
      id: "4-3-3",
      name: "4-3-3",
      nick: "The Pressers",
      blurb: "Front three and a mobile midfield trio. Aggressive and wide.",
      ratings: { defense: 6, midfield: 7, attack: 8, width: 8, compactness: 6, press: 8 },
      tags: ["attacking", "wideAttack", "highPress", "threeForwards"],
      strengths: [
        "Front three pins back defences and presses high",
        "Wide forwards stretch the pitch and isolate full-backs",
        "Three midfielders give central support",
      ],
      weaknesses: [
        "High line is vulnerable to quick counters in behind",
        "Full-backs left exposed when wingers push on",
      ],
    },
    {
      id: "4-2-3-1",
      name: "4-2-3-1",
      nick: "The Blueprint",
      blurb: "Double pivot, a creative ten and a lone striker. Modern and controlled.",
      ratings: { defense: 7, midfield: 8, attack: 7, width: 6, compactness: 7, press: 7 },
      tags: ["balanced", "midControl", "doublePivot"],
      strengths: [
        "Double pivot screens the defence and controls tempo",
        "Strong central overloads through the number ten",
        "Balanced between attack and defence",
      ],
      weaknesses: [
        "Lone striker can be isolated against deep blocks",
        "Less natural width than wide-attack systems",
      ],
    },
    {
      id: "3-5-2",
      name: "3-5-2",
      nick: "The Engine Room",
      blurb: "Three at the back, dominant midfield five, wing-backs for width.",
      ratings: { defense: 6, midfield: 9, attack: 7, width: 7, compactness: 6, press: 7 },
      tags: ["midControl", "wingbacks", "threeAtBack", "twoStrikers"],
      strengths: [
        "Owns central midfield with a packed five",
        "Wing-backs provide width and overlaps",
        "Two strikers to feed off midfield control",
      ],
      weaknesses: [
        "Channels behind the wing-backs can be exploited",
        "Back three exposed against quick, wide attacks",
      ],
    },
    {
      id: "5-3-2",
      name: "5-3-2",
      nick: "The Fortress",
      blurb: "Five at the back, compact and counter-minded. Hard to break down.",
      ratings: { defense: 9, midfield: 6, attack: 6, width: 5, compactness: 8, press: 4 },
      tags: ["lowBlock", "counter", "fiveAtBack", "defensive"],
      strengths: [
        "Five defenders make a stubborn low block",
        "Designed to soak pressure and counter at speed",
        "Two strikers to break quickly on the turnover",
      ],
      weaknesses: [
        "Cedes possession and territory by design",
        "Can be pinned in and starved of the ball",
      ],
    },
    {
      id: "4-5-1",
      name: "4-5-1",
      nick: "The Wall",
      blurb: "A packed midfield five in front of a four. Built to frustrate.",
      ratings: { defense: 8, midfield: 8, attack: 5, width: 7, compactness: 8, press: 5 },
      tags: ["lowBlock", "compact", "defensive", "midControl"],
      strengths: [
        "Crowded midfield is very hard to play through",
        "Compact shape concedes few clear chances",
        "Good for protecting a lead",
      ],
      weaknesses: [
        "A lone striker offers little attacking threat",
        "Can be too passive and invite pressure",
      ],
    },
    {
      id: "3-4-3",
      name: "3-4-3",
      nick: "The Cavalry",
      blurb: "Three at the back unleashing a bold, wide front three.",
      ratings: { defense: 5, midfield: 7, attack: 9, width: 8, compactness: 5, press: 8 },
      tags: ["attacking", "wideAttack", "threeForwards", "threeAtBack", "highPress"],
      strengths: [
        "Front three plus wide play creates a flood of chances",
        "Aggressive high press wins the ball high up",
        "Overloads opponents in the final third",
      ],
      weaknesses: [
        "Only three at the back — defensively open",
        "Hugely exposed to counters if the press is beaten",
      ],
    },
    {
      id: "4-1-4-1",
      name: "4-1-4-1",
      nick: "The Anchor",
      blurb: "A holding midfielder shields the four; flat, disciplined and tidy.",
      ratings: { defense: 8, midfield: 7, attack: 6, width: 7, compactness: 8, press: 6 },
      tags: ["balanced", "holding", "compact"],
      strengths: [
        "Holding midfielder screens the back four",
        "Compact, disciplined and rarely caught out",
        "Solid platform to control games",
      ],
      weaknesses: [
        "Lone striker can be left isolated",
        "Can lack a cutting edge in attack",
      ],
    },
  ];

  const byId = {};
  FORMATIONS.forEach((f) => (byId[f.id] = f));

  /* Convert "4-2-3-1" into pitch coordinates (x,y in 0-100) for the mini-pitch.
   * y grows from own goal (bottom) toward the opposition (top). */
  function positions(formationId) {
    const lines = formationId.split("-").map(Number);
    const out = [{ x: 50, y: 6, role: "GK" }];
    const rows = lines.length;
    lines.forEach((count, i) => {
      const y = 24 + (rows === 1 ? 30 : (i * (66 / (rows - 1))));
      for (let j = 0; j < count; j++) {
        const x = count === 1 ? 50 : 14 + j * (72 / (count - 1));
        out.push({ x, y, role: roleFor(i, rows) });
      }
    });
    return out;
  }

  function roleFor(rowIndex, rows) {
    if (rowIndex === 0) return "DEF";
    if (rowIndex === rows - 1) return "FWD";
    return "MID";
  }

  GM.FORMATIONS = FORMATIONS;
  GM.formationById = (id) => byId[id];
  GM.formationPositions = positions;
})(window.GameMatch = window.GameMatch || {});
