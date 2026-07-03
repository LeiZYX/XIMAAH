import { InfoDocLayout, InfoSection } from "@/components/info/InfoDocLayout";
import { helpSections } from "@/lib/help-documentation";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  const toc = helpSections.map((section) => ({ id: section.id, label: section.title }));

  return (
    <InfoDocLayout
      title="Help"
      description="A concise guide to using XIMA Assessment Hub—for students, teachers, and administrators."
      toc={toc}
    >
      {helpSections.map((section) => (
        <InfoSection key={section.id} id={section.id} title={section.title}>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.steps ? (
            <ol className="list-decimal space-y-2 pl-5">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {section.bullets ? (
            <ul className="list-disc space-y-2 pl-5">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </InfoSection>
      ))}
    </InfoDocLayout>
  );
}
