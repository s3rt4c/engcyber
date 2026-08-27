import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const m12Modules = [
  "src/domain/ielts-listening.ts",
  "src/domain/ielts-listening-bank.ts",
  "src/client/ielts-listening-flow.ts",
  "src/components/ielts-listening-hub.tsx",
  "src/components/ielts-listening-practice.tsx",
];

describe("M12 Listening boundary", () => {
  it("contains no microphone, speech-recognition, recording, or provider capability implementation", () => {
    const source = m12Modules.map((file) => readFileSync(resolve(file), "utf8")).join("\n");
    for (const forbidden of ["MediaRecorder", "getUserMedia", "SpeechRecognition", "navigator.mediaDevices", "ielts_listening_generation", "ielts_listening_feedback", "bandScore", "CEFR", "readiness", "proficiency"]) expect(source).not.toContain(forbidden);
  });
});
