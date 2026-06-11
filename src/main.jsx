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

const defaultReferences = [
  { label: "USBE Student Data Privacy", url: "https://schools.utah.gov/studentdataprivacy/index.php" },
  { label: "USBE Laws & Policies", url: "https://schools.utah.gov/studentdataprivacy/laws.php" },
  { label: "Board Rule R277-487", url: "https://schools.utah.gov/adminrules/R277-487.php" },
  { label: "Utah Code 53E-9-301", url: "https://le.utah.gov/xcode/Title53E/Chapter9/53E-9-S301.html" },
  { label: "FERPA Regulations - 34 CFR Part 99", url: "https://studentprivacy.ed.gov/ferpa" },
  { label: "FERPA School Official Exception", url: "https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa" }
];

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
  highLevelSummary: {
    rating: "Not approved baseline",
    decision: "Deny until agreement fixes concerns",
    score: 74,
    summary:
      "The scan found advertising and processor signals that should block classroom use unless a district-approved agreement resolves them.",
    concerning: ["Browser storage may create persistent student or device identifiers."],
    likelyViolationWithoutAgreement: [
      "Advertising or analytics tracker domains were detected. For K-12 use, this should be treated as not approved unless a written agreement prohibits targeted advertising, profiling, sale/share, and secondary use of student data."
    ],
    requiresDetailedReview: [
      "Public forms appear to collect account or contact data. This triggers FERPA/Utah review before a ruling."
    ]
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
  ferpaConsiderations: [
    {
      label: "Education records and student PII",
      status: "Possible student PII collection",
      detail:
        "If the site receives student names, emails, grades, assignments, login identifiers, or other education-record information, FERPA restrictions may apply."
    },
    {
      label: "School official exception",
      status: "Agreement needed",
      detail:
        "For outsourced services, FERPA generally requires the provider to perform an institutional service, be under school or district direct control for the data, and use PII only for the disclosed educational purpose."
    }
  ],
  references: [
    { label: "USBE Student Data Privacy", url: "https://schools.utah.gov/studentdataprivacy/index.php" },
    { label: "USBE Laws & Policies", url: "https://schools.utah.gov/studentdataprivacy/laws.php" },
    { label: "Board Rule R277-487", url: "https://schools.utah.gov/adminrules/R277-487.php" },
    { label: "Utah Code 53E-9-301", url: "https://le.utah.gov/xcode/Title53E/Chapter9/53E-9-S301.html" }
  ],
  teacherNotification: {
    status: "Not configured",
    summary: "Set AIPC_ENDPOINT or OLLAMA_BASE_URL on the server to generate teacher notification emails.",
    email:
      "Subject: Website Privacy Review - Example Learning Site\n\nDecision: Deny until agreement fixes concerns\nBaseline rating: Not approved baseline (74/100)\n\nI reviewed this site for Utah K-12 privacy concerns. Advertising trackers and third-party processors were detected, so this should not be approved for student use unless a district-approved agreement resolves those concerns."
  },
  limitations: [
    "This is a first-pass technical scan of the public page only.",
    "District review should still verify contracts, data privacy agreements, vendor terms, data retention, and student data elements."
  ]
};

function App() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generatedAt = useMemo(() => {
    if (!report) return "";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(report.scannedAt));
  }, [report]);

  async function runScan(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/scan?url=${encodeURIComponent(url.trim())}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Scan failed.");
      setReport(payload);
      setSelectedFinding(null);
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    if (!report) return;
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
          <button className="icon-button" onClick={() => window.print()} title="Print report" disabled={!report}>
            <Printer size={18} />
          </button>
          <button className="icon-button" onClick={downloadReport} title="Download JSON report" disabled={!report}>
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
                placeholder="vendor-site.com"
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
            {(report?.references || defaultReferences).map((reference) => (
              <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">
                {reference.label}
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        </aside>

        <section className="report" aria-live="polite">
          {!report ? (
            <EmptyReport />
          ) : (
            <>
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

          <section className="report-section summary-section">
            <div className="section-title">
              <ShieldCheck size={18} />
              <h2>High Level Summary</h2>
            </div>
            <HighLevelSummary summary={report.highLevelSummary} />
          </section>

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
                <span>Conclusion</span>
              </div>
              {report.findings.map((finding, index) => (
                <button className="table-row clickable-row" key={`${finding.area}-${index}`} onClick={() => setSelectedFinding(finding)}>
                  <span><Severity value={finding.severity} /></span>
                  <span>{finding.area}</span>
                  <span>{finding.evidence}</span>
                  <span>{finding.action}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="split-sections">
            <div className="report-section">
              <div className="section-title">
                <UsersRound size={18} />
                <h2>Utah K-12 and FERPA Notes</h2>
              </div>
              <div className="note-list">
                {[...(report.utahReview || []), ...(report.ferpaConsiderations || [])].map((note) => (
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
              <FileText size={18} />
              <h2>Summarized Email Explanation</h2>
            </div>
            <TeacherNotification notification={report.teacherNotification} />
          </section>

          <section className="limitations">
            <strong>Report limitations</strong>
            {report.limitations.map((item) => <span key={item}>{item}</span>)}
          </section>
          <FindingDrilldown finding={selectedFinding} report={report} onClose={() => setSelectedFinding(null)} />
          </>
          )}
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

function HighLevelSummary({ summary }) {
  if (!summary) return <p className="aipc-text">No high-level summary was returned.</p>;

  return (
    <div className="summary-grid">
      <div className="summary-ruling">
        <span>Overall rating</span>
        <strong>{summary.rating}</strong>
        <em>{summary.score}/100 · {summary.decision}</em>
        <p>{summary.summary}</p>
      </div>
      <SummaryList title="Concerning" items={summary.concerning} empty="No separate concerning signals detected" />
      <SummaryList title="Likely Violation Without Agreement" items={summary.likelyViolationWithoutAgreement} empty="No denial-level public signal detected" />
      <SummaryList title="Needs Detailed Review" items={summary.requiresDetailedReview} empty="No detailed-review item detected" />
    </div>
  );
}

function SummaryList({ title, items = [], empty }) {
  return (
    <div className="summary-list">
      <strong>{title}</strong>
      {(items.length ? items : [empty]).slice(0, 5).map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function TeacherNotification({ notification }) {
  const text = notification?.email || "";

  async function copyEmail() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="aipc-card">
      <div className="email-header">
        <div>
          <strong>{notification?.status || "Not generated"}</strong>
          <span>{notification?.summary || "No teacher notification was returned."}</span>
        </div>
        <button className="secondary-button" onClick={copyEmail} disabled={!text}>
          Copy Email
        </button>
      </div>
      {text && <pre>{text}</pre>}
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

function EmptyReport() {
  return (
    <div className="empty-report">
      <ShieldCheck size={32} />
      <h1>Ready for a privacy check</h1>
      <p>Enter a website URL to generate a Utah K-12 privacy report, findings drill-down, FERPA notes, and teacher-ready notification email.</p>
    </div>
  );
}

function FindingDrilldown({ finding, report, onClose }) {
  if (!finding) return null;
  const details = drilldownDetails(finding, report);

  return (
    <div className="drilldown" role="dialog" aria-modal="true" aria-label={`${finding.area} finding details`}>
      <div className="drilldown-panel">
        <div className="drilldown-header">
          <div>
            <span><Severity value={finding.severity} /></span>
            <h2>{finding.area}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close details">×</button>
        </div>
        <div className="drilldown-body">
          <DetailLine label="Evidence" value={finding.evidence} />
          <DetailLine label="Conclusion" value={finding.action} />
          <div className="drilldown-list">
            <strong>Actual detected items</strong>
            {details.length ? details.map((item) => <span key={item}>{item}</span>) : <span>No additional detail available.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className="detail-line">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function drilldownDetails(finding, report) {
  const area = finding.area.toLowerCase();
  if (area.includes("cookie")) {
    return (report.cookies || []).map((cookie) => `${cookie.name} · ${cookie.purpose || "Unknown"} · SameSite ${cookie.sameSite} · ${cookie.pageUrl || report.finalUrl}`);
  }
  if (area.includes("advertising")) {
    return (report.thirdParties?.advertisers || []).map((item) => `${item.domain} · ${item.host} · ${item.sampleUrl}`);
  }
  if (area.includes("processor")) {
    return (report.thirdParties?.processors || []).map((item) => `${item.domain} · ${item.host} · ${item.sampleUrl}`);
  }
  if (area.includes("form")) {
    return (report.forms || []).map((form) => `${form.method} ${form.action} · fields: ${form.fields.map((field) => `${field.name}${field.sensitive ? " (sensitive)" : ""}`).join(", ")}`);
  }
  if (area.includes("policy")) {
    return (report.policySignals || []).map((signal) => `${signal.label} · found on ${signal.pages?.length || 0} page(s)`);
  }
  if (area.includes("security")) {
    return Object.entries(report.securityHeaders || {}).map(([key, value]) => `${headerLabel(key)}: ${value ? "present" : "missing"}`);
  }
  if (area.includes("documentation")) {
    return (report.privacyLinks || []).map((link) => `${link.label}: ${link.url}`);
  }
  if (area.includes("scan depth")) {
    return (report.pagesScanned || []).map((page) => `${page.status || "n/a"} · ${page.title} · ${page.url}`);
  }
  return [
    ...(report.thirdParties?.other || []).map((item) => `${item.domain} · ${item.host} · ${item.sampleUrl}`),
    ...(report.storageSignals || []).map((item) => item.label)
  ];
}

createRoot(document.getElementById("root")).render(<App />);
