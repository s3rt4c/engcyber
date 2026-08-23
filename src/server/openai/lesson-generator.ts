import "server-only";
import type { LessonGenerator } from "@/domain/boundaries";

/** M0 seam for a server-side OpenAI lesson generator. M2 supplies the implementation. */
export type ServerLessonGenerator = LessonGenerator;
