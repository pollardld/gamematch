# GameMatch ⚽

A tactical thought experiment in 11v11 football. Pick a formation, let an
intelligent opposition manager pick theirs, simulate a 90-minute match, and
quiz the analyst about the result.

> No build step, no dependencies. Just open `index.html` in a browser.

## How to play

1. **Team Sheet** — Choose your formation from eight tactical shapes. Each card
   shows a mini-pitch, a nickname, and its biggest strength and weakness.
2. **Kick Off** — A computer manager (with its own personality and reasoning)
   picks a formation simultaneously. The match is simulated.
3. **Full Time** — See the scoreline, an explanation of *why* it happened,
   formations on the pitch, match stats (possession, shots, xG, midfield,
   solidity) and a live-style timeline.
4. **Ask the Analyst** — Ask questions in plain language ("Who won the midfield
   battle?", "Did I deserve to win?", "What should I have played instead?").
5. **New Game** — Start again with a fresh matchup.

## The tactical model

Each formation has zone ratings (defense, midfield, attack, width, compactness,
press) and tactical tags. The simulation models real footballing ideas:

- **Midfield battle → possession.** More central bodies and pressing intensity
  win the central numbers game and the ball.
- **Width vs compactness → chance creation.** Wide attacks punish stretched,
  open shapes; compact low blocks crowd them out.
- **Tactical rock-paper-scissors.** e.g. a wide attack exploits the channels
  behind a back three; a deep block springs counters in behind a high press;
  two strikers get outnumbered by a back five.

Chances become **expected goals (xG)**, which are Poisson-sampled into a real
scoreline — so the better shape usually wins, but an underdog can still nick it.

## Formations included

`4-4-2` · `4-3-3` · `4-2-3-1` · `3-5-2` · `5-3-2` · `4-5-1` · `3-4-3` · `4-1-4-1`

## Project structure

```
index.html         layout & three screens (setup / match / analyst)
css/styles.css     stadium-night, tactics-board styling
js/formations.js   formation ratings, tags, strengths/weaknesses, pitch coords
js/engine.js       simulation: possession, xG, goals, stats, timeline
js/ai.js           opposition manager — personalities + formation evaluation
js/analyst.js      post-match explanation + natural-language Q&A
js/ui.js           screens, rendering and game flow
```
