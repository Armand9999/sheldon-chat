type ArchNodeProps = {
  label: string;
  sub?: string;
  kind?: "client" | "s3" | "sqs" | "lambda" | "bedrock" | "vectors" | "gateway" | "sheldon";
};

function ArchNode({ label, sub, kind = "lambda" }: ArchNodeProps) {
  return (
    <div className={`arch-node arch-node-${kind}`}>
      <span className="arch-node-label">{label}</span>
      {sub && <span className="arch-node-sub">{sub}</span>}
    </div>
  );
}

function ArchArrow({ dashed = false }: { dashed?: boolean }) {
  return (
    <div className={`arch-arrow ${dashed ? "arch-arrow-dashed" : ""}`} aria-hidden>
      →
    </div>
  );
}

type ArchitectureDiagramProps = {
  compact?: boolean;
  highlight?: "ingest" | "query" | "none";
};

export default function ArchitectureDiagram({
  compact = false,
  highlight = "none",
}: ArchitectureDiagramProps) {
  return (
    <div className={`architecture ${compact ? "architecture-compact" : ""}`}>
      <section
        className={`arch-section ${highlight === "ingest" ? "arch-section-highlight" : ""}`}
      >
        <h3 className="arch-section-title">Ingestion pipeline</h3>
        <div className="arch-flow">
          <ArchNode label="Client" sub="PDF upload" kind="client" />
          <ArchArrow />
          <ArchNode label="S3 Bucket" sub="Raw docs" kind="s3" />
          <ArchArrow />
          <ArchNode label="SQS" sub="Ingest queue" kind="sqs" />
          <ArchArrow />
          <ArchNode label="Lambda" sub="Trigger sync" kind="lambda" />
          <ArchArrow />
          <ArchNode label="Bedrock KB" sub="Ingest job" kind="bedrock" />
          <ArchArrow />
          <ArchNode label="S3 Vectors" sub="writes vectors" kind="vectors" />
        </div>
      </section>

      <div className="arch-legend-inline">
        <span>
          <span className="legend-line legend-write" /> data write
        </span>
        <span>
          <span className="legend-line legend-read" /> data read
        </span>
      </div>

      <section
        className={`arch-section ${highlight === "query" ? "arch-section-highlight" : ""}`}
      >
        <h3 className="arch-section-title">Query &amp; generation</h3>
        <div className="arch-flow">
          <ArchNode label="Sheldon" sub="Query input" kind="sheldon" />
          <ArchArrow />
          <ArchNode label="API Gateway" sub="REST endpoint" kind="gateway" />
          <ArchArrow />
          <ArchNode label="Lambda" sub="Query handler" kind="lambda" />
          <ArchArrow />
          <ArchNode label="Bedrock KB" sub="Retrieve & gen" kind="bedrock" />
        </div>
        <div className="arch-readback">
          <ArchArrow dashed />
          <ArchNode label="S3 Vectors" sub="retrieves context" kind="vectors" />
          <ArchArrow />
          <ArchNode label="Response" sub="LLM answer" kind="client" />
        </div>
      </section>
    </div>
  );
}
