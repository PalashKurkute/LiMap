---
name: lidar_perception_pipeline
description: >
  Protocol and procedures for LiDAR sensor data ingestion, motion deskewing,
  spherical range-image projection, deep semantic segmentation inference, and
  moving-object segmentation (MOS) anti-ghosting.
---

# LiDAR Perception Pipeline Skill

This skill governs the front-end signal processing, neural network inference, and dynamic object separation components of `FoveaGrid-2.5D`.

---

## 1. Sensor Ingestion & Motion Deskewing

Because spinning LiDAR sensors acquire points over a finite rotational sweep (~$100\text{ ms}$ at $10\text{ Hz}$), linear and angular vehicle motion distorts the raw point cloud.

### Deskewing Procedure
1. Receive raw scan $P = \{\mathbf{p}_i = (x_i, y_i, z_i, I_i, t_i)\}_{i=1}^N$ where $t_i \in [t_{\text{start}}, t_{\text{end}}]$.
2. Obtain high-rate vehicle poses $\mathbf{T}_{t_i} \in \text{SE}(3)$ from KISS-ICP or FAST-LIO2 odometry.
3. Transform each point into the frame at scan completion $t_{\text{end}}$:
   $$\mathbf{p}_i' = \mathbf{T}_{t_{\text{end}}}^{-1} \cdot \mathbf{T}_{t_i} \cdot \mathbf{p}_i$$
4. Output deskewed point cloud ready for spatial projection.

---

## 2. Spherical Range-Image Projection

To achieve $\ge 25\text{ FPS}$ inference on edge hardware (Jetson Orin), 3D points are mapped to a structured $2\text{D}$ spherical range tensor:
$$\theta = \arcsin\left(\frac{z}{r}\right), \quad \phi = \arctan2(y, x), \quad \text{where } r = \sqrt{x^2 + y^2 + z^2}$$
$$u = \left\lfloor \frac{1}{2} \left(1 - \frac{\phi}{\pi}\right) W \right\rfloor, \quad v = \left\lfloor \left(1 - \frac{\theta - \text{fov}_{\text{down}}}{\text{fov}}\right) H \right\rfloor$$

* Standard Resolution: $H = 64\text{ beams}, W = 2048\text{ azimuth steps}$.
* Input Channels: 5 channels: $[x, y, z, \text{range } r, \text{intensity } I]$.

---

## 3. Deep Semantic Segmentation Inference

* **Supported Backbones:** SalsaNext, RandLA-Net, PointNet++ (lightweight baseline).
* **Target Classes:** Unified 12-class taxonomy mapping SemanticKITTI, RELLIS-3D, and IDD-3D into standard vehicle traversability labels.
* **Inference Engine:** TensorRT FP16 compiled engine with CUDA stream pipelining.
* **Evaluation Standard:** Report calibrated distance-binned mIoU:
  * Bin 1: $0\text{–}10\text{ m}$ (Near-field critical)
  * Bin 2: $10\text{–}30\text{ m}$ (Mid-field maneuver)
  * Bin 3: $30\text{–}60\text{ m}$ (Far-field awareness)
  * Bin 4: $60\text{–}100\text{ m}$ (Horizon boundary)

---

## 4. Moving Object Segmentation (MOS) & Ghost Removal

Points belonging to dynamic classes (vehicles, cyclists, pedestrians, cattle) are audited for temporal motion to avoid polluting the static terrain map:
1. **Residual Motion Test:** Calculate displacement between consecutive scans after ego-motion subtraction.
2. **Dynamic Points Decoupling:** Points with confirmed motion $|\mathbf{v}| > 0.3\text{ m/s}$ bypass the static elevation map and are routed to the **Dynamic Tracker**.
3. **Conservative Free-Space Ray-Clearing (FreeDOM):** For previously populated cells that are traversed by clear laser rays in the current scan, occupancy evidence is decremented to immediately dissolve ghost walls.
