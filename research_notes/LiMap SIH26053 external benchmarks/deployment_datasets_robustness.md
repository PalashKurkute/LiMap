# Deployment Expectations, Indian/Off-road Datasets, and Robustness/Defence Evaluation Norms (DRDO UGV LiDAR 2.5D mapping)

Research date: 2026-10-03. Scope: what "deployable" means for a Jetson + ROS 2 + Nav2 LiDAR 2.5D mapper; which Indian / off-road / adverse-weather datasets exist; how degraded-sensor robustness and defence evaluation are normally framed. Several primary pages failed to load (ros.org REPs blocked by an anti-bot page, the Nav2 costmap-plugin tutorial URL returned 404, MDPI returned 403), so some claims are flagged as unverified and placed under Gaps.

## Q1. Jetson Orin latency for range-image LiDAR segmentation and GPU elevation mapping (elevation_mapping_cupy / nvblox)

### Takeaway
Published, like-for-like Jetson Orin TensorRT latencies for SalsaNext / RangeNet++ / CENet / FRNet are scarce. Most papers report desktop-GPU FPS (for example CENet at 37.8 FPS for 64x2048 input on an RTX 3060/3090) and give Jetson numbers only for their own model (for example DS-RangeNet at 37 ms end-to-end on AGX Orin). A credible "deployable" claim should therefore come from the project's own measurements: fix the power mode, JetPack/TensorRT version and precision, and report the p50/p95 latency of the full pipeline. elevation_mapping_cupy has a community ROS 2 port that runs on Jetson Orin, but no official latency figures. nvblox ESDF timings are resolution-dependent (about 3 to 13 ms per frame in one study).

### Cited Findings
- **CENet, desktop GPU (RTX 3060/3090):** 84.9 FPS / 60.7% mIoU at 64x512 input, 67.9 FPS / 62.3% at 64x1024, and 37.8 FPS / 64.7% at 64x2048. In the same table, SalsaNext reaches 24 FPS / 62.1% at 64x2048, and RangeNet++ reaches 38.5 FPS (64x512), 23.3 FPS (64x1024) and 12.8 FPS / 52.2% (64x2048). These are SemanticKITTI numbers, not Jetson numbers. — [CENet paper (arXiv 2207.12691)](https://arxiv.org/html/2207.12691v1)
- **DS-RangeNet (2026, MDPI Electronics):** 73.2% mIoU, 5.69 M parameters and 37 ms end-to-end latency on a Jetson AGX Orin. It is benchmarked against SalsaNext (54.26 mIoU), RangeNet++ DN21 (60.12), RangeNet++ DN53 (63.63) and CENet (64.06) on an industrial indoor set (UBPC-9). Inference was measured on an RTX 4090 and on an AGX Orin (2048-core Ampere GPU, 12-core Cortex-A78AE). Per-baseline Orin latencies, TensorRT use and power mode could not be read because the page returned 403. — [DS-RangeNet, Electronics 15(17):3983](https://doi.org/10.3390/electronics15173983) (search snippet only)
- **Range-aware LaserNet (RangeSeg) on the older Jetson AGX Xavier:** about 19 Hz with TensorRT FP16. Model time was 13.75 ms ± 0.26 ms, including encoding and post-processing. — [RangeSeg (arXiv 2205.01570)](https://arxiv.org/pdf/2205.01570) (via search snippet)
- **HARP-NeXt (2025):** a range-point fusion network that benchmarks on Jetson AGX Orin and compares against CENet, SalsaNext and others. The Orin figures are embedded as an image ("nuscenes_orin" figure), so the numbers could not be extracted. — [HARP-NeXt (arXiv 2510.06876)](https://arxiv.org/pdf/2510.06876)
- **Generic segmentation reference on AGX Orin:** SegFormer-B0 FP16 at 103.61 FPS, p95 latency 9.441 ms. This is a camera model and only an order-of-magnitude reference. The study used external-power-referenced measurement, a good practice to copy. — [AgriJetsonBench (arXiv 2608.00927)](https://arxiv.org/html/2608.00927v1)
- **Orin Nano example:** a user reported 240 to 260 ms latency for image segmentation through the Isaac ROS TensorRT node on an Orin Nano 8GB. This shows that ROS-node overhead and model choice can dominate. — [isaac_ros_dnn_inference issue #57](https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_dnn_inference/issues/57)
- **elevation_mapping_cupy, ROS 2 port (iit-DLSLab):**
  - Supports ROS 2 Humble/Jazzy, CUDA 12.1+ and Python 3.10, on x64 and on ARM for Jetson Orin boards.
  - Example configuration: 8.0 m map length, 0.04 m resolution, 202 cells.
  - Publishes grid_map messages (for example `/elevation_mapping_node/elevation_map_raw`).
  - MIT license.
  - No latency numbers or exact JetPack version are given.
  - [elevation_mapping_gpu_ros2](https://github.com/iit-DLSLab/elevation_mapping_gpu_ros2)
- **Official elevation_mapping_cupy:** installs CuPy from source on Jetson Orin. The upstream issue tracker has an open report of gradual FPS degradation on an AGX Orin with a Livox MID360. — [Installation docs](https://leggedrobotics.github.io/elevation_mapping_cupy/getting_started/installation.html); [issues](https://github.com/leggedrobotics/elevation_mapping_cupy/issues)
- **nvblox ESDF (cuRoboV2 comparison):** 12.68 ms per frame at 10 mm TSDF resolution with full workspace coverage, and 2.97 ms at 20 mm. ESDF is about 94% of nvblox's processing time. Note that this is a manipulation-scale workspace, not outdoor UGV scale. — [cuRoboV2 (arXiv 2603.05493)](https://arxiv.org/pdf/2603.05493)
- **Vendor benchmark reference:** NVIDIA's official Jetson benchmark page lists per-model TensorRT throughput per Orin module. It contains no LiDAR range-view models. — [Jetson Benchmarks](https://developer.nvidia.com/embedded/jetson-benchmarks)
- **nvblox deployment example:** an end-to-end recipe exists for running nvblox with an Orbbec depth camera on an AGX Orin. — [Seeed wiki](https://wiki.seeedstudio.com/deploy_nvblox_jetson_agx_orin/)

### Inferences
- **Speed headroom:** a range-view network that runs at 38 to 85 FPS on an RTX 3060/3090 will likely run several times slower on an AGX Orin and slower again on an Orin NX or Nano. FP16/INT8 TensorRT plus a reduced input width (64x512 or 64x1024) is the usual lever. Even at a 3 to 5x slowdown, CENet at 64x1024 would likely still exceed a 10 Hz LiDAR rate on an AGX Orin. This is an estimate, not measured.
- **Reporting:** reviewers will expect reporting in the style of DS-RangeNet and AgriJetsonBench:
  - device and memory;
  - JetPack/TensorRT version;
  - nvpmodel power mode, for example MAXN vs 15/25/30 W;
  - precision;
  - end-to-end latency (pre-processing + inference + projection + map fusion);
  - p95 latency, not just the mean.
- **Integration choice:** elevation_mapping_cupy is the most direct off-the-shelf 2.5D baseline on Jetson with ROS 2. Its grid_map output must still be bridged to Nav2 (see Q2).

### Gaps
- No verified Jetson Orin TensorRT latencies were found for SalsaNext, RangeNet++, CENet or FRNet individually. The FRNet paper and the HARP-NeXt Orin figure could not be parsed.
- No official elevation_mapping_cupy or nvblox latency was found for outdoor LiDAR-scale maps on Orin NX or Nano. Specific JetPack (5.x vs 6.x) and TensorRT (8.5/8.6/10.x) compatibility was not verified.
- Power-mode-specific figures (for example Orin NX 10 W/15 W/25 W) were not found for any of these models.

## Q2. ROS 2 Nav2 integration conventions: how a third-party mapper should publish to Nav2

### Takeaway
There are two standard routes into Nav2:
1. **Simple route:** publish a `nav_msgs/OccupancyGrid` and consume it through `nav2_costmap_2d::StaticLayer`, which accepts updates.
2. **Proper route:** write a C++ pluginlib costmap layer, a subclass of `nav2_costmap_2d::Layer` / `CostmapLayer` with `updateBounds` / `updateCosts`, that writes Nav2 cost values (0 free, 253 inscribed, 254 lethal, 255 unknown) into a rolling-window local costmap in the `odom` frame.

Separately, OccupancyGrid uses -1/0..100 and is converted to costs using thresholds.

### Cited Findings
- **Cost constants:** `FREE_SPACE = 0`, `INSCRIBED_INFLATED_OBSTACLE = 253`, `LETHAL_OBSTACLE = 254`, `NO_INFORMATION = 255`. — [nav2_costmap_2d cost_values.hpp](https://github.com/ros-planning/navigation2/blob/0513db1cf94481958d43ac4e3d15100f2c91c245/nav2_costmap_2d/include/nav2_costmap_2d/cost_values.hpp)
- **Cost range meaning:** cells store costs from 0 to 254. 0 is free and 254 is lethal. Intermediate values act like a potential field that steers the robot away from obstacles. — [Nav2 Mapping & Localization guide](https://docs.nav2.org/rolling/configuration_and_development/first_time_robot_setup_guide/sensors/mapping_localization/) (via search snippet)
- **Costmap parameters and defaults:**
  - Frames and geometry: `global_frame` = `map`, `robot_base_frame` = `base_link`, `rolling_window` = false, `width`/`height` = 5 m, `resolution` = 0.1 m.
  - OccupancyGrid conversion: `lethal_cost_threshold` = 100 (minimum occupancy value treated as lethal), `unknown_cost_value` = 255, `inscribed_obstacle_cost_value` = 99, `trinary_costmap` = true, `track_unknown_space` = false.
  - Default plugins: `StaticLayer`, `ObstacleLayer`, `InflationLayer`.
  - StaticLayer: `map_subscribe_transient_local` = True, `subscribe_to_updates` = true.
  - `filters` (keepout and speed filters) are applied after the layers.
  - [Nav2 Costmap 2D configuration (lyrical)](https://docs.nav2.org/lyrical/configuration_and_development/configuration_guide/core_servers/costmap_2d/)
- **Frames and TF:**
  - The `map` => `odom` transform is "one of the primary requirements of the Nav2 system". SLAM or localization publishes it, odometry publishes `odom` => `base_link`, and robot_state_publisher publishes `base_link` => sensor frames.
  - The global costmap uses the `map` frame (long-term planning). The local costmap uses `odom` (short-term planning and collision avoidance).
  - Obstacle and voxel layers consume `LaserScan` or `PointCloud2` through `observation_sources`. The static layer consumes `/map`.
  - [Nav2 Mapping & Localization guide](https://docs.nav2.org/rolling/configuration_and_development/first_time_robot_setup_guide/sensors/mapping_localization/)
- **grid_map in ROS 2:**
  - grid_map is tested on ROS 2 Humble (Ubuntu 22.04) and provides conversions to and from OccupancyGrid, costmap_2d, PCL and OctoMap types.
  - `GridMapRosConverter::toOccupancyGrid` writes one chosen layer as the OccupancyGrid data and drops the other layers.
  - [ANYbotics/grid_map](https://github.com/ANYbotics/grid_map); [GridMapRosConverter (Humble API)](https://docs.ros.org/en/ros2_packages/humble/api/grid_map_ros/generated/classgrid__map_1_1GridMapRosConverter.html); [grid_map ROS 2 branch](https://github.com/ANYbotics/grid_map/tree/ros2)
- **Smac Hybrid-A\*:** a cost-aware planner whose motion primitives are sized to leave a costmap cell. It supports Ackermann, car-like and legged robots. — [Smac Hybrid-A* docs](https://navigation.ros.org/configuration/packages/smac/configuring-smac-hybrid.html); [Smac README](https://github.com/ros-navigation/navigation2/blob/main/nav2_smac_planner/README.md)
- **Prior traversability integrations with Nav2 (academic):**
  - A traversable-terrain PointCloud2 representation feeding a custom costmap plugin.
  - Elevation-map-based traversability added on the fly to the Nav2 environment map, plus Hybrid-A*-guided MPPI work for uneven terrain.
  - A real-time local costmap update method for agricultural Nav2 use.
  - [2.5D Mapping, Pathfinding and Path Following... Uneven Terrain (arXiv 2209.07252)](https://arxiv.org/pdf/2209.07252); [Real-Time Local Costmap Updates for Agricultural Applications (arXiv 2407.18535)](https://arxiv.org/pdf/2407.18535)
- **Existing bridge tools:** `pointcloud_to_grid` is a ROS 1/ROS 2 node that converts PointCloud2 to OccupancyGrid by height and/or intensity. — [jkk-research/pointcloud_to_grid](https://github.com/jkk-research/pointcloud_to_grid)

### Inferences
- **Recommended publishing contract for a third-party 2.5D mapper:**
  - (a) Publish `grid_map_msgs/GridMap` with elevation, traversability and semantic layers for richer consumers.
  - (b) Publish a `nav_msgs/OccupancyGrid` (traversability mapped to 0..100, unknown as -1) in the `odom` frame for the rolling local costmap, and optionally in `map` for global use.
  - (c) Ideally, ship a C++ costmap layer plugin that subscribes to the grid and writes 0..254/255 directly. This avoids OccupancyGrid quantisation and the `trinary_costmap` default that collapses graded costs.
  - (d) Rely on TF2 and REP 105 for `map` -> `odom` -> `base_link` -> `lidar`, with time-stamped PointCloud2 input.
- **trinary_costmap pitfall:** if the OccupancyGrid + StaticLayer route is used for graded traversability, set `trinary_costmap: false`. Otherwise, intermediate costs become free/lethal only.
- **Planner pairing:** Smac Hybrid-A* (global) plus MPPI (local) is the natural pairing for a non-holonomic tracked or wheeled UGV, consuming graded costs.

### Gaps
- **Plugin tutorial not loaded:** the Nav2 "Writing a New Costmap2D Plugin" tutorial URL returned 404. The method names (`onInitialize`, `updateBounds`, `updateCosts`, `matchSize`, `reset`, `isClearable`) and `PLUGINLIB_EXPORT_CLASS` registration are from prior knowledge and not re-verified here.
- **REP 103 and REP 105 not fetched:** ros.org returned an anti-bot block.
  - REP 103 (SI units; x forward, y left, z up; ENU) is not cited directly here.
  - REP 105's statement that `odom` is continuous but drifts while `map` is discontinuous but globally consistent is also not cited directly here.
  - The Nav2 page above is the only cited source for frames.
- **MPPI not documented here:** MPPI controller parameters and its critics' use of costmap costs were not fetched.

## Q3. Indian datasets and off-road LiDAR datasets (with licenses)

### Takeaway
- **IDD-3D (IIIT Hyderabad, WACV 2023)** is the main Indian LiDAR dataset. It provides 3D box annotations only, not point-wise semantic labels, which limits direct use for traversability segmentation.
- **Open-ish off-road LiDAR semantic sets:** RELLIS-3D (CC BY-NC-SA 3.0), GOOSE (CC BY-SA 4.0) and WildScenes (reported as CC BY-NC 4.0).
- **Licenses not verified:** ORFD and TartanDrive.
- **No Indian off-road LiDAR semantic dataset was found.**

### Cited Findings
- **IDD-3D at a glance:**
  - About 12k annotated LiDAR frames from more than 5 hours of driving in various regions of Hyderabad.
  - Six cameras and one Ouster OS1 LiDAR.
  - 3D bounding boxes for about 223k objects in 17 categories: vehicle types, pedestrian, rider types (motorcycle, scooter), bicycles, animals.
  - Annotated with SUSTech POINTS.
  - Toolkit at [github.com/shubham1810/idd3d_kit](https://github.com/shubham1810/idd3d_kit).
  - [IDD-3D arXiv 2210.12878](https://arxiv.org/abs/2210.12878); [WACV 2023 paper](https://openaccess.thecvf.com/content/WACV2023/papers/Dokania_IDD-3D_Indian_Driving_Dataset_for_3D_Unstructured_Road_Scenes_WACV_2023_paper.pdf)
- **IDD-3D license:** the project website states "This website is licensed under a Creative Commons Attribution-ShareAlike 4.0 International" license. No separate dataset license or access form was visible on that page. — [idd3d.github.io](https://idd3d.github.io/)
- **RELLIS-3D:**
  - 13,556 annotated LiDAR scans.
  - Ouster OS1-64 and Velodyne Ultra Puck (32-channel).
  - 20-class off-road ontology: grass, trees, bush, mud, puddle, deep water, concrete, barrier, vehicle, building and others.
  - License: "All datasets and code on this page are copyright by us and published under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 License."
  - [RELLIS-3D GitHub](https://github.com/unmannedlab/RELLIS-3D)
- **GOOSE (German Outdoor and Offroad Dataset):**
  - About 15,000 image and point-cloud frames with point-wise annotations from multiple LiDARs, plus RGB and NIR.
  - Platforms: MuCar-v3, Alice and Spot. GOOSE-Ex (October 2024) adds excavator and legged-robot data.
  - License: CC BY-SA 4.0, which allows commercial use.
  - [goose-dataset.de](https://goose-dataset.de/); [GOOSE paper (arXiv 2310.16788)](https://arxiv.org/pdf/2310.16788)
- **Comparison table from the ORAD-3D paper:**

  | Dataset | Platform | LiDAR | Frames |
  |---|---|---|---|
  | WildScenes | handheld | 16-channel | 9.3k camera / 12.1k LiDAR |
  | ORFD | vehicle | 40-channel | 12.2k |
  | GOOSE | vehicle | 128-channel | 10.0k |
  | TartanDrive 2.0 | vehicle | 32/70-channel | 250k |
  | RELLIS-3D | robot | 64-channel | 6.2k camera / 13.6k LiDAR |

  — [ORAD-3D (arXiv 2510.16500)](https://arxiv.org/pdf/2510.16500)
- **WildScenes:** large-scale natural-environment 2D/3D semantic benchmark (IJRR 2025), reported under CC BY-NC 4.0 (search-snippet level). — [WildScenes IJRR](https://dl.acm.org/doi/10.1177/02783649241278369); [arXiv 2312.15364](https://arxiv.org/html/2312.15364v1)
- **Newer off-road datasets surfaced:** ORAD-3D (large-scale off-road), TOMD (trail-based, low illumination) and ROVER (multi-season). — [ORAD-3D](https://arxiv.org/pdf/2510.16500); [TOMD](https://arxiv.org/html/2506.21630); [ROVER](https://arxiv.org/pdf/2412.02506)
- **DRDO itself lists dataset generation as a UGV need:** its UGV technology-foresight page lists "dataset generation and simulation validation" as supporting infrastructure, alongside AI-based perception and SLAM for field/outdoor conditions. This implies a recognised lack of indigenous datasets. — [DRDO Technology Foresight: UGV](https://drdo.gov.in/drdo/en/offerings/technology-foresight/ugv)

### Inferences
- **Recommended data strategy:**
  - Use RELLIS-3D and GOOSE (point-wise, off-road) for training terrain and traversability classes.
  - Use IDD-3D only for Indian-road domain-shift and object-presence evaluation, since it has no point-wise semantics.
  - Build a small self-collected Indian off-road set for validation; DRDO itself flags dataset generation as a need.
- **Use GOOSE for commercial paths:** it is the most permissive licence for a commercial or iDEX path (CC BY-SA 4.0). RELLIS-3D and WildScenes are non-commercial.

### Gaps
- **ORFD and TartanDrive (1.0/2.0) licenses** were not verified.
- **IDD-3D's actual dataset terms** (as distinct from the website licence) and its download procedure were not confirmed. The 2D IDD from IIIT-H historically required registration (unverified here).
- **No Indian LiDAR semantic-segmentation or off-road dataset** from IIT, IISc or DRDO was found in this search pass. That does not prove none exists.
- **RUGD** (camera-only off-road) details and licence were not fetched.

## Q4. Adverse-weather / degraded-LiDAR datasets, simulation, and robustness benchmarks

### Takeaway
- **Real adverse-weather semantic data:** SemanticSTF (fog, snow, rain; 21 classes; 2,076 scans) and WADS (snow; about 1.3k frames). CADC has snow data but only 3D boxes.
- **Physics-based simulation:** Hahner et al.'s fog (ICCV 2021) and snowfall (CVPR 2022) simulators.
- **Standard robustness protocol:** Robo3D / SemanticKITTI-C, with 8 corruptions x 3 severities, reported as mCE (lower is better) and mRR (higher is better).
- **Dust:** no dedicated, well-known LiDAR dust semantic dataset was verified in this pass.

### Cited Findings
- **SemanticSTF:**
  - Point-wise labels for 21 classes.
  - 2,076 densely annotated scans: 694 snow, 637 dense fog, 631 light fog, 114 rain.
  - Built from the Seeing Through Fog (STF) dataset.
  - [3D Semantic Segmentation in the Wild (arXiv 2304.00690)](https://ar5iv.labs.arxiv.org/html/2304.00690); [TripleMixer (arXiv 2408.13802)](https://arxiv.org/html/2408.13802v1)
- **WADS:** about 1,300 LiDAR frames over 20 sequences, mostly snowy urban driving, with point-wise semantic labels. — [TripleMixer](https://arxiv.org/html/2408.13802v1)
- **CADC:** 3D bounding boxes for LiDAR in snowy conditions; no point-wise semantics. — [TripleMixer](https://arxiv.org/html/2408.13802v1)
- **SemanticSpray / SemanticSpray++:** a wet-surface / spray multimodal dataset, relevant to splash and water-crossing degradation. — [SemanticSpray++ (arXiv 2406.09945)](https://arxiv.org/pdf/2406.09945)
- **Hahner et al. simulators:**
  - "Fog Simulation on Real LiDAR Point Clouds for 3D Object Detection in Adverse Weather" (ICCV 2021). Code: [MartinHahner/LiDAR_fog_sim](https://github.com/MartinHahner/LiDAR_fog_sim).
  - "LiDAR Snowfall Simulation for Robust 3D Object Detection" (CVPR 2022, oral).
  - Later pipelines (FSRL, LSS, LiSA) apply Beer–Lambert and Mie scattering.
  - [Rethinking Data Augmentation for Robust LiDAR Segmentation in Adverse Weather (arXiv 2407.02286)](https://arxiv.org/html/2407.02286v1)
- **Robo3D:**
  - Eight corruptions in three groups: severe weather (fog, wet ground, snow); external disturbances (motion blur, beam missing); internal sensor failure (crosstalk, incomplete echo, cross-sensor).
  - Three severity levels each.
  - SemanticKITTI-C is built from the SemanticKITTI validation set.
  - Metrics: mean Corruption Error (mCE) and mean Resilience Rate (mRR).
  - Per-model results, including RangeNet and WaffleIron, are in the repo.
  - [Robo3D ICCV 2023](https://openaccess.thecvf.com/content/ICCV2023/papers/Kong_Robo3D_Towards_Robust_and_Reliable_3D_Perception_against_Corruptions_ICCV_2023_paper.pdf); [arXiv 2303.17597](https://arxiv.org/html/2303.17597v4); [Robo3D results](https://github.com/worldbench/Robo3D/blob/main/docs/results/RangeNet-dark21.md)
- **Other robustness work:**
  - An earlier robustness benchmark for LiDAR semantic segmentation models: [arXiv 2301.00970](https://arxiv.org/pdf/2301.00970).
  - Range-view-specific adverse-weather generalisation work (2025): [arXiv 2506.08979](https://arxiv.org/pdf/2506.08979).
  - A 2026 study on deployment-oriented evaluation under coarse labels, adverse conditions and domain shift: [arXiv 2609.02830](https://arxiv.org/pdf/2609.02830).
- **Snowfall performance study:** LiDAR performance under snowfall has been studied in IEEE T-ITS 2024. — [Understanding LiDAR Performance Under Snowfall](https://dl.acm.org/doi/abs/10.1109/TITS.2024.3409907)

### Inferences
- **Reviewer-expected robustness protocol:**
  - (1) Clean mIoU on the source dataset.
  - (2) Robo3D-style corruptions at 3 severities with mCE/mRR. Add map-level metrics: elevation RMSE, traversability-cell accuracy, false-lethal and false-free rates.
  - (3) A real adverse set (SemanticSTF / WADS) for sim-to-real sanity.
  - (4) Explicit dust and smoke tests. Dust is the dominant Indian desert/off-road degradation, but snow-centric benchmarks do not cover it. Robo3D's "beam missing", "incomplete echo" and "crosstalk", plus fog-sim with modified particle parameters, are the closest proxies (inference).
- **Map-level metrics matter more than raw mIoU for a 2.5D mapper.** Temporal fusion in the elevation map can mask per-frame segmentation errors, so robustness should be reported at both levels.

### Gaps
- No specific public LiDAR dust/smoke dataset was verified in this pass. Unverified candidates from prior knowledge: CSIRO dust/smoke datasets and a mining dust set; these need confirmation.
- Boreas details (multi-season, Toronto; licence) were not fetched.
- SemanticSTF and WADS licences were not verified.

## Q5. Defence/military evaluation expectations, Indian programmes, iDEX, safety standards, and licensing

### Takeaway
- **Indian requirement documents are not public.** DRDO's public UGV pages list capability areas (AI perception, field SLAM, autonomous navigation, swarms, unmanned combat vehicles) without performance figures. Defence-grade "deployability" is therefore usually argued through analogous standards:
  - MIL-STD-810H environmental testing;
  - NATO AEP-4818 RAS-G IOP for ground-robot interoperability (STANAG 4586 is UAV-only);
  - ISO 21448 SOTIF for perception-limitation analysis.
- **iDEX** is the realistic funding and engagement path for a student team: up to ₹1.5 crore milestone-based grants, open to individual innovators and academia.
- **Non-commercial dataset licences** (RELLIS-3D, WildScenes, likely SemanticKITTI) constrain commercial or defence-procurement use of trained weights.

### Cited Findings
- **MUNTRA (CVRDE):** converts BMP-class vehicles into teleoperated and autonomous vehicles. It is DRDO's first unmanned tracked vehicle, with electro-optics, sensor fusion, electro-mechanical actuators, communications, and indigenous GIS for mission planning and path recording. — [GlobalSecurity: Muntra](https://www.globalsecurity.org/military/world/india/muntra.htm) (secondary source)
- **Daksh:** an electrically powered, remotely controlled robot for locating, handling and destroying hazardous objects (a teleoperated EOD robot, not autonomous navigation). — [DRDO Daksh (Wikipedia)](https://en.wikipedia.org/wiki/DRDO_Daksh) (secondary source)
- **DRDO UGV technology foresight:**
  - Listed items: "AI based Controls / Navigation / Perception for Autonomous Driving", "AI based SLAM for field/outdoor conditions", dataset generation and simulation validation, drive-by-wire for AFVs, "Troop level Swarm Unmanned Ground Vehicles" and "Unmanned Combat Vehicle".
  - Labs involved: VRDE, CVRDE, CAIR, DGRE.
  - No performance metrics or GPS-denied requirements are stated.
  - [DRDO Technology Foresight: UGV](https://drdo.gov.in/drdo/en/offerings/technology-foresight/ugv); [Autonomous Systems & Robotics](https://drdo.gov.in/drdo/en/offerings/technology-foresight/autonomous-systems-and-robotics)
- **CAIR:** works on autonomous navigation for unmanned ground combat vehicles, autonomous environment perception for obstacle avoidance, and autonomous path planning. — [CAIR (Wikipedia)](https://en.wikipedia.org/wiki/Centre_for_Artificial_Intelligence_and_Robotics) (secondary source)
- **iDEX:**
  - DISC and Open Challenge winners can get grant-in-aid (SPARK) of up to ₹1.5 crore, milestone-based. It is neither equity nor a loan, and the startup retains its IP.
  - Open to DPIIT-recognised startups, MSMEs, individual innovators, R&D institutes and academia with majority Indian ownership.
  - An iDEX Open Challenge 2026 window (deadline 30 Sept) was reported by an aggregator.
  - [iDEX FAQ (official)](https://idex.gov.in/faq); [StartupGrantsIndia aggregator](https://www.startupgrantsindia.com/idex-open-challenge) (aggregator, verify on idex.gov.in)
- **STANAG 4586** is the NATO UAV control-system (UCS) interoperability standard. It covers architectures, data link, C2 and HCI message formats for UAVs, not ground robots. — [STANAG 4586 (Wikipedia)](https://en.wikipedia.org/wiki/STANAG_4586); [NATO STO EN-SCI-271](https://publications.sto.nato.int/publications/STO%20Educational%20Notes/STO-EN-SCI-271/EN-SCI-271-03.pdf)
- **NATO AEP-4818** is the Robotics and Autonomous Systems – Ground (RAS-G) Interoperability Profile (IOP). Volumes (for example Vol I overarching, Vol VII appliqué profiling rules) are NATO RESTRICTED. — [AEP-4818 Vol I](https://standards.globalspec.com/std/14589990/aep-4818-vol-i); [AEP-4818 Vol VII](https://standards.globalspec.com/std/14589980/aep-4818-vol-vii); [DTIC unmanned systems interoperability standards](https://apps.dtic.mil/sti/trecms/pdf/AD1060226.pdf)
- **MIL-STD-810H** (2019, succeeded 810G) defines environmental test methods: temperature extremes, humidity, vibration, shock, sand and dust. It applies to ground vehicles and electronics and remains the active benchmark as of 2026. — [MIL-STD-810 (Wikipedia)](https://en.wikipedia.org/wiki/MIL-STD-810); [MIL-STD-810H PDF](https://cvgstrategy.com/wp-content/uploads/2019/03/MIL-STD-810H.pdf)
- **ISO 21448 (SOTIF)** addresses hazards from functional insufficiencies and triggering conditions rather than faults, for example sensor misinterpretation in fog or snow. It covers analysing performance limitations and validating across real-world conditions. — [SwiftNav SOTIF glossary](https://www.swiftnav.com/glossary/what-is-iso-21448-sotif); [TÜV SÜD SOTIF whitepaper](https://www.tuvsud.com/-/jssmedia/global/pdf-files/whitepaper-report-e-books/tuvsud-sotif.pdf); [Perception triggering-condition discovery (arXiv 2303.04037)](https://arxiv.org/pdf/2303.04037)
- **CC BY-NC-SA 4.0 licence terms:** reuse for non-commercial purposes only, with attribution, and adaptations must be shared alike. CC NC licences are considered non-free. — [CC BY-NC-SA 4.0 legal code](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en); [Wikipedia: CC NonCommercial](https://en.wikipedia.org/wiki/Creative_Commons_NonCommercial_license)

### Inferences
- **Defence reviewers are likely to probe:**
  - (a) GNSS-denied operation: the mapper should rely only on LiDAR/IMU odometry and the odom frame, which the Nav2 odom-frame local costmap already supports.
  - (b) Behaviour under dust, smoke, rain and night, framed as SOTIF triggering conditions with a documented "known unsafe" scenario list.
  - (c) Hardware ruggedness pathway: MIL-STD-810H methods for sand/dust, vibration and temperature on the Jetson enclosure and LiDAR.
  - (d) Interoperability: exposing standard ROS 2 messages is the practical analogue. AEP-4818 is restricted and NATO-specific, and India is not a NATO member, so it is useful only as a reference concept (inference).
- **ISO 26262 vs SOTIF:** ISO 26262 (functional safety of road vehicles) is less directly applicable to an off-road military UGV than SOTIF's triggering-condition methodology. Both are automotive standards cited by analogy.
- **Licensing:** for an iDEX or commercial path, models trained on CC BY-NC(-SA) data (RELLIS-3D, WildScenes and likely SemanticKITTI) carry non-commercial risk. GOOSE (CC BY-SA 4.0), IDD-3D (if CC BY-SA 4.0 applies to the data) and self-collected data are safer.

### Gaps
- **SemanticKITTI's exact licence** was not confirmed from semantic-kitti.org; the page fetched did not show it. CC BY-NC-SA 4.0 is the commonly cited licence (unverified here).
- **"STANAG 4817"** could not be confirmed as a UGV standard; no source found. The relevant NATO ground-robot document is AEP-4818 (RAS-G IOP).
- **No public DRDO, CVRDE or CAIR performance specifications** were found for UGV perception: mapping resolution, latency, GNSS-denied accuracy, or JSS 55555 (Indian environmental test standard; prior knowledge, not verified).
- **Current Muntra/Daksh variant status** and any newer DRDO UGV programmes were not verified from official DRDO pages. The cited Muntra and Daksh descriptions are secondary.
- **iDEX student eligibility:** whether undergraduate teams without a DPIIT-registered entity can be grant recipients needs confirmation on idex.gov.in. The FAQ was surfaced, but its full text was not fetched.
