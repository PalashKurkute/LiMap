"""Verifies SalsaNext ONNX model weights and data checksums against metadata.json.

Ensures cryptographic provenance and data integrity for deep neural network models.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent


def compute_sha256(file_path: Path) -> str:
    """Computes SHA-256 hash of a file efficiently in 64KB blocks."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest().lower()


def verify_model_provenance(model_dir: Path | None = None) -> bool:
    target_dir = model_dir or (REPO_ROOT / "models" / "salsanext-onnx-float")
    metadata_file = target_dir / "metadata.json"

    if not metadata_file.exists():
        print(f"[FAIL] Missing metadata.json in {target_dir}")
        return False

    with open(metadata_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    expected_checksums = meta.get("sha256_checksums", {})
    if not expected_checksums:
        print("[FAIL] No sha256_checksums entry found in metadata.json")
        return False

    print(f"[*] Verifying cryptographic provenance in {target_dir}...")
    all_ok = True

    for filename, expected_hash in expected_checksums.items():
        file_path = target_dir / filename
        if not file_path.exists():
            print(f"  [MISSING] {filename} does not exist!")
            all_ok = False
            continue

        actual_hash = compute_sha256(file_path)
        if actual_hash == expected_hash.lower():
            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            print(f"  [VERIFIED] {filename} ({file_size_mb:.2f} MB): SHA256 matches ({actual_hash[:16]}...)")
        else:
            print(f"  [MISMATCH] {filename}:")
            print(f"    Expected: {expected_hash}")
            print(f"    Actual:   {actual_hash}")
            all_ok = False

    if all_ok:
        print("[+] Model provenance successfully verified against cryptographic checksums.")
    return all_ok


if __name__ == "__main__":
    success = verify_model_provenance()
    sys.exit(0 if success else 1)
