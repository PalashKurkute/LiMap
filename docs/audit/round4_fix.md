# FoveaGrid 2.5D — Round 4 Fix Record (Contradiction & Drift Removal)

## 1. The Contradiction Identified
During the fourth audit pass, a numerical contradiction regarding the **memory compression ratio** was discovered:
- **936.1x**: Appeared in `benchmark/evaluate_real_regret.py`, `benchmark/real_regret_results.json`, `KNOWN_LIMITATIONS.md`, and parts of `BENCHMARK_REPORT.md`.
- **935.7x**: Appeared in `edge_hardware_profile.json`, `docs/competitive_matrix.md`, `dashboard/client/src/components/MemoryMeter.tsx`, and other parts of `BENCHMARK_REPORT.md`.

In addition, the JSON keys in `evaluate_real_regret.py` were not renamed to end with `_calculated` as previously planned.

## 2. Establishing the Single Source of Truth
The contradiction stemmed from how the FoveaGrid 2.5D preallocated pool size in megabytes was calculated:
- **Formula:** 106,875 cells $\times$ 32 bytes/cell = **3,420,000 bytes**.
- **MB Conversion:** 3,420,000 / (1024 $\times$ 1024) = **3.261566... MB**.
- **Derived Ratio:** 3051.8 MB (Dense 3D) / 3.2616 MB = 935.67...x $\to$ **935.7x**.

The `936.1x` figure was the result of artificially truncating the pool size to exactly `3.26 MB` early in the math ($3051.8 / 3.26 = 936.13...x$). Thus, **3.2616 MB** and the derived **935.7x** are the mathematically precise, correct values.

## 3. What Was Changed (The Fix)
Rather than manually typing 935.7x over all occurrences of 936.1x, the drift was fixed at the source:
1. **`core/grid/baselines.py`**: Changed `foveagrid_mb` rounding from 2 to 4 decimal places so it perfectly returns `3.2616` instead of `3.26`. The ratio natively evaluates to `935.7x`.
2. **`benchmark/generate_report.py`**: Replaced the hardcoded `935.7x` string in the markdown template with the dynamic `{baselines.reduction_vs_3d}x`, and updated formatting to `{baselines.foveagrid_25d_mb:.4f}` to correctly print `3.2616 MB`.
3. **`benchmark/evaluate_real_regret.py`**: 
   - Replaced the hardcoded `3.26` MB with `3.2616` MB.
   - Computes the ratio dynamically via `round(float(3051.8 / 3.2616), 1)` instead of hardcoding `936.1`.
   - Renamed output JSON keys exactly as requested: `memory_dense_3d_mb_calculated`, `memory_foveagrid_25d_mb_calculated`, and `memory_compression_ratio_calculated`.
4. **`dashboard/client/src/components/MemoryMeter.tsx`**: Updated the fallback `heapMb` from `3.26` to the precise `3.2616`.
5. **`KNOWN_LIMITATIONS.md` / `docs/competitive_matrix.md`**: Updated the static text to reflect `3.2616 MB` and `935.7x` exclusively.
6. **Regeneration:** Ran `python benchmark/generate_report.py` and `python benchmark/evaluate_real_regret.py --frames 0 5 10` to automatically flow the new precise variables into `BENCHMARK_REPORT.md` and `real_regret_results.json`.

## 4. Verification (Grep Results)
A full repository grep verifies the complete eradication of `936.1`:
- `grep "936.1"`: Matches only in historical audit/planning markdown logs (`third_follow_up_audit.md`, `second_follow_up_audit.md`, `implementation_plan_round3.md`). Zero matches in actual code, dashboards, or live documentation.
- `grep "935.7"`: Matches correctly in all live display surfaces:
  - `benchmark/BENCHMARK_REPORT.md` (Lines 13, 27, 87)
  - `benchmark/edge_hardware_profile.json` (Line 25 equivalence)
  - `docs/competitive_matrix.md` (Line 51)
  - `KNOWN_LIMITATIONS.md` (Line 88)
  - `dashboard/client/src/components/MemoryMeter.tsx` (Line 12)
  - `benchmark/real_regret_results.json` (Line 10)

The contradiction is permanently eliminated, and the math is provably derived.
