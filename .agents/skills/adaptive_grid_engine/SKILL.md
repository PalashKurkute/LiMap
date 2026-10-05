---
name: adaptive_grid_engine
description: >
  Specification and algorithms for the multi-factor variable-resolution 2.5D ring grid,
  nested lattice indexing, Welford online mean/variance, dual-elevation overhang extraction,
  and spatial hash memory pooling.
---

# Adaptive Grid Engine Skill

This skill enforces the core spatial representation invariants of `FoveaGrid-2.5D`.

---

## 1. Nested Lattice Invariant (Zero Boundary Seam Tearing)

To guarantee that cells of different resolutions line up seamlessly without cracks or interpolation gaps:
* **Base Grid Unit:** $\delta_0 = 0.05\text{ m}$ ($5\text{ cm}$).
* **Permitted Scale Multipliers:** $k \in \{1, 2, 5, 10\}$ corresponding to:
  * Level 0 ($k=1$): $5\text{ cm}$
  * Level 1 ($k=2$): $10\text{ cm}$
  * Level 2 ($k=5$): $25\text{ cm}$
  * Level 3 ($k=10$): $50\text{ cm}$

Every continuous coordinate $(x, y)$ is quantized by:
$$u = \left\lfloor \frac{x}{k \cdot \delta_0} \right\rfloor, \quad v = \left\lfloor \frac{y}{k \cdot \delta_0} \right\rfloor$$
Because every multiplier $k_j$ divides $k_{j+1}$, spatial hierarchy lookups and coarsening/refinement operations are exact integer block aggregations with zero aliasing.

---

## 2. Dual-Elevation Band Overhang Algorithm

In each cell $(u, v)$, points are sorted or binned vertically to detect underpasses and low canopies:
1. Identify the ground return $z_{\text{ground}}$ via lowest elevation cluster or RANSAC plane fitting within the cell.
2. If points exist above $z_{\text{ground}} + H_{\text{clearance\_threshold}}$ (e.g. $1.8\text{ m}$), calculate the lowest overhead point:
   $$z_{\text{ceiling}} = \min \{ z_i \mid z_i > z_{\text{ground}} + H_{\text{clearance\_threshold}} \}$$
3. Available passage height:
   $$\Delta z_{\text{clearance}} = z_{\text{ceiling}} - z_{\text{ground}}$$
4. Traversability state:
   * If no ceiling exists: Marked as open terrain.
   * If $\Delta z_{\text{clearance}} \ge H_{\text{vehicle}} + \text{margin}$: Flagged as `Traversable_Underpass`.
   * If $\Delta z_{\text{clearance}} < H_{\text{vehicle}} + \text{margin}$: Flagged as `Overhang_Obstacle` (impassable).

---

## 3. Welford's Online Elevation Statistics (the Kalman update in `welford_fusion.py` is not wired in)

For continuous updates without memory bloat:
$$\mu_n = \mu_{n-1} + \frac{z_i - \mu_{n-1}}{n}$$
$$M_{2, n} = M_{2, n-1} + (z_i - \mu_{n-1})(z_i - \mu_n)$$
$$\sigma_n^2 = \frac{M_{2, n}}{n}$$
* Uncertainty metric: $\sigma_n$ directly feeds the multi-factor foveation index. High uncertainty prompts the controller to subdivide coarse cells into finer levels.

---

## 4. Preallocated Spatial Hash & Memory Bounds

* All active cells reside in a continuous preallocated array of `FoveaCell` structs (32 bytes each).
* Hash key:
  $$\text{key} = (\text{Morton2D}(u, v) \oplus (\text{level} \times 0x9e3779b9)) \pmod{N_{\text{capacity}}}$$
* Fixed pool: 106,875 cells x 32 B = 3.2616 MB, preallocated, so no heap allocation per frame.
