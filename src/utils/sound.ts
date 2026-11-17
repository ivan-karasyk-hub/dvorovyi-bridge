let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem('bridge_sound') !== 'off';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem('bridge_sound', enabled ? 'on' : 'off');
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.08,
  delay = 0,
): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playCardSound(): void {
  playTone(320, 0.07, 'triangle', 0.09);
  playTone(190, 0.05, 'sine', 0.05, 0.02);
}

export function playDrawSound(): void {
  playTone(240, 0.06, 'sine', 0.06);
}

export function playSpecialSound(): void {
  playTone(523.25, 0.11, 'triangle', 0.08);
  playTone(659.25, 0.14, 'triangle', 0.08, 0.06);
}

export function playBridgeSound(): void {
  playTone(523.25, 0.14, 'triangle', 0.1, 0);
  playTone(659.25, 0.14, 'triangle', 0.1, 0.08);
  playTone(783.99, 0.2, 'triangle', 0.11, 0.16);
  playTone(1046.5, 0.35, 'triangle', 0.12, 0.25);
}
