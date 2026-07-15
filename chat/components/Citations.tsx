import { Citation } from "@/lib/api";
import {
  documentFileName,
  relevanceLabel,
  relevancePercent,
} from "@/lib/document";

type CitationsProps = {
  citations: Citation[];
  documentUri?: string;
};

export default function Citations({ citations, documentUri }: CitationsProps) {
  if (citations.length === 0) return null;

  const sourceName = documentUri
    ? documentFileName(documentUri)
    : documentFileName(citations[0]?.source ?? "");

  return (
    <div className="citations-panel">
      <div className="citations-header">
        <span className="citations-title">Sources</span>
        <span className="citations-badge">{citations.length} chunks</span>
      </div>
      <p className="citations-doc">
        Retrieved from <strong>{sourceName}</strong>
      </p>
      <ol className="citation-list">
        {citations.map((citation, index) => (
          <li key={`${citation.source}-${index}`} className="citation-card">
            <div className="citation-card-top">
              <span className="citation-index">#{index + 1}</span>
              <span
                className={`relevance-pill relevance-${relevanceLabel(citation.score).toLowerCase()}`}
              >
                {relevanceLabel(citation.score)} relevance
              </span>
            </div>
            {typeof citation.score === "number" && (
              <div className="relevance-bar" aria-hidden>
                <div
                  className="relevance-fill"
                  style={{ width: `${relevancePercent(citation.score)}%` }}
                />
              </div>
            )}
            {citation.excerpt && (
              <blockquote className="citation-excerpt">
                {citation.excerpt}
              </blockquote>
            )}
            <code className="citation-uri">{documentFileName(citation.source)}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
