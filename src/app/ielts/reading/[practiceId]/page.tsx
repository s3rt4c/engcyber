import { IeltsReadingPractice } from "@/components/ielts-reading-practice";

export default async function IeltsReadingPracticePage({ params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  return <IeltsReadingPractice practiceId={practiceId} />;
}
