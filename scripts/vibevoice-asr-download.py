#!/usr/bin/env python
"""
Download microsoft/VibeVoice-ASR to the local Hugging Face cache.

Why this exists: the model is ~17 GB across 8 safetensors shards. The default
parallel downloader stalls on some connections, and a single stalled worker
can silently hang the whole fetch. This script downloads every required file
*sequentially* with hf_hub_download, which resumes from ``.incomplete`` blobs,
so it can be killed and re-run safely (Ctrl-C, session restarts, etc.).

Run from the VibeVoice venv:

    cd external/VibeVoice
    ./.venv/Scripts/python.exe ../../scripts/vibevoice-asr-download.py

When it prints "DONE", the model is cached and `npm run vibevoice:asr-server`
will load it without re-downloading.
"""
import os
import sys
import time

from huggingface_hub import hf_hub_download

REPO = "microsoft/VibeVoice-ASR"

# Order matters: config + index first (cheap, needed to even know the shards),
# then shards largest-last so the most likely-to-be-interrupted work resumes.
FILES = [
    "config.json",
    "model.safetensors.index.json",
    "model-00001-of-00008.safetensors",
    "model-00002-of-00008.safetensors",
    "model-00003-of-00008.safetensors",
    "model-00004-of-00008.safetensors",
    "model-00005-of-00008.safetensors",
    "model-00006-of-00008.safetensors",
    "model-00007-of-00008.safetensors",
    "model-00008-of-00008.safetensors",
]


def main() -> int:
    start = time.time()
    for i, fname in enumerate(FILES, 1):
        t0 = time.time()
        try:
            path = hf_hub_download(REPO, fname)
        except KeyboardInterrupt:
            print(f"[{i}/{len(FILES)}] interrupted during {fname} — resume by re-running", flush=True)
            return 130
        mb = os.path.getsize(path) / 1e6
        print(f"[{i}/{len(FILES)}] {fname}: {mb:.0f} MB in {time.time()-t0:.0f}s", flush=True)

    print(f"DONE: all {len(FILES)} files cached in {time.time()-start:.0f}s", flush=True)
    print("The model is now cached under the Hugging Face cache dir; ", flush=True)
    print(f"`npm run vibevoice:asr-server` will load {REPO} without re-downloading.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
