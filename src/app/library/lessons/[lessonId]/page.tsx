import { SavedLessonDetail } from "@/components/saved-lesson-detail";

export default async function SavedLessonPage({ params }: { readonly params: Promise<{ readonly lessonId: string }> }) {
  const { lessonId } = await params;
  return <SavedLessonDetail lessonId={lessonId} />;
}
