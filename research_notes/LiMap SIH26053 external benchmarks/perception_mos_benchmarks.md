# Perception, MOS and Dynamic-Point-Removal Reference Benchmarks (for sanity-checking LiMap results)

Project numbers being checked (from assignment, not independently verified): SalsaNext (Qualcomm AI Hub ONNX float export), SemanticKITTI seq 08 first 100 frames: OA 88.96%, mIoU 42.25% (19 classes) / 53.52% (15 present classes), no KNN, CPU 0.5-3 s/frame. MOS (range-image disparity + semantic gating): P 61.6%, R 47.65% on 50 frames of seq 08.

## Q1. SalsaNext, RangeNet++ and newer LiDAR semantic segmentation models: published mIoU (val vs test), KNN effect, runtime

### Takeaway
Published SalsaNext numbers are 59.5% mIoU on the SemanticKITTI hidden test set with kNN post-processing and 56.6% without kNN. An independent 2024 re-implementation reports 55.9% at 64x2048. The project's 42.25% (19-class, 100 frames, no kNN) is about 14 points below the published no-kNN figure. Its 53.52% over the 15 classes present is within a few points of the published range, but neither number is protocol-comparable (see Q3). Current range-view SOTA (FRNet/RangeFormer) is about 67-69% val and 73% test. Point/voxel SOTA (PTv3) is about 71% val and 74% test.

### Cited Findings
**SalsaNext (Cortinhal et al., 2020, arXiv 2003.03653)**
- SalsaNext reports **59.5% mIoU on the SemanticKITTI test set (seq 11-21)** with kNN post-processing. It was the top method on the leaderboard at publication, +3.6 over the prior SOTA. In the same table, RangeNet53++ = 52.2%, SqueezeSegV3 = 55.9% and SalsaNet = 45.4% — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653)
- Ablation (Table II, "Ablative analysis"): the full SalsaNext gets **56.6% mIoU without kNN and 59.5% with kNN**, a kNN gain of about +2.9 points. Base SalsaNet gets 43.5% without and 44.8% with kNN — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653). **Caveat:** two extraction passes of the same page disagreed on whether Table II is on validation (seq 08) or test. The final row (59.5) is identical to the test-set number, which suggests test, but this is not confirmed.
- Split used in the paper: "Over 21K scans (sequences between 00 and 10) are used for training, where scans from sequence 08 are particularly dedicated to validation. The remaining scans (between sequences 11 and 21) are used as test split." — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653)
- Runtime (Table III, NVIDIA Quadro RTX 6000 24 GB, whole SemanticKITTI): SalsaNext CNN 38.61 ms and total with kNN 41.26 ms (24 Hz), 6.73M params, 125.68 GFLOPs. RangeNet++: CNN 63.51 ms, total 66.41 ms (15 Hz), 50M params, 720.96 GFLOPs. SalsaNet: 38.40 ms total (26 Hz), 6.58M params — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653)
- Input: 64 x 2048 range image with 5 channels (x, y, z, intensity/remission, range), 19 evaluated classes — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653)
- The paper says it uses "the kNN-based post-processing technique introduced in [7]" (RangeNet++) to fix back-projection artifacts — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653)
- The official repo is MIT-licensed and provides a pretrained model via Google Drive. The README does not state the mIoU or the training split for that checkpoint — [GitHub TiagoCortinhal/SalsaNext](https://github.com/TiagoCortinhal/SalsaNext)

**SalsaNext on embedded / Jetson (independent re-evaluation, arXiv 2410.08365, "Are We Ready for Real-Time LiDAR Semantic Segmentation in Autonomous Driving?")**
- SemanticKITTI, SalsaNext 64x2048: **51 ms on Jetson AGX Orin, 131 ms on AGX Xavier, mIoU 55.9%**. SalsaNext 64x1024: 26 ms (Orin), 67 ms (Xavier), mIoU 54.4%. Batch size 1; total runtime includes preprocessing. The extraction did not specify precision (FP32/FP16/TensorRT) — [arXiv 2410.08365 HTML](https://arxiv.org/html/2410.08365)
- nuScenes: SalsaNext 32x2048 runs at 27 ms (Orin) / 70 ms (Xavier), mIoU 68.2%. The authors state that with a 20 Hz sensor on nuScenes, "only SalsaNext can be executed in real-time on RTX4090 and Jetson AGX Orin." Halving MACs (64x2048 to 64x1024) roughly halves inference time — [arXiv 2410.08365 HTML](https://arxiv.org/html/2410.08365)

**RangeNet++ (Milioto et al., IROS 2019)**
- RangeNet53++ (with kNN): 52.2% test mIoU, as cited in the SalsaNext paper — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653). FRNet lists RangeNet++ at **50.3% val / 52.2% test, 12.0 FPS, with KNN post-processing** — [FRNet arXiv 2312.04484](https://arxiv.org/html/2312.04484)
- The lidar-bonnetal repo (MIT) provides DarkNet21/53/53-1024/53-512 and SqueezeSeg(V2) pretrained models plus predictions "with and without k-NN" for train/valid/test. It notes that pretrained models "maintain copyright of such dataset" (i.e. SemanticKITTI terms apply) — [GitHub PRBonn/lidar-bonnetal](https://github.com/PRBonn/lidar-bonnetal)

**Newer range-view and point/voxel models (table compiled in the FRNet paper; val = seq 08, test = hidden 11-21)**
- FIDNet 58.9 val / 59.5 test (31.8 FPS, KNN). CENet 62.6 / 64.7 (33.4 FPS, KNN). RangeViT 60.7 / 64.0 (10.0 FPS, pretrained, KNN). RangeFormer 67.6 / 73.3 (6.2 FPS, KNN). **FRNet 68.7 / 73.3 (29.1 FPS, end-to-end, no post-processing)**. Fast-FRNet 67.1 / 72.5 (33.8 FPS) — [FRNet arXiv 2312.04484](https://arxiv.org/html/2312.04484)
- MinkUNet 62.8 / 63.7 (9.1 FPS). SPVNAS 62.5 / 66.4 (8.9 FPS). Cylinder3D 65.9 / 67.8 (6.2 FPS). **PTv3 70.8 / 74.2** (20.2 FPS) — [FRNet arXiv 2312.04484](https://arxiv.org/html/2312.04484)
- FRNet has 10.0M params vs RangeFormer's 24.3M, and is about 5x faster at equal test mIoU — [FRNet arXiv 2312.04484](https://arxiv.org/html/2312.04484)

### Inferences
- **Placing the project's 42.25%:** the closest comparable published number is SalsaNext without kNN, 56.6% (Table II), or about 55.9% from the independent 64x2048 re-run. The 19-class figure is therefore about 13-14 points low. The 15-present-class figure (53.52%) is 2-3 points below published no-kNN numbers. Some of the remaining gap would plausibly close with kNN (+2.9 points in the paper).
- Plausible reasons for the gap include:
  - the 100-frame subset;
  - classes absent from the subset dragging the 19-class mean down (see Q3);
  - preprocessing mismatch with the Qualcomm export (normalization constants and channel order must match SalsaNext's `arch_cfg` sensor means/stds);
  - unknown training split of the AI Hub weights (Q2).
- If the checkpoint was trained on train + val (00-10, as leaderboard submissions often are), seq 08 would not be held-out data. In that case the number would, if anything, be optimistic. This is unknown (see Q2 gaps).
- CPU runtime of 0.5-3 s/frame is 12-70x slower than the 41 ms GPU figure. That is expected for an unoptimized ONNX float model on CPU (125.68 GFLOPs per frame at 64x2048) and is not a red flag. The paper's runtime includes kNN on GPU.

### Gaps
- A definitive SalsaNext **validation (seq 08)** mIoU from the original paper was not confirmed. Table II's split is ambiguous between the extraction passes, and the PDF could not be text-extracted (no Python available locally).
- The split behind the 55.9% in arXiv 2410.08365 (val seq 08 vs test) was not confirmed, and neither was the precision/TensorRT use on Jetson. No dedicated TensorRT SalsaNext benchmark was found.
- RangeNet++'s own without-kNN numbers (commonly quoted as 49.9% test for RangeNet53) were not verified this session because the PDF was unreadable.

## Q2. Qualcomm AI Hub SalsaNext model (aihub.qualcomm.com / huggingface qualcomm/SalsaNext): weights, training split, input, accuracy, license

### Takeaway
The Qualcomm AI Hub SalsaNext is a re-export of the original TiagoCortinhal/SalsaNext checkpoint: 6.71M params, 25.7 MB float, input 1x5x64x2048. Qualcomm publishes **no accuracy figure and no training-data statement**. The license points to the original MIT license. However, the weights are almost certainly trained on SemanticKITTI, which is **CC BY-NC-SA 4.0 (non-commercial)**. That is a material licensing and provenance issue for a defence project.

### Cited Findings
- HF model card front matter: `license: mit`, `library_name: pytorch`, `pipeline_tag: image-segmentation`. "The license for the original implementation of SalsaNext can be found [here](https://github.com/TiagoCortinhal/SalsaNext/blob/master/LICENSE)." The card has no explicit statement about training data or evaluation accuracy — [HF qualcomm/SalsaNext README](https://huggingface.co/qualcomm/SalsaNext/raw/main/README.md)
- Model stats: input resolution 1x5x64x2048, 25.7 MB (float), 6.71M parameters. The checkpoint is named "SalsaNext" and originates from the TiagoCortinhal/SalsaNext repo — [HF qualcomm/SalsaNext](https://huggingface.co/qualcomm/SalsaNext)
- On-device latency (NPU): Snapdragon 8 Elite Gen 5 13.2-21.9 ms; Snapdragon 8 Gen 1 39.8-61.8 ms. Measured across TFLite/QNN DLC, float to w8a16. Assets are tied to QAIRT 2.50 and ONNX Runtime 1.27.1 — [HF qualcomm/SalsaNext](https://huggingface.co/qualcomm/SalsaNext)
- AI Hub page: repo qualcomm/ai-hub-models v0.63.0, license "MIT" (referencing the original repo), primary application "Self driving cars", no accuracy reported. The site is governed by Qualcomm's general Terms of Use — [Qualcomm AI Hub SalsaNext](https://aihub.qualcomm.com/models/salsanext)
- The original SalsaNext code is MIT-licensed — [GitHub TiagoCortinhal/SalsaNext](https://github.com/TiagoCortinhal/SalsaNext)
- SemanticKITTI license is CC BY-NC-SA 4.0: "you are free to share and adapt the data, but have to give appropriate credit and may not use the work for commercial purposes." — [semantic-kitti.org dataset](http://www.semantic-kitti.org/dataset.html)
- The analogous PRBonn model release states that pretrained models "maintain copyright of such dataset" — [GitHub PRBonn/lidar-bonnetal](https://github.com/PRBonn/lidar-bonnetal)

### Inferences
- The MIT license covers the code and model card. It does not clear the weights' dependence on SemanticKITTI (non-commercial, share-alike) or KITTI raw data. For defence or commercial deployment, the safe position is to treat the weights as research-only and plan retraining on owned or permissively licensed data.
- Because Qualcomm reports no accuracy, the project's own measurement is the only accuracy evidence for this export. It should be described as "un-benchmarked by vendor."

### Gaps
- Which split the original SalsaNext Google-Drive checkpoint was trained on (00-07,09-10 vs 00-10) is not documented on the README, HF or AI Hub pages. This determines whether seq 08 is genuinely held-out.
- The ai-hub-models GitHub path for salsanext returned 404, so the export script (preprocessing, normalization) could not be inspected. The separate license terms for Qualcomm's compiled "deployable assets" were not found.

## Q3. Standard SemanticKITTI evaluation protocol (semantic-kitti-api)

### Takeaway
The official protocol scores 19 classes with label 0 ("unlabeled") ignored. Moving classes are mapped to their static counterparts for single-scan segmentation. A single confusion matrix is accumulated over **all scans** of the split (seq 08 for validation), and per-class IoU and mIoU are computed from it. Results on a 100-frame subset are not directly comparable.

### Cited Findings
- `evaluate_semantics.py --dataset ... --predictions ... --split train/valid/test`. The valid split is sequence 08 — [GitHub PRBonn/semantic-kitti-api](https://github.com/PRBonn/semantic-kitti-api)
- "19 + ignore" classes. Label 0 "unlabeled" is ignored in training and evaluation (`learning_ignore`) — [semantic-kitti-api](https://github.com/PRBonn/semantic-kitti-api)
- `learning_map` folds moving classes into static ones for the single-scan task (e.g. moving-car 252 to car 10) — [semantic-kitti-api](https://github.com/PRBonn/semantic-kitti-api)
- Metrics come from a confusion matrix aggregated across all evaluated scans, not averaged per frame — [semantic-kitti-api](https://github.com/PRBonn/semantic-kitti-api)
- `evaluate_mos.py` is the corresponding script for moving object segmentation — [semantic-kitti-api](https://github.com/PRBonn/semantic-kitti-api)
- Dataset: sequences 00-10 have per-scan labels. Sequences 11-21 are the hidden test set, evaluated only via the submission server. 28 raw classes in total, including moving/non-moving traffic participants — [semantic-kitti.org dataset](http://www.semantic-kitti.org/dataset.html)
- The 19 evaluated classes are road, parking, sidewalk, other-ground, building, fence, vegetation, trunk, terrain, pole, traffic-sign, car, bicycle, motorcycle, truck, other-vehicle, person, bicyclist, motorcyclist — [ar5iv SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653)

### Inferences
- Sequence 08 is widely reported to contain 4071 scans. This count was not verified against a source this session. On that basis, 100 frames is about 2.5% of the validation set, and consecutive frames are highly correlated.
- Recalled from the api's `iouEval` code, not re-verified this session: mean IoU is taken over all included classes, and a class with zero union contributes 0. If so, the project's 19-class mIoU (42.25%) is mechanically depressed by the 4 classes absent in those 100 frames. The 15-present-class mean (53.52%) is the fairer subset number, but it is still not a protocol number. Recommendation: run `evaluate_semantics.py` on all 4071 scans of seq 08 to get a number directly comparable to published val results.
- Overall accuracy (88.96%) is not a headline metric in SemanticKITTI papers. It is dominated by large classes (road, vegetation, building), so mIoU should be the primary comparator.

### Gaps
- Exact seq 08 scan count, and the exact `iouEval` handling of absent classes, were not re-verified from source in this session.

## Q4. LiDAR-MOS benchmark (Chen et al. 2021): metric, seq 08 validation numbers for LMNet, 4DMOS, MotionSeg3D, InsMOS, MapMOS, MF-MOS and simple baselines; precision/recall?

### Takeaway
The standard MOS metric is **IoU on the moving class**, IoU = TP/(TP+FP+FN), on validation seq 08 or the hidden test (11-21). Precision and recall are generally *not* reported in the main tables. Learned SOTA is about 71-86% val IoU. Simple geometric baselines (residual images, scene flow, with or without semantics) score only about 2-29% test IoU. The project's P = 61.6% / R = 47.65% corresponds to roughly **36.7% moving IoU**, comfortably above the published non-learned baselines and below learned methods.

### Cited Findings
- Metric: IoU_MOS = TD/(TD+FD+FS) (true dynamic, false dynamic, false static), binary moving vs static. Benchmark on CodaLab. The repo is MIT — [GitHub PRBonn/LiDAR-MOS](https://github.com/PRBonn/LiDAR-MOS)
- LMNet paper, **test (11-21)**:

  | Method | Test IoU |
  |---|---|
  | SalsaNext (movable classes only) | 4.4 |
  | SalsaNext (retrained for MOS) | 46.6 |
  | Residual | 1.9 |
  | Residual + RG | 14.1 |
  | **Residual + RG + Semantics** | **20.6** |
  | SceneFlow | 4.8 |
  | **SceneFlow + Semantics** | **28.7** |
  | SpSequenceNet | 43.2 |
  | KPConv | 60.9 |
  | LMNet (SalsaNext, N=1) | 52.0 |
  | LMNet (SalsaNext, N=8 + Semantics) | 62.5 |

  Source: [ar5iv LMNet 2105.08971](https://ar5iv.labs.arxiv.org/html/2105.08971)
- LMNet paper, **validation seq 08** (Table I), by backbone RangeNet++ / MINet / SalsaNext: one frame 38.9 / 9.1 / 51.9; two frames 40.6 / 35.0 / 56.0; residual N=1 40.9 / 38.9 / 59.9. The paper reports IoU only, no precision/recall. Runtime is about 51 ms/scan with SalsaNext — [ar5iv LMNet](https://ar5iv.labs.arxiv.org/html/2105.08971)
- MF-MOS paper Table I (val seq 08 / test):

  | Method | Val | Test |
  |---|---|---|
  | SpSequenceNet | – | 43.2 |
  | KPConv | – | 60.9 |
  | Cylinder3D | 66.3 | 61.2 |
  | LMNet | 63.8 | 60.5 |
  | 4DMOS | 71.9 | 65.2 |
  | MotionSeg3D | 71.4 | 70.2 |
  | RVMOS | 71.2 | 74.7 |
  | InsMOS | 73.2 | 75.6 |
  | **MF-MOS** | **76.1** | **76.7** |

  No precision/recall reported. Source: [MF-MOS arXiv 2401.17023](https://arxiv.org/html/2401.17023v1)
- MambaMOS paper table (val / test):

  | Method | Val | Test |
  |---|---|---|
  | LMNet | 67.1 | 54.5 |
  | MotionSeg3D | 71.4 | 64.9 |
  | RVMOS | 71.2 | 74.7 |
  | 4DMOS | 77.2 | 65.2 |
  | InsMOS | 73.2 | – |
  | MF-MOS | 76.1 | – |
  | MotionBEV | 76.5 | 69.7 |
  | **MapMOS** | **86.1** | 66.0 |
  | Two-streamMOS | 77.9 | 73.0 |
  | LiDAR-IMU-GNSS | 79.0 | 74.9 |
  | MambaMOS | 82.3 | 75.6 |

  Split: train 00-07, 09-10; val 08; test 11-21. Methods marked † used extra KITTI-Road training data. Source: [MambaMOS arXiv 2404.12794](https://arxiv.org/html/2404.12794v1)
- **Conflicts between sources:**
  - LMNet val: 63.8 (MF-MOS) vs 67.1 (MambaMOS) vs 59.9 for the N=1 residual in the original paper.
  - 4DMOS val: 71.9 (MF-MOS) vs 77.2 (MambaMOS).
  - MotionSeg3D test: 70.2 (MF-MOS) vs 64.9 (MambaMOS).

  These differences likely reflect different variants (number of residual frames, semantics, delayed / Bayes-filter output, extra KITTI-Road data). The variant must be named whenever a number is quoted — [MF-MOS](https://arxiv.org/html/2401.17023v1); [MambaMOS](https://arxiv.org/html/2404.12794v1)
- Search-result snippets indicate that some later MOS papers (e.g. CV-MOS, KDMOS) add distance-binned tables with IoU, Recall and Precision. The main benchmark remains IoU-only. These tables were not verified — [CV-MOS arXiv 2408.13790](https://arxiv.org/html/2408.13790v1), [KDMOS arXiv 2506.14130](https://arxiv.org/html/2506.14130)
- A learning-free MOS method, HMM-MOS, reports IoU on other datasets only: Sipailou 86.1 test; Apollo about 76 val (MapMOS 79.2); DOALS 88.7 vs Dynablox 87.3. None on SemanticKITTI seq 08 — [GitHub vb44/HMM-MOS](https://github.com/vb44/HMM-MOS)

### Inferences
- Convert the project's P/R to the standard metric: IoU = 1/(1/P + 1/R - 1) = 1/(1/0.616 + 1/0.4765 - 1) = **about 36.7%**. This holds only if P and R are micro-averaged over the same point set.
- That 36.7% lies above LMNet's own published non-learned baselines (Residual+RG+Semantics 20.6, SceneFlow+Semantics 28.7, both test). It is well below learned MOS (val about 60-86). Those baselines are test-set numbers on the full benchmark, so the comparison is indicative only. The project's result is on 50 frames of seq 08 and needs to be re-run with `evaluate_mos.py` over all of seq 08 (val labels 251-259 moving) to be comparable.
- Recommend reporting IoU_MOS (plus P/R as secondary) to align with the literature.

### Gaps
- Exact original-paper val numbers for 4DMOS, InsMOS, MapMOS and MotionSeg3D were not fetched directly from each paper/repo (only via secondary comparison tables). MapMOS's 86.1 val vs 66.0 test gap was not explained in the sources read.
- No published precision/recall pair for a simple range-image-disparity baseline on seq 08 was found.

## Q5. Dynamic point removal for static maps: ERASOR, Removert, DUFOMap, BeautyMap, OctoMap; DynamicMap_Benchmark metrics and typical numbers

### Takeaway
The DynamicMap_Benchmark (Zhang et al., ITSC 2023, KTH-RPL) standardizes point-level **SA (static accuracy, the fraction of static points preserved)**, **DA (dynamic accuracy, the fraction of dynamic points removed)** and **AA = sqrt(SA x DA)**. On KITTI seq 00, typical numbers are Removert SA 99.4 / DA 41.5, ERASOR SA 66.7 / DA 98.5 and OctoMap SA 68.1 / DA 99.7, while DUFOMap balances both at about 98 / 99 (AA 98.3).

### Cited Findings
- The benchmark includes:
  - online methods: DUFOMap (RAL'24), Octomap w/ GF (ITSC'23), dynablox (RAL'23), Octomap;
  - learning-based: DeFlow (ICRA'24);
  - offline/prior-map methods: BeautyMap (RAL'24), ERASOR (RAL'21), Removert (IROS'20).

  Datasets: Semantic-KITTI (VLP-64), Argoverse 2.0 (VLP-32), UDI-Plane (VLP-16), KTH-Campus (Leica RTC360), Indoor-Floor (Livox mid-360) — [GitHub KTH-RPL/DynamicMap_Benchmark](https://github.com/KTH-RPL/DynamicMap_Benchmark)
- Citation: Zhang, Duberg, Geng, Jia, Wang, Jensfelt, "A Dynamic Points Removal Benchmark in Point Cloud Maps," IEEE ITSC 2023, arXiv 2307.07260 — [arXiv 2307.07260](https://arxiv.org/abs/2307.07260); [DynamicMap_Benchmark](https://github.com/KTH-RPL/DynamicMap_Benchmark)
- Metric definitions (DUFOMap paper): SA is the "proportion of correctly labeled static points." DA is the "proportion of correctly labeled dynamic points." AA = sqrt(SA x DA) is "sensitive to doing well on both SA and DA" — [DUFOMap arXiv 2403.01449](https://arxiv.org/html/2403.01449)
- DUFOMap Table I (SA / DA / AA, %):

  | Dataset | Method | SA | DA | AA |
  |---|---|---|---|---|
  | KITTI 00 | Removert | 99.44 | 41.53 | 64.26 |
  | KITTI 00 | ERASOR | 66.70 | 98.54 | 81.07 |
  | KITTI 00 | OctoMap | 68.05 | 99.69 | 82.37 |
  | KITTI 00 | **DUFOMap** | **97.96** | **98.72** | **98.34** |
  | KITTI 01 | Removert | 97.81 | 39.56 | 62.20 |
  | KITTI 01 | ERASOR | 98.12 | 90.94 | 94.46 |
  | KITTI 01 | DUFOMap | 98.09 | 94.20 | 96.12 |
  | Argoverse 2 | ERASOR | 77.51 | 99.18 | 87.68 |
  | Argoverse 2 | DUFOMap | 96.67 | 88.90 | 92.70 |
  | Semi-indoor | OctoMap | 88.97 | 82.18 | 85.51 |
  | Semi-indoor | DUFOMap | 99.64 | 83.00 | 90.94 |

  Source: [DUFOMap arXiv 2403.01449](https://arxiv.org/html/2403.01449). Rows for other methods (Dynablox, OctoMap w/ GF, BeautyMap) may exist in the full table but were not returned by the extraction.

### Inferences
- Classic trade-off: conservative methods (Removert) preserve static structure but miss dynamics. Aggressive ones (ERASOR, OctoMap ray-casting) remove dynamics but erode static ground and walls. A good modern method reaches over 95% on both on KITTI 00.
- If LiMap does map-level dynamic removal, it should report SA/DA/AA on SemanticKITTI seq 00 or 05 using the benchmark's eval scripts, to compare directly with these numbers. The project's per-scan MOS P/R is a different (scan-level) task.

### Gaps
- BeautyMap, Dynablox and OctoMap w/ GF numbers, and ERASOR's original "Preservation Rate / Rejection Rate" (PR/RR) numbers on seqs 00/01/02/05/07, were not retrieved. The benchmark paper's own result tables were not retrieved either: the arXiv abstract page has no tables, and the README has none.

## Q6. RELLIS-3D LiDAR segmentation baselines, GOOSE, off-road SOTA

### Takeaway
Off-road LiDAR segmentation is much harder than SemanticKITTI. On RELLIS-3D, SalsaNext reaches about 40-43% mIoU and KPConv about 19%. Cylinder3D reaches about 46%, and networks lose 13-24 mIoU points versus SemanticKITTI. On GOOSE, PTv3 baselines score roughly 60-80% mIoU depending on platform. RELLIS-3D is also CC BY-NC-SA (non-commercial).

### Cited Findings
- The RELLIS-3D official benchmark gives **SalsaNext mIoU 40.20%**. Per class: grass 64.74, tree 79.04, bush 72.90, concrete 75.27; mud 9.58, puddle 23.20, rubble 5.01, water 0.00. **KPConv mIoU 18.64%**, with person 81.20 and many classes at 0.00 — [GitHub unmannedlab/RELLIS-3D](https://github.com/unmannedlab/RELLIS-3D)
- RELLIS-3D has 13,556 LiDAR scans and 6,235 images, a 20-class ontology, and SemanticKITTI-format labels (Ouster 64-ch and Velodyne 32-ch). License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 — [GitHub RELLIS-3D](https://github.com/unmannedlab/RELLIS-3D); paper [arXiv 2011.12954](https://arxiv.org/pdf/2011.12954)
- A 2024 comparison study reports Cylinder3D 46.07 mIoU vs SalsaNext 43.07 on RELLIS-3D. All four networks performed 13.0-24.2 points worse on RELLIS-3D than on SemanticKITTI. All except Cylinder3D failed on the Vehicle class. The SalsaNext figure differs from the official 40.20 — [Springer, Int. J. Intelligent Robotics & Applications 2024](https://link.springer.com/article/10.1007/s41315-024-00376-5) (via search summary; full text not fetched)
- GOOSE: 10,000 annotated image + LiDAR pairs with 64 classes in unstructured outdoor settings — [GOOSE arXiv 2310.16788](https://arxiv.org/html/2310.16788)
- GOOSE 3D challenge (ICRA 2025): PTv3 baseline mIoU 0.7968 (off-road vehicle), 0.7113 (quadruped), 0.6040 (Liebherr R924 excavator). One approach reached 0.848 mIoU on the official GOOSE test set, with gains up to 22.59 points on hard platforms — [arXiv 2506.06995](https://arxiv.org/pdf/2506.06995) (numbers from a search-result summary; not verified against the PDF)
- A related study, "Analysis of LiDAR Configurations on Off-road Semantic Segmentation Performance," exists — [arXiv 2306.16551](https://arxiv.org/html/2306.16551) (not fetched)

### Inferences
- If LiMap targets off-road or Indian terrain, a SemanticKITTI-trained SalsaNext should be expected to degrade substantially, given the 13-24 point drop between datasets. Domain-specific fine-tuning (RELLIS-3D/GOOSE-style data) would be needed. Both datasets carry NC licenses, so a defence deployment would need its own labelled data.

### Gaps
- No verified post-2023 RELLIS-3D LiDAR SOTA table (e.g. PTv3 or FRNet on RELLIS) was found. The GOOSE numbers come from search-result summaries rather than a fetched PDF.
