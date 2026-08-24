export interface BrowserVoice { readonly name: string; readonly lang: string; readonly voiceURI: string; }
export interface BrowserUtterance { lang: string; rate: number; voice: BrowserVoice | null; onend: (() => void) | null; onerror: (() => void) | null; }
export interface BrowserSpeechEngine { getVoices(): BrowserVoice[]; speak(utterance: BrowserUtterance): void; cancel(): void; onvoiceschanged: (() => void) | null; }
export type BrowserUtteranceConstructor = new (text: string) => BrowserUtterance;

export class BrowserSpeechSynthesis {
  private voices: BrowserVoice[] = [];
  private speaking = false;

  constructor(private readonly input: { readonly speech: BrowserSpeechEngine | null; readonly Utterance: BrowserUtteranceConstructor | null; readonly locale?: string }) {
    this.refreshVoices();
    if (this.input.speech) this.input.speech.onvoiceschanged = () => this.refreshVoices();
  }

  get supported(): boolean { return Boolean(this.input.speech && this.input.Utterance); }
  get isSpeaking(): boolean { return this.speaking; }

  refreshVoices(): void {
    try { this.voices = this.input.speech?.getVoices() ?? []; } catch { this.voices = []; }
  }

  private preferredVoice(): BrowserVoice | null {
    const english = this.voices.filter((voice) => /^en(?:-|$)/iu.test(voice.lang));
    if (!english.length) return null;
    const locale = (this.input.locale ?? "en-US").toLocaleLowerCase();
    return english.find((voice) => voice.lang.toLocaleLowerCase() === locale) ?? english.find((voice) => voice.lang.toLocaleLowerCase().startsWith(locale.slice(0, 2))) ?? english[0];
  }

  speak(text: string, rate: number): boolean {
    if (!this.input.speech || !this.input.Utterance || !text.trim()) return false;
    this.stop();
    try {
      const utterance = new this.input.Utterance(text);
      const voice = this.preferredVoice();
      utterance.lang = voice?.lang ?? "en-US";
      utterance.voice = voice;
      utterance.rate = rate;
      utterance.onend = () => { this.speaking = false; };
      utterance.onerror = () => { this.speaking = false; };
      this.speaking = true;
      this.input.speech.speak(utterance);
      return true;
    } catch { this.speaking = false; return false; }
  }

  stop(): void {
    try { this.input.speech?.cancel(); } catch { /* Browser speech failures are local and non-fatal. */ }
    this.speaking = false;
  }

  dispose(): void {
    this.stop();
    if (this.input.speech) this.input.speech.onvoiceschanged = null;
  }
}

export function createBrowserSpeechSynthesis(): BrowserSpeechSynthesis {
  try {
    const browser = window as typeof window & { SpeechSynthesisUtterance?: BrowserUtteranceConstructor };
    return new BrowserSpeechSynthesis({ speech: browser.speechSynthesis as unknown as BrowserSpeechEngine, Utterance: browser.SpeechSynthesisUtterance ?? null, locale: browser.navigator.language });
  } catch { return new BrowserSpeechSynthesis({ speech: null, Utterance: null }); }
}
