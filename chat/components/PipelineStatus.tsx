import ArchitectureDiagram from "@/components/ArchitectureDiagram";

export const PIPELINE_STEPS = [
  { id: "auth", label: "Authenticate", detail: "Cognito JWT" },
  { id: "gateway", label: "API Gateway", detail: "POST /query" },
  { id: "handler", label: "Query handler", detail: "Lambda" },
  { id: "retrieve", label: "Retrieve context", detail: "S3 Vectors via KB" },
  { id: "generate", label: "Generate answer", detail: "Nova Micro LLM" },
  { id: "response", label: "Return response", detail: "Answer + citations" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

type PipelineStatusProps = {
  activeStep: PipelineStepId | null;
  loading: boolean;
  lastCompletedAt?: number | null;
};

export default function PipelineStatus({
  activeStep,
  loading,
  lastCompletedAt,
}: PipelineStatusProps) {
  const activeIndex = activeStep
    ? PIPELINE_STEPS.findIndex((s) => s.id === activeStep)
    : -1;

  return (
    <aside className="pipeline-panel">
      <div className="pipeline-panel-header">
        <h2>Architecture</h2>
        <span className={`pipeline-state ${loading ? "is-active" : "is-idle"}`}>
          {loading ? "Query running" : "Ready"}
        </span>
      </div>

      <ArchitectureDiagram compact highlight={loading ? "query" : "none"} />

      <h3 className="pipeline-live-title">Live query steps</h3>
      <ol className="pipeline-steps">
        {PIPELINE_STEPS.map((step, index) => {
          let status: "done" | "active" | "pending" = "pending";
          if (loading && index < activeIndex) status = "done";
          if (loading && index === activeIndex) status = "active";
          if (!loading && lastCompletedAt) status = "done";

          return (
            <li key={step.id} className={`pipeline-step pipeline-step-${status}`}>
              <div className="pipeline-step-marker" aria-hidden>
                {status === "done" ? "✓" : status === "active" ? "●" : index + 1}
              </div>
              <div className="pipeline-step-body">
                <span className="pipeline-step-label">{step.label}</span>
                <span className="pipeline-step-detail">{step.detail}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {!loading && !lastCompletedAt && (
        <p className="pipeline-footnote muted">
          Documents are indexed asynchronously via the ingestion pipeline above.
        </p>
      )}

      {!loading && lastCompletedAt && (
        <p className="pipeline-footnote muted">
          Last query completed{" "}
          {new Date(lastCompletedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </aside>
  );
}
