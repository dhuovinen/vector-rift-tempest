export class GameAudio {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.master = null;
    this.noiseBuffer = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.38 : 0;
  }

  async unlock() {
    if (!this.context) this.createContext();
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  playEvent(event) {
    if (!this.enabled) return;
    if (!this.context) this.createContext();

    const combo = event.detail?.combo ?? 0;
    switch (event.type) {
      case "shot":
        this.zap(680, 1380, 0.055, 0.13);
        break;
      case "kill":
        this.burst(230 + combo * 18, 0.1, 0.22);
        this.zap(1100 + combo * 26, 520, 0.08, 0.08);
        break;
      case "special":
        this.sweep(160, 1160, 0.36, 0.34);
        this.noise(0.24, 0.2);
        break;
      case "breach":
        this.sweep(180, 56, 0.34, 0.28);
        this.noise(0.18, 0.28);
        break;
      case "wave":
        this.arpeggio([330, 440, 660, 880], 0.1, 0.18);
        break;
      case "gameover":
        this.arpeggio([220, 165, 110, 82], 0.16, 0.24);
        break;
      default:
        break;
    }
  }

  createContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.enabled ? 0.38 : 0;
    this.master.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer();
  }

  createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 0.45);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  envelope(target, start, peak, duration) {
    const now = this.context.currentTime;
    target.gain.cancelScheduledValues(now);
    target.gain.setValueAtTime(0.0001, now);
    target.gain.exponentialRampToValueAtTime(peak, now + start);
    target.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  zap(from, to, duration, level) {
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    this.envelope(gain, 0.006, level, duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  burst(frequency, duration, level) {
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.55, now + duration);
    this.envelope(gain, 0.01, level, duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  sweep(from, to, duration, level) {
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    this.envelope(gain, 0.02, level, duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  noise(duration, level) {
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    this.envelope(gain, 0.01, level, duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  arpeggio(notes, step, level) {
    notes.forEach((note, index) => {
      window.setTimeout(() => this.burst(note, 0.14, level), index * step * 1000);
    });
  }
}
