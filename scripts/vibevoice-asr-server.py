#!/usr/bin/env python
"""
VibeVoice-ASR diarization server for Umbra OS.

Loads microsoft/VibeVoice-ASR once and keeps it resident so meeting audio can
be transcribed chunk-by-chunk without re-loading the model (7B) every time.
The model jointly performs ASR + speaker diarization + timestamping, returning
"who said what and when".

Endpoints:
  GET  /health      -> {"ok": bool, "model": str, "device": str}
  POST /transcribe  -> multipart: "audio" (wav/mp3/...), "context" (hotwords)
                       -> {"segments": [{speaker_id, start_time, end_time, text}],
                           "raw_text": str}

Run via `npm run vibevoice:asr-server` (scripts/vibevoice-asr-server.sh), which
activates the VibeVoice venv and launches this script. Model weights are
downloaded from Hugging Face on first load (~17 GB — a GPU is recommended);
pre-download them with `npm run vibevoice:asr-download`.
"""
import argparse
import json
import os
import sys
import tempfile
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1] / "external" / "VibeVoice"
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "demo"))

from fastapi import FastAPI, File, Form, UploadFile  # noqa: E402
import uvicorn  # noqa: E402

app = FastAPI(title="VibeVoice-ASR for Umbra OS")

STATE = {
    "model_path": "microsoft/VibeVoice-ASR",
    "device": "auto",
    "max_new_tokens": 4096,
    "loaded": False,
    "processor": None,
    "model": None,
    "run_device": "auto",
}


def fallback_normalize(raw_text: str):
    """Parse segments even if the official post-processor missed them."""
    try:
        m = re.search(r"\[.*\]", raw_text, re.S)
        text = m.group(0) if m else raw_text
        data = json.loads(text)
    except Exception:
        return []
    if isinstance(data, dict):
        data = [data]

    def pick(item, *keys):
        for k in keys:
            if k in item and item[k] not in (None, ""):
                return item[k]
        return None

    out = []
    for item in data:
        if not isinstance(item, dict):
            continue
        seg = {
            "speaker_id": pick(item, "speaker_id", "Speaker ID", "Speaker", "speaker"),
            "start_time": pick(item, "start_time", "Start time", "Start", "start"),
            "end_time": pick(item, "end_time", "End time", "End", "end"),
            "text": pick(item, "text", "Content", "content"),
        }
        if seg["text"] is not None:
            out.append(seg)
    return out


def load_model():
    import torch
    from vibevoice.modular.modeling_vibevoice_asr import VibeVoiceASRForConditionalGeneration
    from vibevoice.processor.vibevoice_asr_processor import VibeVoiceASRProcessor

    print(f"[vibevoice-asr] loading processor + model from {STATE['model_path']}", flush=True)
    processor = VibeVoiceASRProcessor.from_pretrained(
        STATE["model_path"], language_model_pretrained_name="Qwen/Qwen2.5-7B"
    )
    device = STATE["device"]
    # bf16 halves memory on CPU too (7B model: ~17 GB fp32 vs ~8.6 GB bf16)
    dtype = torch.bfloat16 if device in ("cuda", "cpu") else torch.float32
    model = VibeVoiceASRForConditionalGeneration.from_pretrained(
        STATE["model_path"],
        torch_dtype=dtype,
        device_map=device if device == "auto" else None,
        attn_implementation="sdpa",
        trust_remote_code=True,
    )
    if device != "auto":
        model = model.to(device)
    model.eval()
    run_device = device if device != "auto" else str(next(model.parameters()).device)
    print(f"[vibevoice-asr] model loaded on {run_device}", flush=True)
    return processor, model, run_device


def transcribe_file(audio_path: str, context: str):
    import torch

    processor = STATE["processor"]
    model = STATE["model"]
    device = STATE["run_device"]

    inputs = processor(
        audio=audio_path,
        sampling_rate=None,
        return_tensors="pt",
        add_generation_prompt=True,
        context_info=(context or ""),
    )
    inputs = {k: v.to(device) if isinstance(v, torch.Tensor) else v for k, v in inputs.items()}

    gen = {
        "max_new_tokens": STATE["max_new_tokens"],
        "do_sample": False,
        "num_beams": 1,
        "pad_token_id": processor.pad_id,
        "eos_token_id": processor.tokenizer.eos_token_id,
    }
    with torch.no_grad():
        output_ids = model.generate(**inputs, **gen)

    generated_ids = output_ids[0, inputs["input_ids"].shape[1]:]
    raw_text = processor.decode(generated_ids, skip_special_tokens=True)
    segments = processor.post_process_transcription(raw_text)
    if not segments:
        segments = fallback_normalize(raw_text)
    return raw_text, segments


@app.get("/health")
def health():
    return {
        "ok": STATE["loaded"],
        "model": STATE["model_path"],
        "device": STATE["run_device"] if STATE["loaded"] else STATE["device"],
    }


@app.post("/transcribe")
async def transcribe_endpoint(audio: UploadFile = File(...), context: str = Form("")):
    if not STATE["loaded"]:
        return {"error": "model not loaded yet"}

    suffix = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(await audio.read())
        raw_text, segments = transcribe_file(tmp_path, context or "")
        return {"segments": segments, "raw_text": raw_text}
    except Exception as e:
        return {"error": str(e)[:500]}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def main():
    parser = argparse.ArgumentParser(description="VibeVoice-ASR diarization server for Umbra")
    parser.add_argument("--model_path", default="microsoft/VibeVoice-ASR")
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu", "mps", "xpu"])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=17500)
    parser.add_argument("--max_new_tokens", type=int, default=4096)
    args = parser.parse_args()

    STATE["model_path"] = args.model_path
    STATE["device"] = args.device
    STATE["max_new_tokens"] = args.max_new_tokens

    STATE["processor"], STATE["model"], STATE["run_device"] = load_model()
    STATE["loaded"] = True

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
