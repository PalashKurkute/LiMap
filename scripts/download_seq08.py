"""High-Throughput Downloader for SemanticKITTI Sequence 08 from Kaggle.
Downloads only sequence 08 velodyne frames directly using parallel workers.
Verifies initial frames first, then auto-progresses through all 4,071 frames.
"""

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import numpy as np
from kaggle.api.kaggle_api_extended import KaggleApi

DATASET_SLUG = "hbenallal/semantickitti"
TOTAL_SEQ08_FRAMES = 4071

def verify_frame(file_path: Path) -> bool:
    """Verifies that the downloaded .bin file is non-empty and contains float32 4-tuples."""
    if not file_path.exists():
        return False
    size = file_path.stat().st_size
    if size < 100_000 or size % 16 != 0:
        return False
    try:
        pts = np.fromfile(str(file_path), dtype=np.float32).reshape(-1, 4)
        return pts.shape[0] > 1000
    except Exception:
        return False

def download_single_frame(idx: int, dest_dir: Path, api: KaggleApi, max_retries: int = 5) -> tuple[int, bool]:
    filename = f"{idx:06d}.bin"
    remote_path = f"dataset/sequences/08/velodyne/{filename}"
    local_file = dest_dir / filename

    if verify_frame(local_file):
        return idx, True

    for attempt in range(max_retries):
        try:
            api.dataset_download_file(
                dataset=DATASET_SLUG,
                file_name=remote_path,
                path=str(dest_dir),
                force=False,
                quiet=True,
            )
            if verify_frame(local_file):
                return idx, True
        except Exception as e:
            if "429" in str(e):
                backoff = (2 ** attempt) * 1.5
                time.sleep(backoff)
            else:
                time.sleep(0.5)

    return idx, False

def download_seq08(workers: int = 4, test_count: int = 5, target_frames: int = TOTAL_SEQ08_FRAMES, dest_str: str = "data/real/sequences/08/velodyne"):
    dest = Path(dest_str)
    dest.mkdir(parents=True, exist_ok=True)

    print(f"[*] Destination: {dest.resolve()}")
    print(f"[*] Step 1: Validating initial {test_count} frames...")

    # Authenticate main API
    main_api = KaggleApi()
    main_api.authenticate()

    # Step 1: Test first few frames
    test_failed = False
    for i in range(test_count):
        _, ok = download_single_frame(i, dest, main_api)
        if not ok:
            print(f"[ERROR] Verification failed for test frame {i:06d}.bin", file=sys.stderr)
            test_failed = True
            break
        print(f"  [OK] Verified frame {i:06d}.bin ({dest.joinpath(f'{i:06d}.bin').stat().st_size / 1024 / 1024:.2f} MB)")

    if test_failed:
        print("[!] Aborting full sequence download due to initial frame verification failure.")
        sys.exit(1)

    print(f"\n[+] SUCCESS: Initial {test_count} frames verified! Proceeding with full Sequence 08 ({target_frames} frames)...")
    print(f"[*] Spawning {workers} parallel download workers...\n")

    start_time = time.time()
    completed = 0
    failed = 0

    # Thread-local API instances
    def worker_task(idx):
        api = KaggleApi()
        api.authenticate()
        return download_single_frame(idx, dest, api)

    remaining_indices = [i for i in range(target_frames)]

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(worker_task, idx): idx for idx in remaining_indices}

        for future in as_completed(futures):
            idx, ok = future.result()
            if ok:
                completed += 1
            else:
                failed += 1

            total_done = completed + failed
            if total_done % 50 == 0 or total_done == target_frames:
                elapsed = time.time() - start_time
                fps = total_done / max(elapsed, 0.001)
                pct = (total_done / target_frames) * 100
                print(f"  [{total_done:4d}/{target_frames}] ({pct:5.1f}%) | Speed: {fps:.1f} frames/sec | Elapsed: {elapsed:.0f}s | Failed: {failed}")

    total_time = time.time() - start_time
    print(f"\n[+] Sequence 08 download finished in {total_time:.1f}s: {completed} successful, {failed} failed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parallel Downloader for SemanticKITTI Sequence 08")
    parser.add_argument("--workers", type=int, default=8, help="Number of concurrent download threads (default: 8)")
    parser.add_argument("--test-frames", type=int, default=5, help="Number of initial frames to verify before full run")
    parser.add_argument("--total-frames", type=int, default=TOTAL_SEQ08_FRAMES, help="Total frames to download (default 4071)")
    args = parser.parse_args()

    download_seq08(workers=args.workers, test_count=args.test_frames, target_frames=args.total_frames)
