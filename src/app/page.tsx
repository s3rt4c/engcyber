import { contentCategories } from "@/domain/learning";

const navigation = ["Discover", "My Content", "Review", "Progress"];

const milestones = [
  { title: "Discover authentic material", description: "Collect lightweight metadata from trusted source adapters before deciding what deserves study time." },
  { title: "Study on demand", description: "Create a lesson only after you select a source item. Original English always remains the reference text." },
  { title: "Remember useful language", description: "Save technical phrases, collocations, and recurring errors for focused future review." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-8 border-b border-slate-700 pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.22em] text-cyan-300 uppercase">EngCyber</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">English practice built around the technical work you care about.</h1>
          </div>
          <nav aria-label="Primary navigation">
            <ul className="flex flex-wrap gap-2 text-sm font-medium text-slate-300">
              {navigation.map((item) => (
                <li key={item}>
                  <a className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-cyan-300 hover:text-cyan-200" href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</a>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <section className="grid gap-8 py-14 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <div>
            <p className="text-lg leading-8 text-slate-300">A private learning workspace for moving from B1 toward B2 and IELTS Band 7.0 through cybersecurity, AI, and carefully chosen general English.</p>
            <p className="mt-6 rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-5 text-cyan-100">Lessons are created only when you choose an item.</p>
          </div>
          <aside className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="text-sm font-medium text-cyan-300">M0 foundation</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">Source ingestion, AI lesson creation, personal error memory, and TTS are represented as typed boundaries. Their product workflows arrive in later milestones.</p>
          </aside>
        </section>
        <section id="discover" aria-labelledby="categories-heading">
          <p className="text-sm font-semibold tracking-[0.18em] text-slate-400 uppercase">Content map</p>
          <h2 id="categories-heading" className="mt-2 text-2xl font-semibold">Interest-led English, with room to shift toward IELTS.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {contentCategories.map((category) => (
              <article className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={category.id}>
                <h3 className="font-medium">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{category.learningPurpose}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-14 grid gap-4 md:grid-cols-3" aria-label="Learning flow">
          {milestones.map((milestone, index) => (
            <article className="rounded-xl bg-slate-900/70 p-5" key={milestone.title}>
              <p className="text-sm font-semibold text-cyan-300">0{index + 1}</p>
              <h2 className="mt-3 text-lg font-medium">{milestone.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{milestone.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
