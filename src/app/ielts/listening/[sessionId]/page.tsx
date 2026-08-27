import { IeltsListeningPractice } from "@/components/ielts-listening-practice";

export default async function IeltsListeningPracticePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <IeltsListeningPractice sessionId={sessionId} />;
}
