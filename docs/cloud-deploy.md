# Cloud deployment (always-on Umbra)

The cloud server runs Umbra's **headless core** — API, agent loop, MCP
connectors, persistent memory, model routing/billing, and image generation —
so work continues even when the user's PC is off. Desktop control
(mouse/keyboard/OCR/real-app driving) still needs the Windows machine.

## Cost targets

| Plan | Cloud budget | Server size | Provider (approx) |
|---|---|---|---|
| Pro (€19) | **≤ $4/mo** | 2 vCPU / 4 GB | Hetzner CX22 (~€3.79) |
| Ultimate (€38) | **≤ $8–9/mo** | 4 vCPU / 8 GB | Hetzner CX32 or CPX21 (~€7–9) |

The $4 / $8–9 is the *server* cost and is separate from the $5 / $10 token
budget the plan already assigns to models.

## Execution model: PC-first, cloud as fallback

- **PC on (role `desktop`)**: Umbra runs everything locally — real desktop
  control, screen reading, browser, the full agent loop. This is the default
  and costs the cloud nothing.
- **PC off**: the cloud node (role `cloud`, `UMBRA_HEADLESS=1`) resumes any
  **in-flight tasks** the PC left behind, then serves new API-submitted tasks.
- The task queue is persisted to `<dataDir>/task-queue/` (`TaskStore`) and
  checkpointed after every step, so a task that was mid-execution on the PC
  continues from the exact step where it stopped — no re-planning, no redoing
  finished steps.

## Cloud continuation is a paid feature

- `desktop` always resumes its own local queue (free users included — it's
  their own machine).
- `cloud` only resumes when the plan is **paid** (`pro` / `ultimate` / `byok`).
  On `free`, in-flight tasks are left queued on disk and are *not* run on the
  cloud. `POST /api/plan/activate` flips `plan.cloudContinuation` accordingly.

### Sharing the queue across nodes (hybrid handoff)

The desktop and cloud nodes resume each other's tasks when they can see the
same `task-queue/` directory. Two supported setups:

1. **Shared volume**: point both nodes' `~/.umbra` (or just `task-queue/`) at
   the same NFS/object-store path (the Docker volume `umbra-data:/root/.umbra`
   already isolates it for backup/sync).
2. **One-way sync**: sync the PC's `~/.umbra/task-queue/` and `recall.db` up
   to the cloud (rclone/Syncthing). The cloud resumes what the PC checkpointed
   before it went offline.

## Headless mode (what the cloud skips)

`UMBRA_HEADLESS=1` (or `UMBRA_ROLE=cloud`) disables the Windows-native /
screen-bound subsystems so the Linux box boots only the core:

- Activity watcher (screen polling + OCR), screen reader, live shadowing
- Real desktop control (RealDesktop2), agent Chrome (CDP), browser-use bridge
- Preview streamer, Command HUD, P2P/PWA phone control plane

Kept on the cloud: API server, agent loop + durable task queue, MCP registry,
vector memory, model routing/billing, Graphify/Caveman, image generation, and
the built-in reasoning-engine delegation.

## Deploy

```bash
# one-time: install Docker + docker compose on the VPS, then
HOST=user@your-vps ./scripts/deploy.sh
```

The `umbra-data` volume holds `~/.umbra` (config, recall DB, vault, task
queue, logs) so state survives restarts. Secrets live in the volume's
`config.json` / `vault.bin`, never in the image.

## Device mesh (phone + PC always connected)

The cloud also runs a **DeviceHub** (WebSocket on port 8788) that every device
stays connected to:

1. **Join once** — phone scans a QR, or the PC opens a link
   (`GET /api/devices/invite` → code → `POST /api/devices/join`). The hub
   returns a long-lived token.
2. **Auto-reconnect forever** — each device runs a `DeviceClient` that
   reconnects with backoff and re-authenticates with its token, so the mesh
   survives network drops and hub restarts without re-pairing. The registry
   persists to the `umbra-data` volume.
3. **Control from the phone** — the phone submits tasks (`POST /api/task`) to
   the cloud, or relays a `cmd` through the hub to the desktop (the desktop
   executes it via real-desktop control and relays the result back).

Desktop → cloud join (one-time, then automatic):
```bash
UMBRA_API_URL=https://umbra.example.com \
UMBRA_HUB_URL=wss://umbra.example.com/device-ws \
node -e "os.joinRemoteHub('CODE')"
```

Set `UMBRA_PUBLIC_URL` on the cloud so QR/link payloads point at your domain.
For production, terminate TLS at a reverse proxy (wss for the hub) — the
WebRTC/TURN story for real-time video is still a follow-up; until then the
hub relays encrypted control messages and JPEG frames.

## Voice-to-text (whisper.cpp)

Free, private, unlimited STT on the cloud server:

```bash
MODEL=medium.en ./scripts/download-whisper-model.sh   # downloads to ./models
docker compose up whisper                            # serves :8080
```

Then set in the cloud's config: `voice.enabled = true`,
`voice.sttProvider = "whisper-local"`,
`voice.sttEndpoint = "http://whisper:8080"`.

Model accuracy vs RAM (bigger = fewer missed words):

| Model | Disk | RAM | Accuracy |
|---|---|---|---|
| tiny | 75 MB | ~273 MB | misses words (demo) |
| base | 142 MB | ~388 MB | ok, clear speech |
| small | 466 MB | ~852 MB | good |
| **medium** | 1.5 GB | ~2.1 GB | **strong — recommended** |
| large-v3 | 2.9 GB | ~3.9 GB | best |

Pick **medium.en** on the 8 GB box (or small.en on 4 GB). The app sends
greedy decoding (`temperature=0`) and, when you pass `language`/`prompt`,
biases the transcript — these are what stop whisper.cpp from dropping words.

## Concurrency (how many agents at once)

A "concurrent agent" is one in-flight task holding a metering session. The
plan sets the ceiling:

| Plan | Concurrent tasks |
|---|---|
| Free | 1 |
| BYOK | 2 |
| Pro | 8 |
| Ultimate | unbounded (RAM/CPU-bound) |

On a **4 GB** box the Pro ceiling of 8 concurrent tasks is comfortable —
each task is ~10–25 MB of Node heap (LLM inference happens on external APIs),
and the whole headless core idles around 300–500 MB. An **8 GB** box adds
headroom for more concurrency or a small local 7B free model (~4–6 GB) as the
spillover tier instead of OpenRouter.
