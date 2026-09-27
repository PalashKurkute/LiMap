"""Downloads data_odometry_labels.zip and extracts sequence 08 labels into data/real/sequences/08/labels.
"""

import io
from pathlib import Path
import time
import urllib.request
import zipfile

URL = "http://semantic-kitti.org/assets/data_odometry_labels.zip"
DEST_DIR = Path("data/real/sequences/08/labels")


def download_and_extract_seq08_labels():
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    existing_labels = list(DEST_DIR.glob("*.label"))
    if len(existing_labels) >= 500:
        print(f"[*] Sequence 08 labels already present: {len(existing_labels)} files found.")
        return

    print(f"[*] Connecting to {URL}...")
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=60) as resp:
        content_len = int(resp.headers.get("Content-Length", 0))
        print(f"[*] Total archive size: {content_len / (1024 * 1024):.2f} MB")
        
        # Read with progress
        chunks = []
        downloaded = 0
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
            downloaded += len(chunk)
            if downloaded % (20 * 1024 * 1024) == 0 or downloaded == content_len:
                pct = (downloaded / content_len) * 100 if content_len else 0
                mb = downloaded / (1024 * 1024)
                print(f"  Downloaded: {mb:.1f} MB ({pct:.1f}%)")

    raw_bytes = b"".join(chunks)
    print(f"[*] Download completed in {time.time() - t0:.1f}s. Extracting sequence 08...")

    extracted = 0
    with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
        for info in z.infolist():
            # Match 08/labels/XXXXXX.label (could be dataset/sequences/08/labels/ or sequences/08/labels/)
            parts = Path(info.filename).parts
            if "08" in parts and "labels" in parts and info.filename.endswith(".label"):
                fname = parts[-1]
                target_file = DEST_DIR / fname
                target_file.write_bytes(z.read(info))
                extracted += 1

    print(f"[+] Successfully extracted {extracted} sequence 08 label files to {DEST_DIR.resolve()}")


if __name__ == "__main__":
    download_and_extract_seq08_labels()
