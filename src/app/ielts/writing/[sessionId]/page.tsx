import { IeltsWritingPractice } from "@/components/ielts-writing-practice";

export default async function IeltsWritingPracticePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <IeltsWritingPractice sessionId={sessionId} />;
}
