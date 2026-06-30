import { InfoDocLayout, InfoSection } from "@/components/info/InfoDocLayout";
import { getSystemInfo, releaseNotes } from "@/lib/release-notes";

export const dynamic = "force-dynamic";

export default function AboutPage() {
  const system = getSystemInfo();
  const toc = [
    { id: "system", label: "System information" },
    ...releaseNotes.map((note) => ({
      id: `release-${note.version.replace(/\./g, "-")}`,
      label: `Release ${note.version}`,
    })),
  ];

  return (
    <InfoDocLayout
      title="About"
      description="Product information and release history for XIMA Assessment Hub."
      toc={toc}
    >
      <InfoSection id="system" title="System information">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Product</dt>
            <dd className="font-medium text-slate-900">{system.productName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Current version</dt>
            <dd className="font-medium text-slate-900">{system.version}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Latest release date</dt>
            <dd className="font-medium text-slate-900">{system.releaseDate}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Environment</dt>
            <dd className="font-medium text-slate-900">{system.environment}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Build</dt>
            <dd className="font-mono text-sm text-slate-900">{system.buildCommit}</dd>
          </div>
        </dl>
      </InfoSection>

      {releaseNotes.map((note) => (
        <InfoSection
          key={note.version}
          id={`release-${note.version.replace(/\./g, "-")}`}
          title={`Version ${note.version}`}
        >
          <p className="text-slate-600">Released: {note.releaseDate}</p>
          <p>{note.summary}</p>
          {note.changes.length > 0 ? (
            <div>
              <h3 className="mt-4 font-medium text-slate-900">Changes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {note.changes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {note.bugFixes && note.bugFixes.length > 0 ? (
            <div>
              <h3 className="mt-4 font-medium text-slate-900">Bug fixes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {note.bugFixes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {note.knownIssues && note.knownIssues.length > 0 ? (
            <div>
              <h3 className="mt-4 font-medium text-slate-900">Known issues</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {note.knownIssues.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </InfoSection>
      ))}
    </InfoDocLayout>
  );
}
