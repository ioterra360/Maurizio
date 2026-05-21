/**
 * Tactile + audible feedback for primary interactions across the app.
 *
 * Three semantic events, mirrored on the haptic engine and the audio
 * channel:
 *
 *   - `tap`      : minor confirmation (button press, selection)
 *                  → Light haptic + soft tap.wav
 *   - `success`  : positive outcome (review answered, action completed)
 *                  → Success haptic + success.wav jingle
 *   - `error`    : negative outcome (validation failed, forgot a card)
 *                  → Error haptic + error.wav buzz
 *
 * The audio files come from the TLC mobile app (same sound design).
 *
 * Sound playback is fire-and-forget and never throws — silent on simulators
 * that can't play audio, on web, or when the device is muted.
 */

import * as Haptics from "expo-haptics";
import { AudioPlayer, createAudioPlayer } from "expo-audio";

type Kind = "tap" | "success" | "error";

const SOURCES = {
  tap: require("../assets/sounds/tap.wav"),
  success: require("../assets/sounds/success.wav"),
  error: require("../assets/sounds/error.wav"),
};

// One persistent player per sound — cheaper than creating a player on each
// press, and the API supports overlapping seek+play.
const players: Partial<Record<Kind, AudioPlayer>> = {};

function getPlayer(kind: Kind): AudioPlayer | null {
  try {
    if (!players[kind]) {
      players[kind] = createAudioPlayer(SOURCES[kind]);
    }
    return players[kind] ?? null;
  } catch {
    return null;
  }
}

function playSound(kind: Kind) {
  try {
    const p = getPlayer(kind);
    if (!p) return;
    // seekTo() is async; rewind first then play once it's positioned, so
    // tapping a button twice in a row replays the sound from the start.
    p.seekTo(0)
      .then(() => p.play())
      .catch(() => p.play());
  } catch {
    // ignore — audio is best-effort
  }
}

function hapticFor(kind: Kind) {
  try {
    if (kind === "tap") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else if (kind === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  } catch {
    // ignore — some platforms (web) don't support haptics
  }
}

export function feedback(kind: Kind): void {
  hapticFor(kind);
  playSound(kind);
}

export const tap = () => feedback("tap");
export const success = () => feedback("success");
export const error = () => feedback("error");
