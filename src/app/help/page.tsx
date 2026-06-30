import { HelpRoleNotes } from "@/components/info/HelpRoleNotes";
import { InfoAlert, InfoDocLayout, InfoSection } from "@/components/info/InfoDocLayout";
import { helpSections } from "@/lib/help-documentation";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  const toc = [
    ...helpSections.map((section) => ({ id: section.id, label: section.title })),
    { id: "role-notes", label: "Role-specific notes" },
  ];

  return (
    <InfoDocLayout
      title="Help"
      description="Guide to internal student exam registration, deadlines, teacher-assisted changes, and fee statements."
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

      <InfoSection id="role-notes" title="Role-specific notes">
        <HelpRoleNotes />
        <InfoAlert>
          This guide covers normal internal student registration only. For other registration
          arrangements, contact the Exams Office directly.
        </InfoAlert>
      </InfoSection>
    </InfoDocLayout>
  );
}
