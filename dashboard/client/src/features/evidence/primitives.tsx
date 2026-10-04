import React from 'react';
import type { ResultEnvelope } from '../../types/telemetry';

export type Provenance = 'MEASURED' | 'CALCULATED' | 'ESTIMATE' | 'DATASET';

const PROV_STYLE: Record<Provenance, string> = {
  MEASURED: 'text-prov-measured border-prov-measured/40 bg-prov-measured/10',
  CALCULATED: 'text-prov-calculated border-prov-calculated/40 bg-prov-calculated/10',
  ESTIMATE: 'text-prov-estimate border-prov-estimate/40 bg-prov-estimate/10',
  DATASET: 'text-prov-precomputed border-prov-precomputed/40 bg-prov-precomputed/10',
};

const PROV_HELP: Record<Provenance, string> = {
  MEASURED: 'Measured by running the code on data',
  CALCULATED: 'Derived arithmetically (a capacity, not a measured allocation)',
  ESTIMATE: 'Scaled or extrapolated, not measured',
  DATASET: 'Taken from the dataset itself',
};

/** Every figure on the Evidence page carries one of these, as text (never colour alone). */
export const ProvenanceBadge: React.FC<{ kind: Provenance }> = ({ kind }) => (
  <span
    data-provenance={kind}
    title={PROV_HELP[kind]}
    className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${PROV_STYLE[kind]}`}
  >
    {kind}
  </span>
);

/** Large number with a label, optional sub-line and provenance. Figures stay proportional (not tabular) at this size. */
export const StatTile: React.FC<{
  label: string;
  value: string;
  sub?: React.ReactNode;
  provenance: Provenance;
  tone?: 'default' | 'ours' | 'warn';
  metric: string;
}> = ({ label, value, sub, provenance, tone = 'default', metric }) => (
  <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-subtle p-3">
    <span className="text-[11px] font-medium uppercase leading-tight tracking-wide text-fg-muted">{label}</span>
    <span
      data-metric={metric}
      className={`text-2xl font-semibold tracking-tight ${tone === 'ours' ? 'text-accent-text' : tone === 'warn' ? 'text-warn-fg' : 'text-fg'}`}
    >
      {value}
    </span>
    {sub && <span className="text-xs leading-snug text-fg-2">{sub}</span>}
    <span className="mt-auto pt-1.5">
      <ProvenanceBadge kind={provenance} />
    </span>
  </div>
);

export const SourceLine: React.FC<{ envelope: ResultEnvelope | null; note?: string }> = ({ envelope, note }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 font-mono text-[10px] text-fg-muted">
    {envelope ? (
      <>
        <span title="File in the repository this card was computed from">Source: {envelope.source_path}</span>
        <span title={`SHA-256 ${envelope.sha256}`}>sha256 {envelope.sha256.slice(0, 10)}…</span>
      </>
    ) : (
      <span>Source file unavailable</span>
    )}
    {note && <span>{note}</span>}
  </div>
);

export const EvidenceCard: React.FC<{
  id: string;
  tag?: string;
  title: string;
  claim: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ id, tag, title, claim, children, footer }) => (
  <section
    id={id}
    data-region="evidence-card"
    aria-labelledby={`${id}-title`}
    className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 shadow-sm"
  >
    <header className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {tag && (
          <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-bold text-fg-2 border border-line">{tag}</span>
        )}
        <h2 id={`${id}-title`} className="text-[15px] font-semibold tracking-tight text-fg">
          {title}
        </h2>
      </div>
      <p className="text-xs leading-relaxed text-fg-2">{claim}</p>
    </header>
    {children}
    {footer}
  </section>
);

/** Table twin for a chart: every value reachable without relying on colour or hover. */
export const DataTable: React.FC<{ caption: string; columns: string[]; rows: (string | number)[][] }> = ({ caption, columns, rows }) => (
  <details className="group text-xs">
    <summary className="cursor-pointer select-none text-[11px] font-medium text-accent-text hover:underline">
      View as table
    </summary>
    <div className="mt-2 overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left font-mono text-[11px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-subtle text-fg-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-2 py-1.5 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-fg">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((cell, j) => (
                <td key={j} className={`px-2 py-1 ${j === 0 ? 'text-fg-2' : 'tabular-nums'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

export const Note: React.FC<{ tone?: 'info' | 'warn'; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <p
    className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
      tone === 'warn' ? 'border-warn-line bg-warn-bg text-warn-fg' : 'border-line bg-subtle text-fg-2'
    }`}
  >
    {children}
  </p>
);
