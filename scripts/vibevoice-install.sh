#!/usr/bin/env bash
# Set up Microsoft VibeVoice (cloned at external/VibeVoice) in a local venv.
#
#   npm run vibevoice:install
#
# Requirements: Python 3.10+ (with a GPU strongly recommended — torch + CUDA).
# The model weights (microsoft/VibeVoice-Realtime-0.5B, ~2 GB) are downloaded
# from Hugging Face the first time Umbra synthesizes speech, not here.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/../external/VibeVoice"

if [ ! -d "$REPO_DIR" ]; then
  echo "[ERROR] VibeVoice repo not found at $REPO_DIR"
  echo "        Clone it first: git clone https://github.com/microsoft/VibeVoice.git external/VibeVoice"
  exit 1
fi

cd "$REPO_DIR"

if [ ! -d .venv ]; then
  echo "[INFO] Creating Python venv..."
  python -m venv .venv
fi

if [ -f .venv/Scripts/activate ]; then
  # shellcheck disable=SC1091
  source .venv/Scripts/activate
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

echo "[INFO] Upgrading pip..."
pip install --upgrade pip

echo "[INFO] Installing VibeVoice (+ torch, transformers, diffusers)... this can take a while"
pip install -e ".[streamingtts]"

echo ""
echo "[SUCCESS] VibeVoice installed."
echo "         Optional: more experimental speakers →  bash demo/download_experimental_voices.sh"
echo "         Then set meeting.tts = \"vibevoice\" (or call POST /api/voice/speak) and start Umbra."
