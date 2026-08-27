import { describe, expect, it } from "vitest";

import { BrowserSpeechSynthesis } from "@/client/browser-tts";

class FakeUtterance {
  lang = "";
  rate = 1;
  voice: FakeVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

type FakeVoice = { name: string; lang: string; voiceURI: string };

class FakeSpeech {
  voices: FakeVoice[] = [];
  spoken: FakeUtterance[] = [];
  cancelCount = 0;
  onvoiceschanged: (() => void) | null = null;
  getVoices() { return this.voices; }
  speak(utterance: FakeUtterance) { this.spoken.push(utterance); }
  cancel() { this.cancelCount += 1; }
}

describe("M5 browser speech", () => {
  it("prefers a matching English voice, cancels overlapping speech, and applies the selected rate", () => {
    const speech = new FakeSpeech();
    speech.voices = [{ name: "Turkish", lang: "tr-TR", voiceURI: "tr" }, { name: "English UK", lang: "en-GB", voiceURI: "uk" }, { name: "English US", lang: "en-US", voiceURI: "us" }];
    const tts = new BrowserSpeechSynthesis({ speech, Utterance: FakeUtterance, locale: "en-US" });
    expect(tts.speak("First sentence.", 1)).toBe(true);
    expect(tts.speak("Second sentence.", 0.75)).toBe(true);
    expect(speech.cancelCount).toBe(2);
    expect(speech.spoken[1]).toMatchObject({ text: "Second sentence.", rate: 0.75, lang: "en-US", voice: { voiceURI: "us" } });
  });

  it("refreshes asynchronous voices, stops speech, and degrades safely without browser speech", () => {
    const speech = new FakeSpeech();
    const tts = new BrowserSpeechSynthesis({ speech, Utterance: FakeUtterance, locale: "en-US" });
    speech.voices = [{ name: "English US", lang: "en-US", voiceURI: "us" }];
    speech.onvoiceschanged?.();
    expect(tts.speak("Sentence.", 1.15)).toBe(true);
    expect(speech.spoken[0].voice?.voiceURI).toBe("us");
    tts.stop();
    expect(speech.cancelCount).toBe(2);
    expect(new BrowserSpeechSynthesis({ speech: null, Utterance: null }).speak("Sentence.", 1)).toBe(false);
  });

  it("queues authored script turns without treating unavailable browser speech as playback", () => {
    const speech = new FakeSpeech();
    const tts = new BrowserSpeechSynthesis({ speech, Utterance: FakeUtterance, locale: "en-US" });
    expect(tts.speakSequence(["First authored turn.", "Second authored turn."], 1)).toBe(true);
    expect(speech.spoken.map((utterance) => utterance.text)).toEqual(["First authored turn."]);
    speech.spoken[0]?.onend?.();
    expect(speech.spoken.map((utterance) => utterance.text)).toEqual(["First authored turn.", "Second authored turn."]);
    expect(new BrowserSpeechSynthesis({ speech: null, Utterance: null }).speakSequence(["Unavailable"], 1)).toBe(false);
  });

  it("reports the first actual utterance start and a synthesis failure to the caller", () => {
    const speech = new FakeSpeech();
    const tts = new BrowserSpeechSynthesis({ speech, Utterance: FakeUtterance, locale: "en-US" });
    let starts = 0;
    let failures = 0;
    expect(tts.speakSequence(["A turn."], 1, { onStart: () => { starts += 1; }, onError: () => { failures += 1; } })).toBe(true);
    speech.spoken[0]?.onstart?.();
    expect(starts).toBe(1);
    speech.spoken[0]?.onerror?.();
    expect(failures).toBe(1);
  });
});
