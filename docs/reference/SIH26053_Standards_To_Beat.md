# SIH26053 — Standards Our Prototype Must Clear to Beat the Best Public Repos

**Benchmark target:** As of the Sep 2026 dossier update, **Stxtics03/vrgrid** (forked publicly as `victorysingh/vrgrid-26`, Team Chronicles.exe) is explicitly named the strongest public repo — "currently the most advanced" and "still the strongest benchmark to beat." Its closest rivals on individual dimensions are **pushpam2404/sih_053** (deployment honesty, negative obstacles, ROS 2/Nav2 integration) and **sam-eer12/sih2026 "NEXA"** (ground/obstacle height separation, clean grid math).

This document does not ask you to beat a strawman. Every row below is either (a) a capability at least one public repo has *already shipped and measured*, meaning it is proven feasible in a hackathon timeframe, or (b) a gap that *rival teams themselves admit* they haven't closed yet, sourced from their own READMEs and the Sep 2026 dossier. Nothing here requires unpublished research.

---

## How to use this file

Each row is a pass/fail bar, not a nice-to-have. "Current best" names which repo already clears it, so you know the bar is real. Treat any row with **no** name in that column as your genuine whitespace — this is where you can be first, not just competitive.

---

## 1. Core data structure

| # | Standard | Current best (who's already done it) | Why it matters |
|---|---|---|---|
| 1.1 | Nested/nested-ring resolution schedule (e.g. 5cm→10cm→20cm→40/50cm) on **one shared fine lattice**, so every coarse cell is an exact block of fine cells | VRgrid, sih_053 (1:2:10 integer nesting), NEXA | Prevents the #1 named failure mode: alignment errors at resolution boundaries |
| 1.2 | **Zero measured mismatches** at resolution seams, proven with an explicit test (not just claimed) | sih_053 — 0 mismatches / 4,000,000 positions | Judges will ask "what happens at ring boundaries?" — have a number, not an assertion |
| 1.3 | Fixed, preallocated memory envelope (no per-frame allocation) | VRgrid (8.94 MB fixed), sih_053 (18.3 MB) | A hard bound is a strong embedded-systems claim; "our memory usually stays low" is not |
| 1.4 | Ground height and obstacle height stored **separately per cell**, not collapsed into one elevation value | NEXA, sih_053 | Required to represent curbs, potholes, *and* overhangs simultaneously — a single elevation value structurally cannot |
| 1.5 | Empty cells cost zero memory (hash map / spatial hash, not dense array) | VRgrid, sih_053 | Standard technique; not having it is an easy way to lose on memory numbers |
| 1.6 | Closed-form O(1) cell index (no per-point search/lookup loop) | NEXA | Removes an entire class of "projection alignment" bugs by construction |

**Whitespace:** No public repo combines 1.1–1.6 *all at once* with equal rigor. VRgrid is missing 1.4 (ground/obstacle separation). NEXA hasn't shown 1.2/1.3 with the same measured rigor. **Combining all six in one system is currently unclaimed territory.**

---

## 2. Uncertainty and confidence

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 2.1 | Per-cell height **variance**, not just mean, updated online (Welford's algorithm or equivalent) | VRgrid, sih_053 (Welford), dossier explicitly recommends this | Cheap, numerically stable, and expected by name in the dossier |
| 2.2 | Coarsening (merge) preserves uncertainty via **law of total variance** — merged cells do not falsely appear more certain | VRgrid — reports σ≈6.3cm on a merged kerb cell rather than collapsing it | Without this, a curb can "vanish" statistically in the far field even though the raw data still shows it |
| 2.3 | Confidence value is **exposed to and consumed by** a downstream planner (not just computed and displayed) | **No repo has shown this yet** | VRgrid computes planner regret but doesn't show a planner actually avoiding low-confidence cells — this is real whitespace |
| 2.4 | Bayesian elevation fusion — height is treated as an estimate that updates with each new scan rather than being overwritten | Named in dossier as a recommended technique; LiFovea claims this | Prevents one noisy frame from corrupting a stable map |

**Bar to clear:** Do 2.1 and 2.2 (proven feasible), then go further than every current repo on 2.3 — wire per-cell confidence into an actual cost function in your planner (even a simple A* cost multiplier) and show a path that visibly avoids a low-confidence region.

---

## 3. Dynamic / moving-object handling

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 3.1 | Zero "ghost trails" from moving objects, measured (not just described) over a real multi-thousand-frame sequence | VRgrid — 0/4,071 frames on SemanticKITTI seq. 08 | This is the headline dynamic-environment claim in the PS title itself |
| 3.2 | Moving-object test is **viewpoint-robust** — a parked car or wall does not get misreported as moving just because the ego vehicle's viewing angle changed | sih_053 — explicitly beat a naive DBSCAN+SORT baseline that misreported 69/337 static objects as moving; their method: 0/286 and 0/129 | A naive speed-only tracker fails this constantly — you must test against it explicitly, not just claim robustness |
| 3.3 | Recall reported **by range band and by speed**, with honesty about where it drops (e.g. near-field recall falling at high ego speed due to confirmation-window limits) | sih_053 — reports 100%→74% recall shift and explains why | Judges reward exactly this kind of unflattering-but-honest number over a single blanket "accuracy" figure |
| 3.4 | Occlusion explicitly modeled in the test scene (not an idealized "objects never hide behind each other" scenario) | sih_053 | Removing this weakens your recall numbers but makes them defensible under questioning |

**Whitespace:** No repo yet shows dynamic-object handling holding up under **degraded sensor conditions** (dropped beams, rain/dust noise) — this is explicitly named in the dossier as still open. Claiming and testing this is a real differentiator.

---

## 4. Negative obstacles and terrain hazards (curbs, potholes, overhangs)

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 4.1 | Dedicated negative-obstacle detection (below-ground returns with an intact rim nearby), not just "high point = obstacle" | sih_053 — explicitly fixed a real bug: a 40cm pothole was previously reading FREE at traversability 1.00 | Potholes caused 4,446 accidents / 1,856 deaths in India in 2022 per MoRTH — this is the single most India-relevant, judge-legible number in the whole PS |
| 4.2 | False-positive rate on slopes measured explicitly, proving "a slope is not a trench" | sih_053 — 0/8,404 cells misflagged on 2–4% downgrades | Prevents an easy judge gotcha: "what about a hill?" |
| 4.3 | Overhang / passable-underneath detection (a cell has ground clearance but also a ceiling — e.g. a low branch or bridge) | sih_053 has a distinct "teal = overhang" class | Multi-story/overhead blind spot is the classic, literature-documented failure of 2.5D maps |
| 4.4 | **Local, per-patch ground plane estimation** (RANSAC/PCA), not a single global ground assumption | **No repo has this yet** — sih_053's own roadmap lists it as unbuilt, citing a hard ~27m reach limit on 8% downgrades | This is explicitly an open, self-admitted gap in the current best repo — closing it is a direct, named win |

**Bar to clear:** Replicate 4.1–4.3 (proven feasible — one team already did it), then build 4.4, which the strongest competitor explicitly says it hasn't done.

---

## 5. Semantic segmentation / perception

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 5.1 | Segmentation runs on a **real, pretrained** model with a **published mIoU**, never an untrained placeholder | Multiple repos fail this — one publicly reports 5.01% mIoU (worse than a 6.64% random baseline) on an untrained model and flags it honestly | The dossier calls this out explicitly as a pitfall: "never demo an untrained model — judges will ask for your mIoU" |
| 5.2 | mIoU reported **by distance band** (0–10m, 10–25m, 25–50m, 50–100m), not just one blended number | Named explicitly in dossier as a judging checklist item; not clearly shown with rigor by any repo yet | Directly proves (or disproves) that foveation doesn't quietly destroy far-field accuracy |
| 5.3 | Off-road / RELLIS-3D evaluation, with realistic expectations stated (SalsaNext 43.07%, KPConv 19.07% mIoU are the published state of the art — do not claim to beat this without extraordinary evidence) | Not yet done well by any named repo | DRDO vehicles operate off-road; city-only (SemanticKITTI-only) evaluation is a known, callable-out gap |
| 5.4 | Indian / off-road-specific traversability classes: gravel, mud, grass, puddle, curb, pothole, **cattle, autorickshaw** | Still rare — dossier flags this as one of the few remaining genuine differentiators | Western datasets (KITTI, RELLIS-3D) simply do not contain autorickshaws or cattle; a model trained only on them will misclassify these by construction |
| 5.5 | Uses IDD-3D (IIIT-Hyderabad, India-specific) with pseudo-labelling to bridge its bounding-box-only annotations into per-point segmentation labels | Not yet done by any named repo | This is a genuinely open, concrete, buildable piece of work — nobody has done the pseudo-labelling step yet |

---

## 6. Determinism, reproducibility, and honesty (soft power, but judge-visible)

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 6.1 | Bit-identical map hash for the same input (deterministic accumulation, integer/fixed-point not float atomics) | VRgrid | Reproducibility is treated as a system requirement, not an afterthought — a strong engineering-maturity signal to judges |
| 6.2 | **Explicit, stated scope of what was and wasn't tested** (e.g. "we did not test on Jetson hardware," "these are CPU-laptop numbers on synthetic scans") | sih_053 — the most transparent repo found; explicitly states "we would rather hand a reviewer numbers that are smaller and true than numbers that are larger and unverifiable" | The dossier's own top pitfall warning is overclaiming; matching or exceeding this honesty standard directly defuses the hardest judge questions |
| 6.3 | Every claimed number traces to a script/command that regenerates it (no numbers typed by hand into a slide) | VRgrid — `results.json` regenerated by one command, tied to a git commit | Prevents "how do we know this number is real?" |
| 6.4 | Team can explain **every module**, and the repo states clearly what is original vs. built on cited prior work | VRgrid explicitly cites 7 papers/systems it builds on and is explicit about what its actual novel contribution is (the *composition*, not any one idea) | Multiple dossier warnings say judges will probe originality and may recognize copied public repos — narrow, defensible novelty claims survive this; broad ones don't |

---

## 7. Evaluation methodology (beyond raw accuracy)

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 7.1 | **Planner regret** as a first-class metric — does the compressed map actually change the path a planner picks, versus the full-resolution reference | VRgrid — defines R(S) = C(P(S)) − C(P(reference)) | Nobody else asks "did compression change what the robot does" — this is the most judge-impressive metric in any repo found |
| 7.2 | Planner regret demonstrated with an **actual planner integration** (Nav2 Hybrid-A*/MPPI), not a synthetic cost field only | Neither VRgrid (synthetic scene, admits "no universal planner-regret curve yet") nor sih_053 (has Nav2 hookup, but doesn't report regret) does both together | **This is open. Combining VRgrid's regret metric with sih_053's real Nav2 hookup and reporting a real regret number is unclaimed and directly achievable** — both halves already exist separately in public code |
| 7.3 | Fréchet distance or similar path-shape comparison, not just endpoint cost | VRgrid | Shows *how* a path changed, not just that its cost changed |
| 7.4 | Memory savings and compute/latency savings reported **separately**, since one rival's own data shows far-field point-processing savings can be small (78% of returns fall within 25m) even when map-memory savings are large | Dossier explicitly flags this as a Sep 2026 update — a named rival (LiFovea) found this | Conflating the two is an easy, specific thing for a judge to catch you on |

---

## 8. Hardware / deployment reality

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 8.1 | CUDA/TensorRT path exists in the repo | VRgrid, sih_053 (both have `.cu` files) | Table stakes at this point — several repos have this scaffolding |
| 8.2 | CUDA kernels **actually compiled and profiled**, even on a modest consumer GPU, with a real before/after latency number | **No repo has done this** — both VRgrid and sih_053 explicitly say their CUDA code has never been compiled ("no `nvcc` on the dev host") | This is the single most concrete, low-research-risk differentiator on this whole list — the code already exists publicly in spirit, finishing it is a weekend of work, not new research |
| 8.3 | Real hardware run (any embedded board — doesn't have to be the exact target Jetson Orin/Ouster) with reported power/thermal/latency numbers | **No repo has done this** | Every leading repo admits this is untested; being first, even on a cheaper substitute board, is a clean, verifiable win |
| 8.4 | Compiled (non-Python) rasterization/publish stage, since the Python version is a named bottleneck | sih_053 flags this as "over half the [51.8ms] budget," unfixed | Directly fixable — they already scoped the C++ path, just haven't finished it |

---

## 9. Data readiness and demo robustness

| # | Standard | Current best | Why it matters |
|---|---|---|---|
| 9.1 | All datasets and model weights **pre-staged offline** before the finale | Dossier explicitly warns: VRgrid alone needs ~40GB for three SemanticKITTI sequences; finale connectivity is not guaranteed | This is a logistics failure mode, not a technical one — costs nothing to get right, costly to get wrong |
| 9.2 | Synthetic/adversarial test harness — deliberately degraded input (dropped beams, added noise) to show graceful degradation rather than silent failure | Not clearly demonstrated by name in any repo reviewed | Directly answers "what happens when the sensor is dirty/failing?" before it's asked |
| 9.3 | Live dashboard shows the **actual shrinking memory bar** (2MB vs 128MB vs 3.2GB or your own measured equivalents), not just a static slide number | Multiple repos have dashboards (NEXA, sih_053, VRgrid via Rerun) | This is the PS's own named "wow feature" — skipping it is leaving free judge-visible impact on the table |

---

## 10. The combined bar (summary)

No single public repo currently clears all of the following at once. Each item individually is proven achievable by *someone*:

1. Nested-ring 2.5D grid with ground/obstacle height stored separately (§1)
2. Uncertainty-preserving coarsening feeding an actual planner cost function (§2)
3. Viewpoint-robust dynamic-object filtering with occlusion-aware, range/speed-bucketed recall reporting (§3)
4. Negative-obstacle detection **plus** local per-patch ground-plane estimation for slopes (§4)
5. A real pretrained segmentation model, evaluated by distance band **and** on off-road/Indian data, including at least one India-specific class (§5)
6. Deterministic, regenerable, honestly-scoped results (§6)
7. Planner-regret evaluation run against a real Nav2 planner, not a synthetic cost field (§7)
8. At least one genuinely compiled-and-profiled GPU path and/or one real (even modest) embedded-hardware run (§8)
9. Pre-staged offline data and a degraded-sensor demo (§9)

If your prototype clears roughly 70%+ of these rows with honest, regenerable numbers — and is explicit about the rest as "future work," the way the strongest current repos are — it is defensibly ahead of every public SIH26053 repo found as of the Sep 2026 dossier update.
