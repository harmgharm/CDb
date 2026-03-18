/**
 * Game sound effects — synthesized via Web Audio API
 *
 * No audio files needed. Each sound is a short tone sequence generated
 * on the fly. All sounds are subtle and non-intrusive.
 *
 * Volume is kept low (0.15 max) for a pleasant background feel.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!("AudioContext" in globalThis)) return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

interface ToneOptions {
  frequency: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
  delay?: number;
}

/**
 * Play a single tone at a given frequency, duration, and volume.
 */
function playTone(options: ToneOptions): void {
  const { frequency, duration, volume, type = "sine", delay = 0 } = options;
  const context = getAudioContext();
  if (context === null) return;

  // Resume if suspended (browsers require user interaction first)
  if (context.state === "suspended") {
    void context.resume();
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = volume;

  // Fade out to avoid click/pop
  const startTime = context.currentTime + delay;
  const endTime = startTime + duration;
  gainNode.gain.setValueAtTime(volume, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.01);
}

/**
 * Correct guess — ascending two-note chime (C5 → E5)
 */
export function playCorrectSound(): void {
  playTone({ frequency: 523, duration: 0.12, volume: 0.12 }); // C5
  playTone({ frequency: 659, duration: 0.18, volume: 0.12, delay: 0.1 }); // E5
}

/**
 * Wrong guess — single low soft tone (E3)
 */
export function playWrongSound(): void {
  playTone({ frequency: 165, duration: 0.2, volume: 0.08, type: "triangle" }); // E3
}

/**
 * Round start — quick rising blip (G4 → C5)
 */
export function playRoundStartSound(): void {
  playTone({ frequency: 392, duration: 0.08, volume: 0.1 }); // G4
  playTone({ frequency: 523, duration: 0.12, volume: 0.1, delay: 0.07 }); // C5
}

/**
 * Countdown tick — subtle click
 */
export function playCountdownTickSound(): void {
  playTone({ frequency: 800, duration: 0.04, volume: 0.06, type: "square" });
}

/**
 * Game end / victory — triumphant ascending arpeggio (C5 → E5 → G5 → C6)
 */
export function playGameEndSound(): void {
  playTone({ frequency: 523, duration: 0.15, volume: 0.1 }); // C5
  playTone({ frequency: 659, duration: 0.15, volume: 0.1, delay: 0.12 }); // E5
  playTone({ frequency: 784, duration: 0.15, volume: 0.1, delay: 0.24 }); // G5
  playTone({ frequency: 1047, duration: 0.25, volume: 0.12, delay: 0.36 }); // C6
}

/**
 * First correct bonus — bright sparkle (E6 → G6)
 */
export function playFirstCorrectSound(): void {
  playTone({ frequency: 1319, duration: 0.1, volume: 0.1 }); // E6
  playTone({ frequency: 1568, duration: 0.15, volume: 0.1, delay: 0.08 }); // G6
}

/**
 * Player joined lobby — soft notification ding (A5)
 */
export function playPlayerJoinedSound(): void {
  playTone({ frequency: 880, duration: 0.12, volume: 0.08 });
}

/**
 * Player disconnected — descending two-note (E4 → C4)
 */
export function playPlayerDisconnectedSound(): void {
  playTone({ frequency: 330, duration: 0.12, volume: 0.06, type: "triangle" }); // E4
  playTone({ frequency: 262, duration: 0.15, volume: 0.06, type: "triangle", delay: 0.1 }); // C4
}

/**
 * Skip round — quick descending blip (C5 → G4)
 */
export function playSkipSound(): void {
  playTone({ frequency: 523, duration: 0.06, volume: 0.06, type: "triangle" }); // C5
  playTone({ frequency: 392, duration: 0.1, volume: 0.06, type: "triangle", delay: 0.05 }); // G4
}
