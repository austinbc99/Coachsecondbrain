# Coach OS — Program Builder Module

**Spec v0.1 · Competitive teardown → build plan**
Source analyzed: `coachbpatel.com/ai-program` (Patel Training System AI Program Builder, $97/mo standalone)
Author: Coach Austin C., ATC · Head Coach, FitClub CT

---

## 0. Read this first — what the source actually is

The page is a **sales page**, not a methodology document. The programming logic
sits behind a $97/mo paywall and is not on the page. What *is* on the page is the
**product architecture**: the input schema, the feature set, the athlete-side loop,
and the analytics surface.

That distinction matters for what we build:

- **Extractable and worth having:** the product architecture. Feature patterns are
  not proprietary and this teardown is normal competitive analysis.
- **Not extractable:** the actual sequencing rules, set/rep schemes, and the MAPPS
  ladder contents. We do not have them and should not reverse-guess them.
- **Not worth copying even if we had it:** "Patel Training System" is his branded
  stack. Coach OS already has a methodology stack (McMillan/ALTIS, Spellman,
  Holler, Natera, Baynton) that is fully documented in NotebookLM. The engine
  should encode *that* stack, not his.

> **Open item:** MAPPS is Patel's acronym and its expansion is not stated on the
> page. Do not guess it in code or comments. We are building our own ladder
> (§3.2) regardless.

---

## 1. Their architecture, as observed

### 1.1 Input schema
| Field | Values |
|---|---|
| Sport | 16 (hockey, field hockey, basketball, baseball/softball, soccer, lacrosse, football, rugby, volleyball, tennis, golf, track & field, XC, acro & tumbling, swimming, wrestling) + general athletic + general fitness |
| Position | Sub-sport granularity (hockey goalie ≠ forward; LAX midfield ≠ attack) |
| Season phase | 5 |
| Session phases | 7 |
| Athlete level | Free text / tier |
| Days per week | Integer |
| Injuries | Flags |
| Equipment | Availability constraints |
| KPIs / testing data | Optional numeric inputs |

### 1.2 Generation logic (only what they surface publicly)
- Aerobic developed before lactic
- Strength sequenced to season phase
- Load managed across the week, not per-session
- Conditioning derived from a sport-by-sport needs analysis, position-aware

That is four sentences of methodology. It is defensible and it is also standard
periodization — nothing here that our stack does not already cover in more depth.

### 1.3 The three genuinely good product ideas
1. **Injury flags govern the entire session, not just the main lift.** A knee flag
   strips flight-phase work out of the warm-up and the plyo block too. A shoulder
   flag pulls overhead and ballistic pressing from *every* block.
2. **Constraint-triggered partial rebuild.** "No bike today" rebuilds only that
   conditioning block instead of regenerating the whole program.
3. **Block-to-block continuity.** The finished block's actual completion data —
   what got done, what got skipped — is the input to writing the next block.

### 1.4 Athlete side
- Email-based entry, no app store install
- Shows **today's session only**, not the whole block
- Check-off per item; logs actual load + RPE
- Demo video attached to every movement
- Trends surfaced: estimated 1RM across the block, weekly volume, consistency,
  RPE at a given load

### 1.5 Output
- Every field editable post-generation
- Progress / Regress control per movement, one rung at a time
- PDF export **and** simultaneous push to athlete log

---

## 2. Gap analysis vs. current Coach OS

### 2.1 What we already have that they do not
- OHM force-velocity profiling as a real input, not a self-reported description
- VALD force plate integration (CMJ braking asymmetry, RSI, DJ vs hop RSI)
- Norms engine: literature-sourced grading *plus* roster-baseline grading
- Film Room sprint mechanics
- Athlete health audit
- Force Lab dashboards (9 diagram types)
- Device-bound token athlete app with server-side grading (Cloudflare Worker + D1)

### 2.2 What they have that we do not — the actual build list
| # | Gap | Priority | Notes |
|---|---|---|---|
| G1 | Global injury-governance layer | **P0** | Cross-block, not per-exercise. Highest-value idea on their page. |
| G2 | Progress/Regress ladder per movement | **P0** | Screened against equipment + injury simultaneously |
| G3 | Session-in-front-of-you athlete view | **P1** | We show blocks; they show today. Better compliance surface. |
| G4 | Demo video per movement | **P1** | They claim 1,000+. Ours can be shot in-house at 210 Old Dam Rd. |
| G5 | Athlete-logged load + RPE feeding back into next block | **P1** | Closes the loop we currently close manually |
| G6 | Constraint-triggered partial rebuild | **P2** | Cheap to add once blocks are addressable objects |
| G7 | Position-level conditioning granularity | **P2** | We do this by hand already; needs encoding |
| G8 | PDF export co-emitted with athlete push | **P2** | We have the parent-facing OHM PDF template to build from |

---

## 3. Build plan

### 3.1 G1 — Injury governance layer (P0)

Do **not** implement injury handling as a per-exercise blocklist. Implement it as
a **constraint object evaluated against every block in the session**.

```js
// injury constraint shape
{
  region: "knee",              // knee | ankle | hip | shoulder | elbow | spine
  status: "managed",           // acute | managed | cleared-progressive
  bans: {
    qualities: ["flight-phase", "max-decel", "reactive-plyo"],
    patterns:  ["bilateral-jump-land", "cut-90"],
    blocks:    ["warmup", "plyo", "speed", "main", "accessory", "conditioning"]
  },
  substitutions: { "reactive-plyo": "iso-landing-hold" }   // Natera
}
```

Evaluation order: **generate → screen every block against every active constraint
→ substitute → re-check.** Never generate-then-patch-the-main-lift only. That is
exactly the failure mode their page is calling out, and it is the one an ATC
should be least willing to ship.

Seed the substitution map from the athletes already in the system — Chase
(managed Achilles), Hannah (patellar protection), Sophie (CMJ braking asymmetry),
Taryn (right-leg power deficit). Those four cover most of the constraint surface
we actually see.

### 3.2 G2 — Progress/Regress ladder

Build our own, sourced from our own stack. Each movement gets a rung index within
a pattern family; Progress/Regress moves ±1 rung and re-screens.

```js
{
  pattern: "decel-plant-cut",
  rungs: [
    { i: 0, name: "2-step decel, submax, straight",     src: "Baynton" },
    { i: 1, name: "backpedal → sprint transition",      src: "Baynton" },
    { i: 2, name: "45° plant-and-cut, cued",            src: "Baynton" },
    { i: 3, name: "90° cut, reactive",                  src: "Baynton/Spellman" },
    { i: 4, name: "open-field reactive cut vs stimulus", src: "Spellman" }
  ],
  equipmentByRung: [[], [], ["cones"], ["cones"], ["cones","light"]]
}
```

Ladder families to author first: decel/COD (Baynton, Spellman), acceleration
(McMillan/ALTIS), plyo/landing (Natera iso holds), bilateral→unilateral strength,
posterior chain, conditioning modality.

### 3.3 The strategic point — do not rebuild their product

Their builder is **description-in**: the coach types a paragraph about an athlete
and the model infers everything downstream. Ours is **data-in**: the athlete's
OHM profile, force plate output, and laser splits are already in D1 before a
single word is typed.

That is the moat, and it is not one they can copy without buying force plates and
hiring an ATC. Positioning for the module should be explicit about it:

> *Their input is a sentence about the athlete. Ours is the athlete's force-velocity
> profile, braking asymmetry, and 10m split — measured last Tuesday.*

Concretely, that means the generator's first pass should read from the OHM record
and the norms engine and pre-fill every field their builder asks the coach to type.
The coach confirms rather than describes.

### 3.4 Sequencing (suggested)
1. **Sprint 1 (P0):** injury constraint object + global screen + 3 ladder families
2. **Sprint 2 (P0/P1):** generator reads OHM/VALD, pre-fills inputs, writes block
3. **Sprint 3 (P1):** today's-session athlete view + load/RPE logging
4. **Sprint 4 (P1/P2):** completion data → next block input; partial rebuild
5. **Sprint 5 (P2):** demo video library, position granularity, PDF co-emit

---

## 4. Commit notes

Repo pattern reminders (per prior work):
- GitHub Contents API `PUT` with `sha` for updates, base64 content, branch `"main"` explicit
- Verify via the Contents API — `raw.githubusercontent.com` is cache-unreliable
- Module intended as a drop-in alongside `coach-os-super-patch.js` and
  `forcelab-dropin.js`; suggested filename `program-builder-dropin.js`

Suggested path for this document: `/docs/program-builder-spec.md`

---

## 5. Head in the Clouds — realignment check

*Triggered: new feature milestone.*

- **Goal:** a program generator inside Coach OS that writes defensible blocks from measured data.
- **Why:** hours back per week, and consistency across Charlie's and Raleigh's sessions — not just parity with a competitor's feature list.
- **Drift risk:** building *their* product because their page is well-designed. Their input is a description; ours is a force plate. If we start asking coaches to type paragraphs, we have drifted.
- **Call:** build G1 and G2 first. They are the two pieces that are genuinely better than what we do by hand today, and both encode our own methodology rather than importing someone else's.
