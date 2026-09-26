# SIH 26053: Problem Statement Context & Domain Dossier

**Problem Statement ID:** SIH26053  
**Title:** Adaptive Variable Resolution 2.5D Lidar Mapping for Dynamic Environment Perception  
**Ministry / Organization:** Ministry of Defence / Defence Research and Development Organisation (DRDO)  
**Target Domain:** Autonomous Unmanned Ground Vehicles (UGVs), Off-road Defence Robotics, Dynamic Mixed-Traffic Operations  
**Category:** Software  

---

## 1. Executive Summary (The 10-Second Mental Model)

Modern autonomous vehicles and defence UGVs receive over **1.3 million 3D points per second** from rotating LiDAR sensors. Storing and processing this in a dense 3D voxel grid at uniform high resolution (e.g., 5 cm cubes over a 100 m radius) requires **over 3.2 GB of RAM per frame**, causing fatal compute latency on embedded vehicle computers (e.g., NVIDIA Jetson Orin). Flat 2D occupancy grids discard elevation entirely, missing lethal low-profile hazards (curbs, ditches, potholes) and overhanging obstacles.

**Our Mission:**  
Build an **intelligent, multi-factor adaptive 2.5D mapping engine** that borrows from human ocular foveation—keeping millimeter/centimeter sharpness (5 cm) near the vehicle and on safety-critical entities (pedestrians, poles, trenches), while gracefully coarsening (up to 50 cm) in distant or smooth homogeneous zones. Crucially, we overcome the classic 2.5D blind spot by introducing a **dual-elevation overhang layer**, **probabilistic Bayesian uncertainty updates**, and a **temporal moving-object layer** that prevents ghost trails from corrupting traversability.

---

## 2. Real-World Urgency & Operational Context

### 2.1 Defence & DRDO Operational Requirements
DRDO labs—including **CAIR** (Centre for Artificial Intelligence & Robotics, Bengaluru), **CVRDE** (Combat Vehicles Research & Development Establishment, Chennai - famed for Project MUNTRA BMP-II UGVs), **R&DE(E)** (Pune), and **VRDE** (Ahmednagar)—require real-time perception for autonomous ground vehicles operating in:
* **High-Altitude Ladakh & Desert Borders:** Unpaved rocky terrain, scree slopes, sudden drop-offs, and trenches where GPS/GNSS signals are aggressively jammed or spoofed.
* **Counter-IED and Reconnaissance Missions:** Remote mine clearing and perimeter security where small vertical irregularities (mound disturbances, craters) must be preserved in the map without sensor lag.
* **Low-Power Edge Hardware:** Systems must execute in real-time ($>15$ to $30\text{ FPS}$) under strict thermal envelopes on embedded platforms (NVIDIA Jetson Orin Nano / AGX Orin) drawing $<30\text{–}60\text{ Watts}$.

### 2.2 Dual-Use Civilian Reality: The Indian Road Context
According to the Ministry of Road Transport and Highways (**MoRTH**) *"Road Accidents in India"* report:
* **1,68,491 lives lost** in a single year (~461 deaths daily).
* **Potholes and vertical road anomalies alone caused 4,446 accidents and 1,856 deaths.**
* Standard Western autonomous driving stacks fail on Indian roadways due to unstructured traffic: weaving two-wheelers, autorickshaws, pedestrians crossing without signals, cattle, unpaved shoulders, and absent lane markings.
* A perception stack must maintain fine-grained resolution on thin objects (signposts, barrier poles, pedestrians) and negative obstacles (potholes) regardless of distance, while coarsening flat asphalt.

---

## 3. Sensor Physics & The Computational Bottleneck

### 3.1 Raw LiDAR Data Rates
| Sensor Model | Beams / Channels | Points / Second | Typical Range | Frame Rate | Single Frame Size (Raw) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Velodyne HDL-64E** | 64 | ~1.3–2.2 Million | 120 m | 10 Hz | ~20–35 MB (Float XYZI) |
| **Ouster OS1-128** | 128 | ~2.6–5.2 Million | 120 m | 10–20 Hz | ~40–80 MB |
| **Livox Mid-360** | Non-repetitive solid-state | ~200,000 | 40 m | 10 Hz | ~3.2 MB |

### 3.2 The Worked Memory Comparison (The Core Selling Proof)
Consider a vehicle mapping a $200\text{ m} \times 200\text{ m}$ area ($100\text{ m}$ radius) with a $10\text{ m}$ vertical clearance window:

1. **Uniform 5 cm 3D Voxel Grid:**
   $$\text{Voxels} = \left(\frac{200}{0.05}\right) \times \left(\frac{200}{0.05}\right) \times \left(\frac{10}{0.05}\right) = 4,000 \times 4,000 \times 200 = 3.2 \times 10^9 \text{ voxels}$$
   At a minimal $1\text{ byte/voxel}$, memory consumption is **$\approx 3.2\text{ GB}$**. Unusable for real-time edge processing.

2. **Uniform 5 cm 2.5D Elevation Grid:**
   $$\text{Cells} = 4,000 \times 4,000 = 16,000,000 \text{ cells}$$
   Storing elevation, variance, semantic label, and count ($8\text{ bytes/cell}$):
   $$\text{Memory} = 16 \times 10^6 \times 8\text{ B} = 128\text{ MB}$$

3. **Multi-Factor Adaptive 2.5D Ring Lattice (Our Solution):**
   * Ring 0 ($0\text{–}10\text{ m}$, $5\text{ cm}$ resolution): $400 \times 400 = 160,000\text{ cells} \to \approx 1.28\text{ MB}$
   * Ring 1 ($10\text{–}30\text{ m}$, $10\text{ cm}$ resolution): Concentric annular area $= 160,000\text{ cells} \to \approx 1.28\text{ MB}$
   * Ring 2 ($30\text{–}60\text{ m}$, $25\text{ cm}$ resolution): Concentric annular area $= 68,000\text{ cells} \to \approx 0.54\text{ MB}$
   * Ring 3 ($60\text{–}100\text{ m}$, $50\text{ cm}$ resolution): Concentric annular area $= 40,000\text{ cells} \to \approx 0.32\text{ MB}$
   * **Total Footprint:** $\approx 428,000\text{ active cells} \approx \mathbf{3.42\text{ MB}}$.
   * **Reduction:** **$37.4\times$ memory reduction** vs uniform 2.5D grid; **$>930\times$ memory reduction** vs 3D voxel grid.

### 3.3 The Angular Beam Divergence Fact
For a 64-beam spinning LiDAR, beam angular elevation separation is $\approx 0.4^\circ$. At $50\text{ m}$ distance, adjacent scan rings land **$\approx 10.8\text{ meters}$ apart** on ground planes. In a single frame, **over $99.2\%$ of uniform 5 cm cells beyond 40 m receive zero laser returns**. Allocating uniform high resolution at long range is pure memory waste.

---

## 4. Benchmark Datasets Analysis

| Dataset | Modality & Size | Target Utility in Pipeline | Key Classes / Attributes | Limitations & Handling |
| :--- | :--- | :--- | :--- | :--- |
| **SemanticKITTI** | 22 sequences, ~43,000 scans, 64-beam Velodyne | Baseline semantic segmentation & odometry validation | 28 classes (road, sidewalk, vehicle, pedestrian, pole, vegetation) | Western urban/highway only. No off-road terrain or Indian traffic types. |
| **RELLIS-3D** (Texas A&M) | 13,556 scans, 32-beam Ouster OS1-64, synchronized RGB | Critical benchmark for DRDO off-road UGV traversability | 20 off-road classes: mud, puddle, rubble, tall grass, bush, soil, obstacle | Difficult; state-of-the-art mIoU is only ~43%. Realistic expectations must be stated. |
| **IDD-3D** (IIIT Hyderabad) | 223,000 3D bounding boxes, 5+ hours driving in Hyderabad | Validation for Indian mixed traffic scenarios | 17 classes: autorickshaw, animal/cattle, pedestrian, bus, motorbike | Bounding boxes rather than per-point semantic masks; converted via pseudo-labelling. |
| **SemanticPOSS** (Peking Univ.) | 6 sequences, ~2,988 frames | Validation for dense dynamic object tracking & pedestrian separation | Pedestrians, riders, vehicles, thin poles | Smaller dataset; used specifically to stress-test moving-object segmentation (MOS). |
| **KITTI-360** | Long multi-sensor trajectories | Scalability & memory-over-time stress testing | Urban scenes, static vs dynamic instance segmentation | Very large download; sampled sequences 00 and 07 used for evaluation. |

---

## 5. Competitive Landscape & Weakness Analysis

An audit of existing public SIH 26053 solutions reveals common pitfalls and architectural vulnerabilities:

| Competitor Repository | Reported Approach | Identified Blindspots & Flaws | Our Winning Edge |
| :--- | :--- | :--- | :--- |
| **Stxtics03/vrgrid** *(Chronicles.exe)* | Deterministic 8.94 MB ring grid, uncertainty preservation, Rerun viewer | Distance-only rings; fails to preserve thin poles/pedestrians at distance; single elevation ceiling | Multi-factor foveation (Distance + Roughness + Semantics + Hazard); dual-elevation band |
| **pushpam2404/sih_053** | ROS 2 Jazzy, FAST-LIO2, Nav2, Jetson focus | Standard ring grid; lacks off-road classes; no dynamic decaying persistence | RELLIS-3D off-road validation; temporal Bayesian ghost elimination; planner regret testing |
| **saxenaatharv/3D--2.5D-LIDAR** | RandLA-Net via Open3D-ML, 3 super-classes, sparse rings | 3 superclasses discard subtle terrain hazards; untrained head baseline issues | 12 granular classes; pre-trained & fine-tuned SalsaNext/RandLA-Net weights; calibrated mIoU |
| **p3iyanshu/RakshaSetu** *(JanSetu)* | PointNet++, FastAPI/React dashboard, bounding box tracking | PointNet++ is too slow for 10 Hz real-time; 2.5D map is static slice | Fast range-image projection; sub-30ms cycle latency; dynamic layer decoupling |
| **kaushik521645/lidar-2.5D** | RandLA-Net, Kalman anti-ghosting, speed-adaptive fovea | Single ground height per cell; underpasses and tree branches wipe out paths | Dual-elevation band (Ground elevation + Overhang ceiling + Clearance height) |
| **akumar4be26-crypto/LiFovea** | CPU NumPy, Bayesian fusion, 0.8m tiles with A* | 0.8m resolution is too coarse for potholes/curbs; CPU bound | Sub-centimeter 5cm inner lattice; GPU accelerated via CuPy/Numba; zero-copy ring buffer |

---

## 6. The 5 Core Vulnerabilities in Literature & How We Solve Them

1. **Overhangs & Multi-Story Blind Spot:**  
   * *Problem:* Standard 2.5D grids store only $(x, y) \to z$. Underpasses, bridges, parking shelters, and low tree canopies appear either as impenetrable solid walls or lose their overhead structure entirely.  
   * *Our Fix:* Dual-elevation band storage: $[z_{\text{ground}}, z_{\text{ceiling}}, \Delta z_{\text{clearance}}]$. A vehicle passes freely if $\Delta z_{\text{clearance}} > H_{\text{vehicle}}$.

2. **Distance-Only Foveation Hazard:**  
   * *Problem:* Fixed geometric rings coarsen everything beyond 30 m to 25–50 cm. A 10 cm barrier post or a pedestrian at 35 m vanishes into the averaged elevation.  
   * *Our Fix:* Multi-Factor Resolution Controller. Resolution is a function of:
     $$\text{Resolution} = f(\text{Range}, \text{Terrain Roughness}, \text{Semantic Hazard Level}, \text{Dynamic Velocity}, \text{Compute Headroom})$$
     Safety-critical thin obstacles stay mapped at 5–10 cm regardless of distance.

3. **Dynamic Ghost Trails:**  
   * *Problem:* A bus or cow moves across the scene; if past elevation points are accumulated, the trajectory creates phantom obstacles ("ghost walls") that block planners.  
   * *Our Fix:* Dedicated Moving Object Segmentation (MOS) + Conservative Free-Space Ray Clearing (FreeDOM principle) + Decoupled Dynamic Entity Tracker.

4. **Lack of Uncertainty Propagation:**  
   * *Problem:* Competing teams average elevation values. Sparse, noisy, or edge hits corrupt accurate prior measurements.  
   * *Our Fix:* Incremental Bayesian fusion using **Welford's online algorithm** to compute height mean $\mu_z$ and running variance $\sigma_z^2$ without storing past points.

5. **No Downstream Planner Closed-Loop Proof:**  
   * *Problem:* Teams declare "memory saved" without proving an autonomous vehicle can still navigate safely.  
   * *Our Fix:* **Planner Regret Evaluation**. Run Nav2 Hybrid-A* on both the full 3D point cloud / uniform grid vs our adaptive 2.5D grid and demonstrate identical trajectory cost (Planner Regret $\approx 0$).

---

## 7. Rehearsed Judge Questions & Defensible Answers

* **Q1: "Does far-field foveation actually save compute, or only memory?"**  
  * *Answer:* "Honest distinction: LiDAR point returns are physically concentrated near the vehicle ($>75\%$ within $25\text{ m}$). Thinning far points saves modest input-parsing time, but the massive breakthrough is in **downstream map memory and spatial query latency**. A $3.4\text{ MB}$ grid allows local path planners (Nav2, MPPI) to perform collision checking $20\times$ faster than an unbounded 3D voxel hierarchy, fitting completely within L2/L3 cache."
* **Q2: "What happens at ring boundaries? Do cells mismatch or produce artifacts?"**  
  * *Answer:* "We utilize a **nested lattice architecture** anchored to a single global 5 cm grid. Cell sizes are strict whole multiples ($5\text{ cm} \to 10\text{ cm} \to 20\text{ cm} \to 50\text{ cm}$). A coarse cell corresponds exactly to an integer block of fine cells ($2\times2$ or $5\times5$), guaranteeing mathematical continuity with zero seam tearing across boundaries."
* **Q3: "How do you distinguish a dynamic vehicle from a parked vehicle?"**  
  * *Answer:* "We apply ego-motion compensation via odometry (KISS-ICP / FAST-LIO2) first, followed by temporal multi-frame differencing and semantic class gating. A stationary car remains in the static elevation layer with zero velocity variance; a moving car is tracked in the dynamic entity layer with an active Kalman state vector."
* **Q4: "What is your mIoU on off-road terrain?"**  
  * *Answer:* "On the challenging RELLIS-3D benchmark, state-of-the-art models reach approximately $43\%\text{ mIoU}$. We do not overclaim $95\%$ accuracy on off-road terrain. We report validated distance-binned mIoU ($0\text{–}10\text{ m}$, $10\text{–}30\text{ m}$, $30\text{–}60\text{ m}$) and back it up with geometric roughness variance."
