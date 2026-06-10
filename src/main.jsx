import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Cookie,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  Network,
  Printer,
  Search,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import "./styles.css";

const sampleReport = {
  scannedAt: new Date().toISOString(),
  requestedUrl: "https://example-learning-site.org",
  finalUrl: "https://example-learning-site.org/",
  httpStatus: 200,
  pageTitle: "Example Learning Site",
  summary: {
    risk: "Moderate",
    score: 74,
    counts: { cookies: 2, advertisers: 1, processors: 3, otherThirdParties: 1 }
  },
  categories: [
    { label: "Pages scanned", count: 4, status: "Deep scan" },
    { label: "Cookies", count: 2, status: "Review" },
    { label: "Advertising or analytics", count: 1, status: "High review" },
    { label: "Third-party processors", count: 3, status: "Review DPA" },
    { label: "Forms detected", count: 1, status: "Review data" },
    { label: "Privacy policy links", count: 1, status: "Found" }
  ],
  thirdParties: {
    advertisers: [{ domain: "google-analytics.com", category: "Advertising / analytics" }],
    processors: [
      { domain: "cloudflare.com", category: "Processor / infrastructure" },
      { domain: "gstatic.com", category: "Processor / infrastructure" },
      { domain: "youtube.com", category: "Processor / infrastructure" }
    ],
    other: [{ domain: "example-cdn.org", category: "Third-party resource" }]
  },
  cookies: [
    { name: "session", secure: true, httpOnly: true, sameSite: "Lax" },
    { name: "_ga", secure: true, httpOnly: false, sameSite: "Not declared" }
  ],
  storageSignals: [{ label: "Local storage" }],
  privacyLinks: [{ label: "Privacy Policy", url: "https://example-learning-site.org/privacy" }],
  pagesScanned: [
    { title: "Example Learning Site", status: 200, url: "https://example-learning-site.org/" },
    { title: "Privacy Policy", status: 200, url: "https://example-learning-site.org/privacy" },
    { title: "Terms", status: 200, url: "https://example-learning-site.org/terms" },
    { title: "Student Login", status: 200, url: "https://example-learning-site.org/login" }
  ],
  forms: [
    {
      action: "https://example-learning-site.org/login",
      method: "POST",
      sensitiveFieldCount: 2,
      fields: [
        { name: "email", type: "email", sensitive: true },
        { name: "password", type: "password", sensitive: true }
      ]
    }
  ],
  policySignals: [
    { label: "Student data", pages: ["https://example-learning-site.org/privacy"] },
    { label: "COPPA", pages: ["https://example-learning-site.org/privacy"] },
    { label: "Data retention", pages: ["https://example-learning-site.org/privacy"] }
  ],
  securityHeaders: {
    contentSecurityPolicy: true,
    strictTransportSecurity: true,
    permissionsPolicy: false,
    referrerPolicy: true
  },
  findings: [
    {
      severity: "High",
      area: "Advertising / analytics",
      evidence: "google-analytics.com",
      action: "Verify the vendor does not use student data for targeted advertising or unrelated profiling."
    },
    {
      severity: "Review",
      area: "Third-party processors",
      evidence: "cloudflare.com, gstatic.com, youtube.com",
      action: "Check data privacy agreement coverage, subprocessors, security terms, and breach notification language."
    }
  ],
  utahReview: [
    {
      label: "Student data protection",
      status: "Needs DPA review",
      detail:
        "For any site receiving student data, verify DPA/contract terms, subprocessors, security controls, breach notice, retention, and deletion."
    },
    {
      label: "Advertising and profiling",
      status: "High priority review",
      detail:
        "Advertising or analytics domains should be reviewed for targeted advertising, cross-site tracking, and use beyond the educational purpose."
    },
    {
      label: "Cookies and storage",
      status: "Review purpose",
      detail:
        "Document cookie/storage purpose, whether identifiers are tied to students, and whether consent or opt-out workflows apply."
    },
    {
      label: "Vendor documentation",
      status: "Policy link found",
      detail:
        "Attach vendor privacy policy, student data privacy terms, DPA status, and district approval evidence to the final evaluation."
    }
  ],
  references: [
    { label: "USBE Student Data Privacy", url: "https://schools.utah.gov/studentdataprivacy/index.php" },
    { label: "USBE Laws & Policies", url: "https://schools.utah.gov/studentdataprivacy/laws.php" },
    { label: "Board Rule R277-487", url: "https://schools.utah.gov/adminrules/R277-487.php" },
    { label: "Utah Code 53E-9-301", url: "https://le.utah.gov/xcode/Title53E/Chapter9/53E-9-S301.html" }
  ],
  aipcEvaluation: {
    status: "Not configured",
    summary: "Set AIPC_ENDPOINT or OLLAMA_BASE_URL on the server to enable AI privacy evaluation."
  },
  limitations: [
    "This is a first-pass technical scan of the public page only.",
    "District review should still verify contracts, data privacy agreements, vendor terms, data retention, and student data elements."
  ]
};

function App() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState(sampleReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(report.scannedAt)),
    [report.scannedAt]
  );

  async function runScan(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/scan?url=${encodeURIComponent(url)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Scan failed.");
      setReport(payload);
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `privacy-report-${new URL(report.finalUrl).hostname}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><ShieldCheck size={22} /></span>
          <div>
            <strong>Utah K-12 Privacy Checker</strong>
            <span>Website evaluation report builder</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => window.print()} title="Print report">
            <Printer size={18} />
          </button>
          <button className="icon-button" onClick={downloadReport} title="Download JSON report">
            <Download size={18} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="scan-panel">
          <form onSubmit={runScan} className="scan-form">
            <label htmlFor="website-url">Website URL</label>
            <div className="url-row">
              <Globe2 size={18} />
              <input
                id="website-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://vendor-site.com"
                autoComplete="url"
              />
            </div>
            <button className="primary-button" disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
              Run Privacy Check
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>

          <div className="checklist">
            <h2>Review Scope</h2>
            <ScopeItem icon={<Cookie size={18} />} label="Cookie collection" />
            <ScopeItem icon={<AlertTriangle size={18} />} label="Advertising trackers" />
            <ScopeItem icon={<Network size={18} />} label="Third-party processors" />
            <ScopeItem icon={<ClipboardCheck size={18} />} label="Utah K-12 review notes" />
          </div>

          <div className="reference-box">
            <h2>Official References</h2>
            {report.references.map((reference) => (
              <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">
                {reference.label}
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        </aside>

        <section className="report" aria-live="polite">
          <div className="report-header">
            <div>
              <p className="eyeline">Scanned {generatedAt}</p>
              <h1>{report.pageTitle}</h1>
              <a href={report.finalUrl} target="_blank" rel="noreferrer">
                {report.finalUrl}
              </a>
            </div>
            <RiskBadge risk={report.summary.risk} score={report.summary.score} />
          </div>

          <div className="metric-grid">
            {report.categories.map((item) => (
              <article className="metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
                <em>{item.status}</em>
              </article>
            ))}
          </div>

          <section className="report-section deep-evidence">
            <div className="section-title">
              <ClipboardCheck size={18} />
              <h2>Deep Scan Evidence</h2>
            </div>
            <DeepEvidence report={report} />
          </section>

          <section className="report-section">
            <div className="section-title">
              <FileText size={18} />
              <h2>Evaluation Findings</h2>
            </div>
            <div className="findings-table">
              <div className="table-row table-head">
                <span>Severity</span>
                <span>Area</span>
                <span>Evidence</span>
                <span>Recommended action</span>
              </div>
              {report.findings.map((finding, index) => (
                <div className="table-row" key={`${finding.area}-${index}`}>
                  <span><Severity value={finding.severity} /></span>
                  <span>{finding.area}</span>
                  <span>{finding.evidence}</span>
                  <span>{finding.action}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="split-sections">
            <div className="report-section">
              <div className="section-title">
                <UsersRound size={18} />
                <h2>Utah K-12 Review Notes</h2>
              </div>
              <div className="note-list">
                {report.utahReview.map((note) => (
                  <article key={note.label}>
                    <div>
                      <strong>{note.label}</strong>
                      <span>{note.status}</span>
                    </div>
                    <p>{note.detail}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="report-section">
              <div className="section-title">
                <CheckCircle2 size={18} />
                <h2>Detected Details</h2>
              </div>
              <DomainList title="Advertisers / analytics" items={report.thirdParties.advertisers} />
              <DomainList title="Processors" items={report.thirdParties.processors} />
              <CookieList cookies={report.cookies} />
            </div>
          </section>

          <section className="report-section aipc-section">
            <div className="section-title">
              <ShieldCheck size={18} />
              <h2>AIPC Evaluation</h2>
            </div>
            <AipcEvaluation evaluation={report.aipcEvaluation} />
          </section>

          <section className="limitations">
            <strong>Report limitations</strong>
            {report.limitations.map((item) => <span key={item}>{item}</span>)}
          </section>
        </section>
      </section>
    </main>
  );
}

function ScopeItem({ icon, label }) {
  return (
    <div className="scope-item">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function RiskBadge({ risk, score }) {
  return (
    <div className={`risk-badge risk-${risk.toLowerCase()}`}>
      <span>{risk} risk</span>
      <strong>{score}</strong>
      <em>review score</em>
    </div>
  );
}

function Severity({ value }) {
  return <b className={`severity severity-${value.toLowerCase()}`}>{value}</b>;
}

function DomainList({ title, items }) {
  return (
    <div className="detail-block">
      <strong>{title}</strong>
      {items.length ? (
        items.slice(0, 6).map((item) => <span key={item.domain}>{item.domain}</span>)
      ) : (
        <span>No public-page signal detected</span>
      )}
    </div>
  );
}

function CookieList({ cookies }) {
  return (
    <div className="detail-block">
      <strong>Cookies</strong>
      {cookies.length ? (
        cookies.slice(0, 6).map((cookie) => (
          <span key={cookie.name}>
            {cookie.name} · SameSite {cookie.sameSite}
          </span>
        ))
      ) : (
        <span>No Set-Cookie headers detected</span>
      )}
    </div>
  );
}

function AipcEvaluation({ evaluation }) {
  if (!evaluation) return <p className="aipc-text">AIPC evaluation was not returned.</p>;

  const result = formatAipcResult(evaluation.result);

  return (
    <div className="aipc-card">
      <div>
        <strong>{evaluation.status}</strong>
        <span>{evaluation.summary}</span>
      </div>
      {result && <pre>{result}</pre>}
    </div>
  );
}

function DeepEvidence({ report }) {
  return (
    <div className="evidence-grid">
      <EvidenceBlock title="Pages crawled" items={(report.pagesScanned || []).map((page) => `${page.status || "n/a"} · ${page.title}`)} />
      <EvidenceBlock title="Policy language" items={(report.policySignals || []).map((signal) => signal.label)} empty="No key policy terms detected" />
      <EvidenceBlock title="Forms and fields" items={(report.forms || []).map((form) => `${form.method} · ${form.sensitiveFieldCount} sensitive field signal(s)`)} empty="No public forms detected" />
      <EvidenceBlock
        title="Security headers"
        items={Object.entries(report.securityHeaders || {}).map(([key, value]) => `${headerLabel(key)}: ${value ? "present" : "missing"}`)}
      />
    </div>
  );
}

function EvidenceBlock({ title, items, empty = "No signal detected" }) {
  return (
    <div className="evidence-block">
      <strong>{title}</strong>
      {items.length ? items.slice(0, 8).map((item) => <span key={item}>{item}</span>) : <span>{empty}</span>}
    </div>
  );
}

function headerLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatAipcResult(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (result.message?.content) return result.message.content;
  return JSON.stringify(result, null, 2);
}

createRoot(document.getElementById("root")).render(<App />);
