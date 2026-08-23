export interface LearnerProfile {
  readonly id: string;
  readonly version: string;
  readonly currentLevel: "B1" | "B2" | "C1";
  readonly targetExam: "IELTS";
  readonly targetBand: "7.0";
  readonly functionalTarget: "strong B2 / early C1";
  readonly supportLanguage: "Turkish";
  readonly contentInterests: readonly ["cybersecurity", "artificial intelligence", "technical computing"];
}

export const defaultLearnerProfile: LearnerProfile = {
  id: "personal-default",
  version: "m2-profile-v1",
  currentLevel: "B1",
  targetExam: "IELTS",
  targetBand: "7.0",
  functionalTarget: "strong B2 / early C1",
  supportLanguage: "Turkish",
  contentInterests: ["cybersecurity", "artificial intelligence", "technical computing"],
};
