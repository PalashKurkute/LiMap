---
name: planner_regret_benchmark
description: >
  Methodology and automated verification routines for proving downstream navigational
  fidelity. Compares Hybrid-A* and MPPI trajectory costs on full dense maps vs FoveaGrid 2.5D
  to mathematically demonstrate near-zero planner regret.
---

# Planner Regret Benchmark Skill

This skill defines the verification process that closes the loop between compressed 2.5D mapping and actual downstream autonomous navigation.

---

## 1. Why Planner Regret is Mandatory

Most hackathon entries stop at asserting: *"Our grid saves memory."*  
Evaluators and DRDO scientists will immediately ask:  
*"Does saving memory degrade the vehicle's driving path or cause collisions with overlooked obstacles?"*

**Planner Regret** provides the rigorous, mathematical answer. It proves that a path planner operating on our compressed $3.4\text{ MB}$ map chooses virtually the identical trajectory as one operating on an uncompressed, dense $3.2\text{ GB}$ map.

---

## 2. Mathematical Definition of Regret

Given a start state $\mathbf{x}_{\text{start}}$ and goal state $\mathbf{x}_{\text{goal}}$:
1. Compute the optimal trajectory on the ground-truth dense map $\mathcal{M}_{\text{dense}}$:
   $$\mathcal{P}^*_{\text{dense}} = \arg\min_{\mathcal{P}} \mathcal{J}(\mathcal{P} \mid \mathcal{M}_{\text{dense}})$$
2. Compute the optimal trajectory on our adaptive map $\mathcal{M}_{\text{adaptive}}$:
   $$\mathcal{P}^*_{\text{adaptive}} = \arg\min_{\mathcal{P}} \mathcal{J}(\mathcal{P} \mid \mathcal{M}_{\text{adaptive}})$$
3. Evaluate the cost of $\mathcal{P}^*_{\text{adaptive}}$ against the ground-truth environment $\mathcal{M}_{\text{dense}}$:
   $$\text{Actual Cost} = \mathcal{J}(\mathcal{P}^*_{\text{adaptive}} \mid \mathcal{M}_{\text{dense}})$$
4. **Planner Regret:**
   $$\mathcal{R}_{\text{regret}} = \frac{\mathcal{J}(\mathcal{P}^*_{\text{adaptive}} \mid \mathcal{M}_{\text{dense}}) - \mathcal{J}(\mathcal{P}^*_{\text{dense}} \mid \mathcal{M}_{\text{dense}})}{\mathcal{J}(\mathcal{P}^*_{\text{dense}} \mid \mathcal{M}_{\text{dense}})} \times 100\%$$

**Target Invariant:** $\mathcal{R}_{\text{regret}} < 1.5\%$.

---

## 3. Geometric Trajectory Deviation Metrics

In addition to trajectory cost, calculate spatial divergence:
* **Maximum Path Deviation (Hausdorff Distance):**
  $$\mathcal{D}_{\max} = \max_{\mathbf{p}_a \in \mathcal{P}^*_{\text{adaptive}}} \min_{\mathbf{p}_d \in \mathcal{P}^*_{\text{dense}}} \|\mathbf{p}_a - \mathbf{p}_d\|_2$$
  *Target Invariant:* $\mathcal{D}_{\max} < 0.10\text{ m}$ ($10\text{ cm}$).
* **Mean Absolute Deviation:**
  $$\mathcal{D}_{\text{mean}} = \frac{1}{K} \sum_{k=1}^K \|\mathbf{p}_a(t_k) - \mathbf{p}_d(t_k)\|_2$$
  *Target Invariant:* $\mathcal{D}_{\text{mean}} < 0.04\text{ m}$ ($4\text{ cm}$).

---

## 4. Execution Workflow

When running the regret benchmark:
1. Load test sequences from SemanticKITTI and RELLIS-3D.
2. Generate both the dense 5 cm costmap and the FoveaGrid 2.5D costmap.
3. Spawn 100 randomized valid navigation goals ($10\text{ m}$ to $80\text{ m}$ away).
4. Run the Hybrid-A* planner across all 100 test runs.
5. Export automated CSV / JSON report tabulating:
   * Regret percentage across distance bins.
   * Path clearance safety margin delta.
   * Planning computation speedup ($>15\times$ faster collision checks on FoveaGrid).
