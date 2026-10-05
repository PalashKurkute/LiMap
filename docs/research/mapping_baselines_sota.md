# State-of-the-art mapping baselines for an adaptive variable-resolution 2.5D LiDAR elevation map with dynamic object handling

Scope: the established systems, numbers and techniques an expert judge would compare a student "adaptive variable-resolution 2.5D LiDAR elevation map + dynamic object handling" project against. Research date: 2026-10-03. Primary sources (arXiv full text read via pdftotext, official GitHub repos/source code) were used wherever possible.

## Q1. ETH elevation_mapping / elevation_mapping_cupy and ANYbotics grid_map

### Takeaway
The de-facto baseline is ETH's GPU elevation_mapping_cupy (IROS 2022) plus its multi-modal extension MEM (IROS 2023), built on the grid_map library. At 10 x 10 m and 4 cm (250 x 250 cells) it runs a full update (Kalman height fusion, drift compensation, per-scan ray-cast visibility cleanup, traversability CNN, normals) in about 6.9 ms on a Jetson Xavier for about 43k LiDAR points, and about 23.6 ms on a Jetson Orin for 230k points. It runs at about 20 Hz for a Bpearl LiDAR and up to 49 Hz for downsampled depth. Any student project claiming "real-time", "dynamic clearing" or "traversability layers" will be measured against these numbers and features.

### Cited Findings
**elevation_mapping_cupy (Miki et al., "Elevation Mapping for Locomotion and Navigation using GPU", IROS 2022, arXiv 2204.12876)**
- Pipeline: point cloud plus pose go to GPU, are transformed to the map frame, and a height drift error is computed. The map is shifted to match the latest measurement, then the per-point height update runs. Ray casting in the same iteration removes "penetrated" objects and updates an upper-bound layer. Per-cell operations follow (overlap clearance, traversability, normals, optional filters). The map is copied to CPU only at a user-defined publish rate and published as a GridMap message. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Implementation: CuPy custom CUDA kernels with a Python API, so PyTorch networks share GPU memory. roscpp is used for publishing because rospy serialization is slow. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Height fusion is a 1D Kalman filter per cell, with h ← (σp²·h + σm²·pz)/(σm² + σp²) and σm² ← σm²σp²/(σm² + σp²). Point variance is σp² = σd·d², i.e. quadratic in range d, a simplification of the Nguyen et al. depth-noise model. Cell variance starts large. A constant time variance σt² is added at a fixed rate to cells that are not updated. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Outliers are rejected with a Mahalanobis-distance gate. For walls and vertical edges, if the point count in a cell exceeds a threshold, points lower than the current estimate are ignored, which sharpens edges. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Overhang/ceiling handling: an "exclusion area" (ramp parameters a, b, c, d) rejects points above a sloped line relative to the robot, so overhanging obstacles and ceilings are not baked into the 2.5D map, while sloped terrain is still captured. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Height drift compensation: for each point, compute the error between the measurement and the map, but only in cells with high traversability (flat areas). Then add the mean error to the whole elevation layer. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Visibility cleanup (dynamic obstacles): without it, old obstacles persist until their variance grows enough to pass the outlier gate. With it, for every point a ray from the sensor is stepped through the map. If a ray sample is below (cell height minus its std dev), the cell is "penetrated" and removed. To avoid jitter at grazing angles, removal additionally requires that the cell was not updated recently and that |r·n| > threshold (ray-vs-surface-normal check). This runs on every point cloud, unlike the CPU baseline, which ran it at a slower rate and left artifacts. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Upper-bound layer: ray casting also bounds the maximum possible ground height in unobserved cells (similar to "virtual surfaces"). This lets a planner distinguish benign occlusion holes (small upper-bound inclination) from dangerous drops (steep ray angles). This is directly relevant to negative-obstacle handling. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Overlap clearance for multi-floor scenes: near the robot, it clears heights that differ from the robot's height by more than a threshold. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Learning-based traversability: a simple CNN in PyTorch (from Wellhausen et al.) runs at the full map update rate on GPU. Post-processing options are inpainting (min along occlusion border), Gaussian/box/median smoothing, and plane segmentation into polygons for MPC. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Benchmark config: 10 x 10 m map at 4 cm resolution. Hardware: a desktop (Ryzen 9 3950X + RTX 2080 Ti) and an onboard Jetson Xavier. The CPU baseline (the original elevation_mapping) grew much more steeply with point count and "had a considerable delay on onboard PC (Jetson)". — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Table I, per-feature timing on Jetson Xavier with 43,017 Bpearl points: transform and z-error count 1.194 ms; drift compensation 0.742 ms; height update and ray casting 0.648 ms; overlap clearance 0.003 ms; traversability 4.102 ms; normals 0.168 ms; **total 6.857 ms**. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Table II, map update rates on Jetson Xavier (same 10 m / 4 cm map): Realsense filtered (6,276 pts) **49.4 Hz** vs 60 Hz sensor; Realsense raw (407,040 pts) **16.1 Hz**; Bpearl LiDAR (43,074 pts) **19.99 Hz** vs 20 Hz sensor, i.e. sensor-rate. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Field use: the system ran in the DARPA SubT Challenge final for local navigation (traversability plus upper-bound layers). It was used by an RL locomotion controller and by model-based controllers (TAMOLS, whole-body MPC). — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)

**MEM: Multi-Modal Elevation Mapping (Erni, Frey, Miki, Mattamala, Hutter; IROS 2023; arXiv 2309.16818)**
- MEM extends elevation_mapping_cupy with arbitrary multi-modal layers (semantics, RGB, visual features) from point clouds and images. Per-layer fusion algorithms are: latest, average, exponential averaging, Gaussian Bayesian inference, and Dirichlet Bayesian inference for class probabilities. A plugin system creates layers such as traversability, PCA of features, or vineyard line detection. — [arXiv 2309.16818](https://arxiv.org/pdf/2309.16818)
- Benchmark: 10 x 10 m grid at 4 cm (250 x 250 cells), with a 230,400-point cloud from a ZED 2i. Total update time is **2.596 ms on an RTX 4090 (≈385 Hz)** and **23.635 ms on a Jetson Orin (≈42 Hz)**. On Orin, "height update & ray cast" dominates at 17.5 ms, traversability takes 1.9 ms and the multi-modal update 1.5 ms. — [arXiv 2309.16818](https://arxiv.org/pdf/2309.16818)
- On Orin, time scales linearly with the number of semantic layers. With 20 layers the total is 28.9 ms (exponential averaging) and 29.0 ms (Bayesian). Sensors in that paper: VLP-16 at 300k points / 1 Hz; depth cameras at 407k points / 15 Hz. — [arXiv 2309.16818](https://arxiv.org/pdf/2309.16818)

**Repo status (leggedrobotics/elevation_mapping_cupy)**
- The license is MIT. Features listed: height drift compensation, visibility cleanup via raycasting and exclusion zones, learning-based traversability filter, smoothing, plane segmentation, and multi-modal (geometry, semantics, RGB) layers. — [GitHub](https://github.com/leggedrobotics/elevation_mapping_cupy)
- ROS version: the default `main` branch is ROS 1. Its package.xml uses catkin, and the README uses `catkin build` / `roslaunch`. Its last main commit was 2025-05-14. ROS 2 lives on branches `ros2`, `ros2_cpp`, and `release/jazzy` (last commit 2026-05-12), plus `ptz_jazzy` and `dev/jj/g1/ros2_humble`. The repo had about 1.1k stars and was last pushed 2026-09-20 (queried via GitHub API on 2026-10-03). — [GitHub API: elevation_mapping_cupy](https://github.com/leggedrobotics/elevation_mapping_cupy)

**Original CPU elevation_mapping (ANYbotics/elevation_mapping)**
- It is robot-centric, models pose uncertainty, and includes sensor noise models for laser, structured light (Kinect/RealSense) and stereo. Visibility-cleanup ray tracing runs at a configurable rate (default **1.0 Hz**). Defaults: resolution 0.01 m, map 1.5 x 1.5 m, variance range 9e-6 to 0.01, Mahalanobis threshold 2.5, multi-height noise 9e-7. The README states it is **no longer actively maintained** and **ROS 1 only**. — [GitHub ANYbotics/elevation_mapping](https://github.com/ANYbotics/elevation_mapping)
- The laser noise model in source (LaserSensorProcessor.cpp): std dev along the beam = `min_radius`; lateral std dev = `beam_constant + beam_angle × distance`. The sensor covariance is propagated through Jacobians together with the robot rotation covariance (error-propagation law) to get the per-point height variance. — [LaserSensorProcessor.cpp](https://github.com/ANYbotics/elevation_mapping/blob/master/elevation_mapping/src/sensor_processors/LaserSensorProcessor.cpp)
- The structured-light model: normal std dev = a + b·(d − c)² + d_f·d^e (Nguyen et al. form); lateral std dev = `lateral_factor × distance`. — [StructuredLightSensorProcessor.cpp](https://github.com/ANYbotics/elevation_mapping/blob/master/elevation_mapping/src/sensor_processors/StructuredLightSensorProcessor.cpp)
- Underlying papers: Fankhauser et al., "Robot-centric elevation mapping with uncertainty estimates", CLAWAR 2014. Fankhauser, Bloesch, Hutter, "Probabilistic Terrain Mapping for Mobile Robots With Uncertain Localization", IEEE RA-L 3(4):3019–3026, 2018, DOI 10.1109/LRA.2018.2849506. The 2018 paper incorporates state-estimation drift and sensor noise into a grid elevation map with **upper and lower confidence bounds**. — [EPFL Infoscience (RA-L 2018)](https://infoscience.epfl.ch/entities/publication/74b313c9-3666-4111-8cb3-a8ce99ccf728); [ResearchGate (CLAWAR 2014)](https://www.researchgate.net/publication/261949305_Robot-Centric_Elevation_Mapping_with_Uncertainty_Estimates)

**ANYbotics grid_map**
- grid_map is a C++ library with a ROS interface for multi-layer 2D grid maps (elevation, variance, color, and so on). Layer data is stored as Eigen types. A circular buffer allows non-destructive map shifting without copying data. Iterators are provided for grid, submap, circle, ellipse, line, polygon and spiral. Filters include threshold, normals, smoothing, inpainting and convolution. Conversions exist to and from PointCloud2, OccupancyGrid, GridCells, OpenCV, PCL, OctoMap and costmap_2d. `grid_map_msgs/GridMap` carries the layer list and the position/geometry info. — [GitHub ANYbotics/grid_map](https://github.com/ANYbotics/grid_map)
- ROS 2 is maintained on branches `humble`, `iron`, `jazzy` and `rolling` (PRs target rolling and are backported). The license is BSD-3. Citation: Fankhauser & Hutter, "A Universal Grid Map Library: Implementation and Use Case for Rough Terrain Navigation", *Robot Operating System – The Complete Reference (Vol. 1)*, Springer, 2016. — [GitHub ANYbotics/grid_map](https://github.com/ANYbotics/grid_map)

### Inferences
- A student project that publishes a custom message instead of `grid_map_msgs/GridMap` will look non-interoperable. Supporting GridMap output (even if the internal structure is variable-resolution, e.g. resampled per tier) would let judges plug it into the standard toolchain (RViz plugin, costmap conversion).
- The reference "dynamic object handling" in this field is per-scan ray-cast visibility cleanup with a normal-angle and time guard, not object tracking. A project claiming dynamic handling should either reproduce this or explain why its mechanism (e.g. decay, tracking, segmentation) is better, and show cleared-ghost metrics.
- The reference noise model is range-dependent: variance grows quadratically with distance (cupy), or linearly in lateral std dev (laser model). A variable-resolution design that coarsens with range is consistent with this, and judges may ask whether the coarsening is driven by the variance model or by hand-set distance bands.
- On memory: a 10 m x 10 m map at 4 cm is 62,500 cells, so even dozens of float layers come to only a few MB. The ETH baselines avoid large maps by staying robot-centric and local; they do not use adaptive resolution. A large-radius (e.g. 100 m) map is where adaptive resolution actually pays off.

### Gaps
- No official absolute GPU/host memory footprint for elevation_mapping_cupy was found in the papers; only timing is reported.
- No published benchmark of the ROS 2 `release/jazzy` branch performance was found.

## Q2. Volumetric baselines: OctoMap, UFOMap, Voxblox, VDBFusion/OpenVDB, nvblox; is "dense 3D grid = 3 GB" a strawman?

### Takeaway
Sparse and hierarchical 3D structures exist precisely to avoid dense-grid memory. The OctoMap paper itself shows a dense grid at 10 cm costing 5.1 GB over 292 x 167 x 28 m, versus 1.26 GB for the octree (0.99 GB pruned, 13.8 MB max-likelihood file). UFOMap cuts OctoMap memory by about 61–65%, and VDB/hash-based TSDF systems store only blocks near observed surfaces. Comparing a 2.5D map only against a dense 3D voxel array is therefore a strawman. The fair comparisons are (a) OctoMap/UFOMap/VDB at equal resolution and (b) a fixed-resolution 2.5D grid (grid_map / elevation_mapping_cupy).

### Cited Findings
**OctoMap (Hornung, Wurm, Bennewitz, Stachniss, Burgard; Autonomous Robots 2013)**
- OctoMap is a probabilistic occupancy octree (log-odds, clamping, pruning) that represents free, occupied and unknown space. Maximum depth 16 covers a (655.36 m)³ cube at 1 cm resolution. Lookup is O(d_max). — [OctoMap AuRo 2013 preprint](http://www.arminhornung.de/Research/pub/hornung13auro.pdf)
- Node size on 64-bit is **80 B per inner node and 16 B per leaf** (40 B / 8 B on 32-bit), and 80–85% of nodes are leaves. A single child-pointer-array scheme saves 60–65% versus 8 pointers per node. — [OctoMap AuRo 2013](http://www.arminhornung.de/Research/pub/hornung13auro.pdf)
- Multi-resolution queries come from limiting tree depth; the paper's examples are 0.08, 0.64 and 1.28 m. — [OctoMap AuRo 2013](http://www.arminhornung.de/Research/pub/hornung13auro.pdf)
- Memory table, given as dense 3D grid → octree (no compression) → octree (pruned) → file (full / pruned / max-likelihood):
  - FR-079 corridor, 43.7 x 18.2 x 3.3 m at 5 cm: 78.88 MB → 73.55 → 41.62 → 24.72 / 15.76 / 0.67 MB.
  - **Freiburg campus, 292 x 167 x 28 m at 10 cm: 5162.90 MB → 1257.57 → 990.66 → 504.76 / 379.70 / 13.82 MB.**
  - New College, 250 x 161 x 33 m at 10 cm: 5058.76 MB → 607.92 → 395.42 → 230.33 / 148.75 / 6.40 MB.
  - Source: [OctoMap AuRo 2013, Table](http://www.arminhornung.de/Research/pub/hornung13auro.pdf). Columns were reconstructed from the PDF text layout and the order is consistent with the paper's header.

**UFOMap (Duberg & Jensfelt, IEEE RA-L 2020, arXiv 2003.04749)**
- UFOMap explicitly represents unknown, free and occupied space. Children are stored inline in an array rather than via pointers (saving 64 B per inner node versus OctoMap). Most functions work at any octree depth, i.e. multi-resolution queries. It reaches real-time colored mapping at <1 cm. — [arXiv 2003.04749](https://arxiv.org/pdf/2003.04749)
- On the OctoMap 3D-scan datasets it uses **≈61–65% less memory than OctoMap**; for example, one dataset is 7.42 MB vs 21.49 MB and another is 58.71 MB vs 155.46 MB. On the "cow" dataset at 16 cm, insertion takes 4.98 ms for UFOMap vs 5.52 ms for OctoMap per cloud, and the insertion part is about 2x faster. — [arXiv 2003.04749](https://arxiv.org/pdf/2003.04749)

**Voxblox (Oleynikova et al., IROS 2017; ethz-asl)**
- CPU-only TSDF→ESDF, with official performance figures on the cow-and-lady dataset (i7-4810MQ):
  - 20 cm: merged integrator 56 ms/scan, 49 MB RAM; fast integrator 20 ms/scan, 62 MB.
  - 5 cm: merged 112 ms/scan, 144 MB; fast 23 ms/scan, 153 MB.
  - 2 cm: merged 527 ms/scan; fast 63 ms/scan, 673 MB. The fetched summary listed 609 MB for merged at 2 cm.
  - Source: [voxblox Performance.rst](https://github.com/ethz-asl/voxblox/blob/master/docs/pages/Performance.rst)

**VDBFusion (Vizzo, Guadagnino, Behley, Stachniss; Sensors 22(3):1296, 2022)**
- VDBFusion does TSDF integration on top of OpenVDB's sparse hierarchical grid for LiDAR and RGB-D. It has a Python/C++ API and a ROS 1 wrapper (vdbfusion_ros). — [GitHub PRBonn/vdbfusion](https://github.com/PRBonn/vdbfusion)
- Secondary reports: it integrates LiDAR at about 20 fps, outperforming Voxblox and OctoMap, and has 3 parameters vs 14 for Voxblox. — [MDPI Sensors (via search snippet)](https://www.mdpi.com/1424-8220/22/3/1296). The MDPI and PMC full text was blocked (403/captcha), so exact memory tables could not be verified.

**nvblox (Millane, Oleynikova, Wirbel, Steiner, Ramasamy, Tingdahl, Siegwart; arXiv 2311.00626, 2023)**
- GPU TSDF/ESDF/occupancy/color/mesh. Storage is a hash table from 3D block index to VoxelBlocks of **8x8x8 voxels**, stored contiguously in GPU memory, so only observed blocks are allocated. — [arXiv 2311.00626](https://arxiv.org/pdf/2311.00626)
- Speedups over Voxblox: up to **177x** for surface reconstruction and **31x** for ESDF (7x vs FIESTA). Even at 1 cm TSDF / 2 cm ESDF, nvblox is faster than Voxblox at 10 cm. — [arXiv 2311.00626](https://arxiv.org/pdf/2311.00626)
- LiDAR timings: a 64-beam LiDAR at 25 m max range and **10 cm** integrates in **<7 ms on a laptop and <20 ms on a Jetson**. A 64-beam Ouster OS1 at 25 m / **5 cm** with Fast-LIO poses takes **<7 ms per scan** on a laptop. — [arXiv 2311.00626](https://arxiv.org/pdf/2311.00626)
- Dynamic handling: humans segmented by PeopleSemSegnet go into a separate OccupancyLayer that decays over time, while the static scene is fused via TSDF. — [arXiv 2311.00626](https://arxiv.org/pdf/2311.00626)
- The repo describes a GPU TSDF/ESDF library with occupancy, color and mesh layers, a 2D ESDF slice for costmaps, people segmentation and dynamics detection, ROS 2 via isaac_ros_nvblox, and Python/C++ APIs. Latest releases: v0.0.9 (2026-01-30), v0.0.10 (**2026-05-07**). — [GitHub nvidia-isaac/nvblox](https://github.com/nvidia-isaac/nvblox); release dates via GitHub API

**Other**
- C3P-VoxelMap (2024) reports LIO voxel-map memory on KITTI: VoxelMap 521–2,150 MB and its own method 244–879 MB per sequence. This shows that even "sparse" LiDAR voxel maps reach the GB range on long drives. — [arXiv 2406.01195](https://arxiv.org/html/2406.01195v1)

### Inferences
- Dense arithmetic (my calculation, not sourced): a 100 m radius needs a 200 x 200 m footprint.
  - **At 5 cm**: 4000 x 4000 = 16 M columns. A 10 m tall dense 3D grid is 200 voxels per column = 3.2 G voxels, which is ≈3.2 GB at 1 B/voxel or ≈12.8 GB at 4 B (float log-odds/TSDF).
  - **At 10 cm**: 2000 x 2000 x 100 = 0.4 G voxels, ≈0.4 GB (1 B) or 1.6 GB (float).
  - So "dense 3D = 3 GB" corresponds to 5 cm, 10 m height and 1 byte/voxel. It is arithmetically right for a dense array, but no one deploys dense arrays at that scale.
  - The OctoMap paper's own dense-grid number (5.16 GB at 10 cm over 1.37 M m³ ≈ 3.8 B/voxel) confirms the order of magnitude.
- What judges will expect instead:
  - Sparse 3D at 10 cm over a campus-sized outdoor area costs about 0.4–1.3 GB in RAM (OctoMap), 2.6x less with UFOMap. Block-hashed TSDF (nvblox/VDB) allocates only near observed surfaces.
  - A flat-ish outdoor area at 5 cm has about 16 M surface columns, so even surface-only sparse 3D needs about 16 M x 16 B ≈ 256 MB of OctoMap leaves alone, plus inner nodes and free space.
- 2.5D fixed-resolution baseline (my calculation): a 200 x 200 m grid_map with 4 float layers (elevation, variance, time, traversability) is 16 M x 16 B ≈ **256 MB at 5 cm**, or ≈64 MB at 10 cm. This assumes float layers, consistent with grid_map storing layers as Eigen matrices. The honest memory claim for adaptive resolution is therefore savings versus a fixed-resolution 2.5D grid (hundreds of MB → tens of MB), not versus 3 GB of dense 3D.
- Range-tiered resolution (e.g. 5 cm <10 m, 10 cm 10–25 m, 20 cm beyond) over a 100 m radius has about 125k + 165k + 760k ≈ 1.05 M cells, vs 12.6 M cells for a uniform 5 cm disk (my calculation), roughly a 12x reduction. This is a defensible, concrete number to present.

### Gaps
- Exact VDBFusion memory and runtime tables (Mai City / KITTI) could not be retrieved; MDPI and PMC were blocked. A search snippet claiming "KITTI 07: OctoMap 1.12 GB, VDBFusion 847 MB" could not be traced to a primary source and is excluded.
- No primary nvblox memory-per-km² figure was found.
- OpenVDB's raw tree configuration (5-4-3 internal/leaf log2 dims) was not verified from a primary source in this session.

## Q3. Multi-resolution / adaptive / variable-resolution elevation maps in the literature

### Takeaway
Variable resolution in terrain mapping has real precedent:
- multi-resolution pyramids (Montemerlo & Thrun 2004);
- probabilistic quadtrees;
- footprint-driven dynamic Level-of-Detail elevation maps (Schoppmann et al., IROS 2021, JPL/ETH);
- multi-range multi-resolution traversability maps (RoadRunner M&M, 2024, ETH/JPL), with ±50 m at 0.2 m and ±100 m at 0.8 m;
- multi-resolution 3D queries in OctoMap/UFOMap.

A student "adaptive variable-resolution" claim should cite these and differentiate from them, e.g. online adaptivity driven by variance or point density rather than fixed rings.

### Cited Findings
- Schoppmann, Proença, Delaune, Pantic, Hinzmann, Matthies, Siegwart, Brockers, "Multi-Resolution Elevation Mapping and Safe Landing Site Detection with Applications to Planetary Rotorcraft", IROS 2021. It builds a local, robot-centric multi-resolution elevation map whose depth measurements are fused probabilistically according to their **lateral surface resolution (pixel footprint)**, using a dynamic Level-of-Detail scheme. — [arXiv 2111.06271](https://arxiv.org/abs/2111.06271)
- RoadRunner M&M (Patel, Frey, Atha, Spieler, Hutter, Khattak; arXiv 2409.10940, 2024) predicts multi-range, multi-resolution elevation and traversability: micro range **±50 m at 0.2 m (500x500)** and short range **±100 m at 0.8 m (250x250)**. Inputs are 4 RGB cameras plus a LiDAR voxel map from 3x VLP-32C. Inference takes about 100 ms vs >500 ms for the X-Racer heuristic baseline. It reports up to 50% better elevation and 30% better traversability than RoadRunner, and 30% more coverage than X-Racer. — [arXiv 2409.10940](https://arxiv.org/html/2409.10940); [project page](https://leggedrobotics.github.io/roadrunner_mm/)
- Montemerlo & Thrun, "A Multi-Resolution Pyramid for Outdoor Robot Terrain Perception" (AAAI 2004, Stanford). A variable-resolution approach that picks the finest resolution guaranteeing coverage at each range gives better coverage than fixed resolution. — [Stanford PDF](https://robots.stanford.edu/papers/Montemerlo04a.pdf) (via search summary)
- Probabilistic quadtrees for variable-resolution mapping of large environments represent occupancy compactly in 2D. Elevation maps can likewise be stored in a quadtree, trading memory for access time. — [ResearchGate: Probabilistic quadtrees](https://www.researchgate.net/publication/239717105_Probabilistic_quadtrees_for_variable-resolution_mapping_of_large_environments); [CVUT "Speeded Up Elevation Map"](https://comrob.fel.cvut.cz/papers/mesas19exploration.pdf) (via search summary)
- OctoMap and UFOMap provide multi-resolution queries by tree depth; UFOMap functions operate at any depth. — [OctoMap AuRo 2013](http://www.arminhornung.de/Research/pub/hornung13auro.pdf); [UFOMap arXiv](https://arxiv.org/pdf/2003.04749)
- A comparable student/hackathon project exists: GitHub "sstharun08/Adaptive-Variable-Resolution-2.5D-LiDAR-Mapping". Per a search snippet, it uses distance bands of 5 cm (<10 m), 10 cm (10–25 m) and 20 cm (≥25 m), evaluated on automotive LiDAR. — [GitHub sstharun08](https://github.com/sstharun08/Adaptive-Variable-Resolution-2.5D-LiDAR-Mapping) (snippet only; repo not inspected)

### Inferences
- Fixed range rings are the simplest form and are already in peer projects. A stronger story ties the cell size to the sensor footprint or noise model, as Schoppmann's lateral-footprint LoD and the range-dependent σ² of Fankhauser/Miki do. Alternatives are to refine where variance, roughness or obstacle evidence is high (uncertainty-aware coarsening), and to explain how values are re-sampled when a region changes tier as the robot moves.
- RoadRunner M&M is the closest modern "multi-range multi-resolution" comparator, but it is learned and uses GPU inference. A geometric adaptive map is complementary, and can be positioned as an input or baseline to such systems.

### Gaps
- No primary paper specifically titled "foveated" terrain/elevation mapping for ground robots was found in this session.
- No paper giving a closed-form uncertainty-driven coarsening rule for 2.5D grids was located; Schoppmann's footprint LoD is the closest.

## Q4. Traversability estimation and negative-obstacle detection

### Takeaway
Geometric traversability on elevation maps is standardized as slope + step + roughness filters (Wermelinger et al., IROS 2016; leggedrobotics/traversability_estimation). Learned and self-supervised methods (Wellhausen's CNN in cupy, WVN 2023, RoadRunner 2024, GANav on RUGD/RELLIS-3D) are the current SOTA. Negative obstacles are detected from LiDAR gaps or shadows (missing returns), point-spacing jumps and rear-wall cues. In elevation maps, the ray-cast upper-bound layer is the established mechanism.

### Cited Findings
- Wermelinger, Fankhauser, Diethelm, Krüsi, Siegwart, Hutter, "Navigation planning for legged robots in challenging terrain", IROS 2016. The traversability map is computed from slope, roughness and steps, and evaluated over the robot footprint. — [ResearchGate](https://www.researchgate.net/publication/311758500_Navigation_planning_for_legged_robots_in_challenging_terrain)
- Default filter chain in leggedrobotics/traversability_estimation:
  - surface normals (radius 0.05 m);
  - SlopeFilter, critical_value 1.0;
  - StepFilter, critical 0.12 m, window radii 0.04 m, critical_cell_number 4;
  - RoughnessFilter, critical 0.05, radius 0.05;
  - final traversability = (slope + step + roughness)/3 via MathExpressionFilter.
  - Source: [robot_filter_parameter.yaml](https://github.com/leggedrobotics/traversability_estimation/blob/master/traversability_estimation/config/robot_filter_parameter.yaml)
- elevation_mapping_cupy integrates a learned CNN traversability (Wellhausen et al.) at about 4.1 ms on Jetson Xavier. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Wild Visual Navigation (Frey, Mattamala, Chebrolu, Cadena, Fallon, Hutter; RSS 2023, arXiv 2305.08510) is online self-supervised visual traversability from DINO-ViT features. It bootstraps from <5 min of in-field demonstration. The extended journal version is arXiv 2404.07110. — [arXiv 2305.08510](https://arxiv.org/abs/2305.08510); [arXiv 2404.07110](https://arxiv.org/pdf/2404.07110)
- RoadRunner (Frey et al., IEEE Trans. Field Robotics 2024) is camera+LiDAR → traversability and elevation, self-supervised. It cut latency from 500 ms to 140 ms versus the X-Racer stack. Its evaluation reports elevation MAE and hazard-detection precision/recall/F1. — [arXiv 2402.19341](https://arxiv.org/pdf/2402.19341)
- GANav (Guan et al., arXiv 2103.04233, RA-L 2022) groups terrain into navigability classes from RGB with group-wise attention. It reports mIoU of **89.08 on RUGD and 74.44 on RELLIS-3D**, +2.25–39.05% on RUGD and +5.17–19.06% on RELLIS-3D over the prior SOTA. — [arXiv 2103.04233](https://arxiv.org/html/2103.04233v1); [GitHub](https://github.com/rayguan97/GANav-offroad)
- Negative obstacles (LiDAR):
  - Larson & Trivedi's NODR traces rays of points outward from the sensor and flags gaps (absence of data) as potential ditches, cliffs or negative slopes. — [DTIC PDF](https://apps.dtic.mil/sti/tr/pdf/ADA561293.pdf)
  - An orchard UGV method (Sensors 2024, 24(24):7929) tilts the LiDAR 40°, reducing the blind spot from 3 m to 0.21 m and raising ground point density about 10x. It models rear-wall height and density and point-spacing jumps over multiple frames, with a 92.7% detection success rate. — [PMC11679008](https://pmc.ncbi.nlm.nih.gov/articles/PMC11679008/)
  - There is also a J. Field Robotics paper on "LiDAR Based Negative Obstacle Detection for Field Autonomous Land Vehicles". — [Wiley/ACM DL](https://dl.acm.org/doi/abs/10.1002/rob.21609)
- In elevation maps, the upper-bound layer computed from ray casting distinguishes occlusion holes (small inclination) from real drops (steep ray angles). It was used with the traversability layer for SubT local planning. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)

### Inferences
- Judges will expect at minimum the slope, step-height and roughness trio, with thresholds tied to robot geometry, e.g. a 0.12 m step for ANYmal-class robots.
- For potholes and ditches, treating "no data" cells as unknown or dangerous (not free) and exploiting ray geometry (upper bound / shadow length) is the accepted LiDAR approach. Coarsening cells at range risks averaging away a negative obstacle's rear wall. The adaptive scheme should therefore refine, not coarsen, where gaps or step edges appear.

### Gaps
- "TravNet" was not researched in this session (several unrelated works share the name); no primary source was gathered.
- RELLIS-3D-based LiDAR traversability benchmarks (e.g. per-class LiDAR IoU) were not collected.

## Q5. Elevation fusion techniques: noise models, drift, ray-casting clearing, overhangs

### Takeaway
The established recipe has four parts:
- per-cell 1D Kalman fusion with a range-dependent point variance and Mahalanobis gating;
- variance inflation over time and from robot motion;
- per-scan ray-cast "penetration" clearing for dynamics;
- explicit handling of overhangs, either via exclusion zones (2.5D) or by moving to multi-level surface (MLS) maps or 3D (OctoMap).

### Cited Findings
- Kalman update, σp² = σd·d², and time-variance growth are as described in Q1. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Fankhauser 2018 propagates robot pose uncertainty, from proprioceptive kinematic plus inertial state estimation, into the map. The result is an elevation map with upper and lower confidence bounds. This handles drift by making cells far from the robot increasingly uncertain rather than wrong. — [RA-L 2018 record](https://infoscience.epfl.ch/entities/publication/74b313c9-3666-4111-8cb3-a8ce99ccf728)
- Laser and structured-light noise models plus error propagation are as in the source code above. The Kinect noise model (lateral and axial noise vs distance and angle) was empirically derived by Fankhauser et al. — [LaserSensorProcessor.cpp](https://github.com/ANYbotics/elevation_mapping/blob/master/elevation_mapping/src/sensor_processors/LaserSensorProcessor.cpp); [ResearchGate: Kinect v2 evaluation & modeling](https://www.researchgate.net/publication/277166118_Kinect_v2_for_Mobile_Robot_Navigation_Evaluation_and_Modeling)
- Drift compensation (cupy) matches the new scan to the map on flat, traversable cells and shifts the whole map by the mean error. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)
- Visibility clearing is per scan in cupy, with jitter guards (time since update, |r·n| threshold). The CPU baseline clears at 1 Hz by default. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876); [ANYbotics/elevation_mapping README](https://github.com/ANYbotics/elevation_mapping)
- nvblox handles dynamics with a separate decaying occupancy layer for segmented humans. — [arXiv 2311.00626](https://arxiv.org/pdf/2311.00626)
- Overhangs:
  - Triebel, Pfaff & Burgard's **Multi-Level Surface (MLS) maps** (IROS 2006) store multiple surface patches (height plus variance, with vertical extent) per 2D cell. This lets them represent bridges and underpasses that a single-height elevation map cannot. Miki et al. cite MLS as the bridge between 2.5D and 3D, and note that a 3D grid has higher memory requirements. OctoMap lists MLS among prior 3D representations. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876); [OctoMap AuRo 2013](http://www.arminhornung.de/Research/pub/hornung13auro.pdf)
  - The 2.5D practical workaround is cupy's ramp-shaped exclusion area plus multi-floor overlap clearance. — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)

### Inferences
- If a student map fuses with simple max, mean or latest-height without per-point variance, it falls clearly below baseline. Kalman fusion with a range-dependent σ² is cheap and expected.
- In a variable-resolution grid, the measurement model should account for multiple points landing in a coarse cell. Averaging over a wall or edge biases the height down, as Miki notes for vertical edges, which is why cupy ignores points lower than the current estimate in crowded cells. Coarse far-range cells are especially exposed to this.
- Dynamic-object handling claims will be compared to per-scan ray-cast clearing (cupy) and decaying occupancy layers (nvblox). Report clearing latency (scans or ms until a moved object's ghost disappears) and false clearing at grazing angles.

### Gaps
- The exact Triebel 2006 MLS memory and runtime numbers were not retrieved.
- No primary source was gathered for "occupancy-elevation grid" hybrid variants beyond a search listing (Robotica).

## Q6. Evaluation metrics for elevation/traversability maps and planners on maps

### Takeaway
The standard metrics are:
- elevation error vs ground truth, as RMSE or MAE (often split into observed and unobserved regions);
- map coverage/completeness;
- traversability as classification (IoU/mIoU, precision/recall/F1 for hazards) or regression (MSE);
- compute as per-component latency (ms), update rate (Hz) vs sensor rate, and memory (MB);
- planners: success rate, collisions, path length/time, often combined as in BARN.

### Cited Findings
- RoadRunner M&M evaluates elevation by **MAE (m)** separately for observed-past/current, observed-future and unobserved regions. Traversability is evaluated by **MSE** plus **precision/recall/F1 for hazard classification**. Pseudo ground truth comes from 60 s hindsight fusion plus USGS 1 m DEMs aligned by GNSS+ICP. It also reports a coverage metric (30% more coverage than X-Racer). — [arXiv 2409.10940](https://arxiv.org/html/2409.10940)
- RoadRunner (TFR 2024) uses elevation MAE and hazard-detection precision/recall/F1, plus end-to-end latency (500 → 140 ms). — [arXiv 2402.19341](https://arxiv.org/pdf/2402.19341)
- GANav and the RUGD/RELLIS-3D semantic traversability literature use **mIoU**. — [arXiv 2103.04233](https://arxiv.org/html/2103.04233v1)
- OctoMap evaluates map accuracy as the percentage of correctly classified cells against held-out scans: 97.27% for FR-079 at 5 cm, 97.89% for Freiburg campus at 10 cm, and 98.79% for New College at 10 cm. It also reports memory vs resolution and insertion time. — [OctoMap AuRo 2013](http://www.arminhornung.de/Research/pub/hornung13auro.pdf)
- elevation_mapping_cupy and MEM evaluate per-feature latency (ms ± std over 300–1000 runs), map update Hz vs sensor Hz, and scaling with point count and number of layers, plus qualitative artifact comparisons (drift gap, ghost walls, overhangs). — [arXiv 2204.12876](https://arxiv.org/pdf/2204.12876); [arXiv 2309.16818](https://arxiv.org/pdf/2309.16818)
- Recent legged-robot elevation-map work builds ground truth from handheld LiDAR scanning with SLAM reconstruction at 0.01 m resolution. — [MARG, arXiv 2509.20036](https://arxiv.org/html/2509.20036) (via search summary)
- BARN benchmark (300 simulated environments) per-environment score: s = 1[success] × OT / clip(AT, lower, upper). Here OT is the optimal traversal time at max speed (2 m/s) and AT is the actual time; collision or failing to reach the goal counts as failure. In the 3rd challenge (ICRA 2024) the clip's lower bound was reduced from 4·OT to 2·OT, which raised the maximum score from 0.25 to 0.5. — [3rd BARN Challenge report, arXiv 2407.01862](https://arxiv.org/html/2407.01862); [BARN 2022 report](https://people.cs.gmu.edu/~xiao/papers/barn22_report.pdf)

### Inferences
A minimal judge-credible evaluation suite for the student project would include:
- elevation RMSE and MAE vs a ground-truth surface (e.g. a dense accumulated map or survey), stratified by range band, which directly tests whether coarsening costs accuracy;
- coverage or completeness per range band;
- for traversability/hazards: precision, recall, F1 and IoU (including negative obstacles);
- memory (MB) and cell count vs a fixed-resolution grid_map at the finest resolution, plus OctoMap/UFOMap at equal resolution;
- per-scan latency on target hardware against cupy's ≈7 ms (Xavier, 43k points) and MEM's ≈24 ms (Orin, 230k points);
- dynamic-object ghost-clearing time;
- downstream planning: success rate, collision rate, path length or time ratio vs fixed-resolution map.

### Gaps
- No single standard public benchmark dataset for 2.5D elevation-map RMSE was identified; papers generate their own ground truth (hindsight fusion, DEMs, handheld SLAM scans).
- The exact BARN bound values for the 2nd challenge (4·OT lower bound per search summary) were not verified from primary text.
