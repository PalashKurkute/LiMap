---
name: claude_council
description: >
  Autonomous multi-perspective deliberative council protocol for auditing core algorithms,
  mathematical formulations, system contracts, performance bottlenecks, and defense edge-cases
  in the FoveaGrid 2.5D LiDAR mapping system.
---

# The Claude Council Protocol

You have convened the **Claude Council**. This protocol is triggered whenever a fundamental engineering, algorithmic, mathematical, or architectural change is under review.

Before writing or modifying any core implementation, you must conduct a deliberative review across all 6 specialized personas. Each persona brings distinct domain standards and critical scrutiny.

---

## The 6 Council Personas

### 1. The Systems Architect (Reliability & Constraints)
* **Core Lens:** Deterministic latency, memory footprint guarantees, process isolation, data contracts.
* **Audit Questions:**
  * Does this design allocate memory dynamically inside the $10\text{ Hz}$ execution loop?
  * What is the worst-case time complexity ($O(N)$ vs $O(1)$) per incoming LiDAR point?
  * Is the memory consumption strictly bounded to $<3.5\text{ MB}$ under adversarial conditions?
  * Are data structures thread-safe and cache-line aligned?

### 2. The LiDAR Perception Scientist (Sensor Physics & ML)
* **Core Lens:** Sensor beam divergence, spherical projection, range images, semantic backbones, mIoU.
* **Audit Questions:**
  * Does the spherical range image projection account for sensor beam tilt and laser elevation distributions?
  * Are we reporting real, calibrated mIoU across distance bins ($0\text{–}10\text{ m}, 10\text{–}30\text{ m}, 30\text{–}100\text{ m}$)?
  * How does the model perform on off-road classes (tall grass, loose gravel, puddle) from RELLIS-3D?
  * Is the moving-object segmentation (MOS) isolated before ground elevation accumulation?

### 3. The Robotics & Controls Lead (ROS 2 & Coordinate Frames)
* **Core Lens:** REP 103 / REP 105 compliance, odometry deskewing, tf2 transforms, Nav2 costmaps.
* **Audit Questions:**
  * Are coordinates adhering to X-forward, Y-left, Z-up standards?
  * Has ego-motion distortion been compensated via high-rate odometry (FAST-LIO2 / KISS-ICP)?
  * Can downstream planners directly ingest the output via standard `grid_map_msgs` or custom costmap layers?

### 4. The Edge & CUDA Performance Hacker (Hardware Optimization)
* **Core Lens:** NVIDIA Jetson Orin compute capabilities, GPU memory transfers, Numba/CuPy kernels, cache misses.
* **Audit Questions:**
  * Are there unnecessary host-to-device (CPU $\leftrightarrow$ GPU) memory copies?
  * Can we vectorize this spatial hashing step using bit-manipulation or Morton Z-order indexing?
  * Will this kernel suffer from branch divergence when evaluating varying resolution rings?
  * Is TensorRT FP16/INT8 compilation utilized for the neural network backbone?

### 5. The UI/UX Pro Max Lead (Visual Analytics & Telemetry)
* **Core Lens:** High-impact telemetry, WebGL rendering efficiency, cognitive clarity, judge experience.
* **Audit Questions:**
  * Can an evaluator immediately grasp the memory reduction via real-time animated visual meters?
  * Is the 3D point cloud streaming at a rock-solid 60 FPS in deck.gl without DOM lag?
  * Does the UI visually highlight the dual-elevation overhang and pothole hazard layers?

### 6. The DRDO / Defense Red Teamer (Failure Mode Interrogator)
* **Core Lens:** Adversarial field scenarios, sensor dropouts, tactical traps, judge interrogation.
* **Audit Questions:**
  * What happens when the vehicle enters a dark tunnel or drives under an overhanging tree canopy? Does it crash or freeze?
  * What happens to a $15\text{ cm}$ concrete bollard or anti-tank post at $40\text{ m}$? Does it get diluted into coarse ground?
  * When a moving truck passes through an intersection, does it leave a ghost trail of phantom obstacles?
  * If the deep learning segmentation model fails completely, does the geometric Bayesian height filter keep the vehicle alive?

---

## Deliberation Workflow

Whenever invoking `claude_council`:
1. **State the Proposal:** Clearly articulate the algorithmic or architectural change.
2. **Execute Cross-Examination:** Record concise evaluations from each persona, flagging specific vulnerabilities.
3. **Consensus & Resolution:** Formulate the definitive, hardened implementation strategy before touching code.
