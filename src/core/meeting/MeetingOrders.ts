/**
 * MeetingOrders — turns the live meeting transcript into executable "orders".
 *
 * While Umbra attends a meeting it transcribes the audio. Whenever someone
 * addresses the assistant (e.g. "Hey Umbra, share your screen" or
 * "Ok Umbra, take a note about the deadline"), the transcript chunk is
 * classified into an intent and handed to the MeetingCompanion, which executes
 * it like a normal user would — share the screen, take a note, look something
 * up, set a reminder, or run a desktop action.
 *
 * Orders are trigger-gated by default: a chunk is only treated as an order if
 * it is explicitly addressed to the assistant. This keeps ordinary meeting
 * chatter ("can you share your screen, Bob?") from being mis-executed.
 */
import { TranscriptSegment } from './MeetingAgent';

export type MeetingOrderIntent =
  | 'share_screen'
  | 'stop_share'
  | 'note'
  | 'search'
  | 'reminder'
  | 'say'
  | 'execute';

export interface MeetingOrder {
  id: string;
  intent: MeetingOrderIntent;
  /** The original transcript text that triggered this order. */
  raw: string;
  /** The payload after the trigger phrase (what to actually do). */
  text: string;
  speaker: string;
  atMs: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
  error?: string;
}

/** "Hey Umbra, ..." / "Ok assistant ..." etc. Requires an explicit address. */
const TRIGGER = /(?:^|[,.!?;:]\s*)(?:(?:hey|ok|okay|yo|oi)\s+)?(?:umbra|assistant)[,:]?\s+/i;

const SHARE = /(?:share|present|show)\s*(?:your|my|the)?\s*(?:screen|desktop|window|display)/i;
const STOP_SHARE = /(?:stop|end|finish)\s*(?:sharing|presenting|the\s*share|share)/i;
const NOTE = /(?:take\s+a\s+note|note\s+down|note\s+this|write\s+down|jot\s+down|remember\s+(?:that|to|this))/i;
const SEARCH = /(?:search|look\s+up|google|find\s+(?:me|out)|check\s+the\s+web)/i;
const REMINDER = /(?:remind\s+(?:me|us)|set\s+a\s+reminder)/i;
const SAY = /^(?:say|tell\s+(?:the\s+meeting|everyone|them)|announce|speak)\b/i;

/** Classify a payload (already stripped of the trigger) into an intent. */
export function classifyOrder(text: string): MeetingOrderIntent {
  const t = text.trim();
  if (SHARE.test(t)) return 'share_screen';
  if (STOP_SHARE.test(t)) return 'stop_share';
  if (NOTE.test(t)) return 'note';
  if (SEARCH.test(t)) return 'search';
  if (REMINDER.test(t)) return 'reminder';
  if (SAY.test(t)) return 'say';
  return 'execute';
}

/** Detect orders addressed to the assistant in one transcript segment. */
export function detectOrders(segment: TranscriptSegment, context: TranscriptSegment[] = []): MeetingOrder[] {
  void context;
  const text = segment.text.trim();
  const match = TRIGGER.exec(text);
  if (!match) return [];

  const payload = text.slice(match.index + match[0].length).trim();
  if (!payload) return [];

  return [{
    id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    intent: classifyOrder(payload),
    raw: text,
    text: payload,
    speaker: segment.speaker,
    atMs: segment.atMs,
    status: 'pending',
  }];
}
