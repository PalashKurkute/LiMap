/**
 * Architectural constants of the FoveaGrid pool. These are fixed by design
 * (see core/grid/baselines.py), so they are the ONLY numbers allowed as literals.
 * Everything measured or benchmarked must come from an API response or results file.
 */
export const POOL_CAPACITY_CELLS = 106_875;
export const CELL_BYTES = 32;
/** Pool footprint in MB, computed (not typed): capacity x cell size. */
export const POOL_MB = (POOL_CAPACITY_CELLS * CELL_BYTES) / (1024 * 1024);
