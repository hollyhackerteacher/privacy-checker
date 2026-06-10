import express from "express";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load } from "cheerio";
import { getDomain } from "tldts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
const port = process.env.PORT || 5173;
const PAGE_LIMIT = Number(process.env.SCAN_PAGE_LIMIT || 6);
const PAGE_TIMEOUT_MS = Number(process.env.SCAN_PAGE_TIMEOUT_MS || 15000);

const AD_PATTERNS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "facebook.net",
  "connect.facebook.net",
  "adsystem.com",
  "adservice",
  "scorecardresearch.com",
  "quantserve.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "hotjar.com",
  "fullstory.com",
  "clarity.ms",
  "segment.com",
  "mixpanel.com",
  "amplitude.com"
];

const PROCESSOR_PATTERNS = [
  "cloudflare.com",
  "cloudfront.net",
  "akamai",
  "fastly.net",
  "jsdelivr.net",
  "unpkg.com",
  "stripe.com",
  "paypal.com",
  "youtube.com",
  "vimeo.com",
  "wistia.com",
  "googleapis.com",
  "gstatic.com",
  "fonts.net",
  "typekit.net",
  "intercom.io",
  "zendesk.com"
];

const UTAH_REFERENCES = [
  {
    label: "USBE Student Data Privacy",
    url: "https://schools.utah.gov/studentdataprivacy/index.php"
  },
  {
    label: "USBE Laws & Policies",
    url: "https://schools.utah.gov/studentdataprivacy/laws.php"
  },
  {
    label: "Board Rule R277-487",
    url: "https://schools.utah.gov/adminrules/R277-487.php"
  },
  {
    label: "Utah Code 53E-9-301",
    url: "https://le.utah.gov/xcode/Title53E/Chapter9/53E-9-S301.html"
  }
];

app.get("/api/scan", async (req, res) => {
  try {
    const targetUrl = normalizeUrl(req.query.url);
    const startedAt = new Date().toISOString();
    const scan = await scanWebsite(targetUrl);
    const report = await buildReport({ targetUrl, startedAt, scan });
    res.json(report);
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "The site did not respond before the 15 second timeout."
        : error.message || "Unable to scan this URL.";
    res.status(400).json({ error: message });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(root, "dist/index.html")));
} else {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`Privacy checker running at http://localhost:${port}`);
});

function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Enter a website URL to scan.");
  }

  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS websites can be scanned.");
  }

  return parsed;
}

async function scanWebsite(targetUrl) {
  const firstPage = await fetchPage(targetUrl.href);
  const firstUrl = new URL(firstPage.url);
  const firstPartyDomain = getDomain(firstUrl.hostname) || firstUrl.hostname;
  const queued = discoverDeepUrls(firstPage, firstPartyDomain);
  const pages = [firstPage];
  const seen = new Set([normalizeForSeen(firstPage.url)]);

  for (const url of queued) {
    if (pages.length >= PAGE_LIMIT) break;
    const key = normalizeForSeen(url);
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      pages.push(await fetchPage(url));
    } catch {
      pages.push({ url, status: 0, title: "Fetch failed", html: "", error: "Unable to fetch page." });
    }
  }

  return {
    finalUrl: firstPage.url,
    firstPartyDomain,
    pages: pages.map(analyzePage),
    pageLimit: PAGE_LIMIT
  };
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; UtahK12PrivacyChecker/0.2; +https://schools.utah.gov/studentdataprivacy/)"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    const html = contentType.includes("text/html") ? await response.text() : "";

    return {
      url: response.url,
      status: response.status,
      html,
      contentType,
      cookieHeaders: getSetCookieHeaders(response),
      headers: {
        contentSecurityPolicy: response.headers.get("content-security-policy") || "",
        strictTransportSecurity: response.headers.get("strict-transport-security") || "",
        permissionsPolicy: response.headers.get("permissions-policy") || "",
        referrerPolicy: response.headers.get("referrer-policy") || ""
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

function analyzePage(page) {
  const $ = load(page.html || "");
  const baseUrl = new URL(page.url);

  return {
    url: page.url,
    status: page.status,
    title: $("title").first().text().replace(/\s+/g, " ").trim() || baseUrl.hostname,
    error: page.error,
    cookieHeaders: page.cookieHeaders || [],
    cookies: (page.cookieHeaders || []).map((header) => parseCookieHeader(header, page.url)),
    resourceUrls: collectResourceUrls($, baseUrl),
    storageSignals: detectStorageSignals(page.html || ""),
    privacyLinks: collectPrivacyLinks($, baseUrl),
    forms: collectForms($, baseUrl),
    policySignals: detectPolicySignals($.text()),
    securityHeaders: page.headers || {}
  };
}

async function buildReport({ targetUrl, startedAt, scan }) {
  const finalUrl = new URL(scan.finalUrl);
  const pages = scan.pages;
  const firstPage = pages[0];
  const resourceUrls = pages.flatMap((page) => page.resourceUrls);
  const cookieHeaders = pages.flatMap((page) => page.cookieHeaders);
  const storageSignals = uniqueByLabel(pages.flatMap((page) => page.storageSignals));
  const privacyLinks = uniqueByUrl(pages.flatMap((page) => page.privacyLinks)).slice(0, 12);
  const forms = pages.flatMap((page) => page.forms);
  const policySignals = summarizePolicySignals(pages);
  const securityHeaders = summarizeSecurityHeaders(pages);
  const pagesScanned = pages.map(({ url, status, title, error }) => ({ url, status, title, error }));
  const firstPartyDomain = scan.firstPartyDomain;
  const thirdParties = classifyThirdParties(resourceUrls, firstPartyDomain);
  const scores = scoreFindings({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders });
  const findings = buildFindings({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders, pagesScanned });

  const report = {
    scannedAt: startedAt,
    requestedUrl: targetUrl.href,
    finalUrl: finalUrl.href,
    httpStatus: firstPage.status,
    pageTitle: firstPage.title,
    summary: {
      risk: scores.risk,
      score: scores.score,
      counts: {
        pagesScanned: pages.length,
        cookies: cookieHeaders.length,
        advertisers: thirdParties.advertisers.length,
        processors: thirdParties.processors.length,
        otherThirdParties: thirdParties.other.length,
        forms: forms.length
      }
    },
    categories: [
      category("Pages scanned", pages.length, pages.length > 1 ? "Deep scan" : "Single page"),
      category("Cookies", cookieHeaders.length, cookieHeaders.length ? "Review" : "Low signal"),
      category("Advertising or analytics", thirdParties.advertisers.length, thirdParties.advertisers.length ? "High review" : "Low signal"),
      category("Third-party processors", thirdParties.processors.length, thirdParties.processors.length ? "Review DPA" : "Low signal"),
      category("Forms detected", forms.length, forms.length ? "Review data" : "Low signal"),
      category("Privacy policy links", privacyLinks.length, privacyLinks.length ? "Found" : "Missing")
    ],
    thirdParties,
    cookies: pages.flatMap((page) => page.cookies),
    storageSignals,
    privacyLinks,
    pagesScanned,
    forms,
    policySignals,
    securityHeaders,
    findings,
    utahReview: buildUtahNotes({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals }),
    references: UTAH_REFERENCES,
    limitations: [
      `This is a bounded public scan of up to ${scan.pageLimit} public pages.`,
      "It does not log in, accept consent banners, submit forms, run classroom workflows, or confirm legal compliance.",
      "District review should still verify contracts, data privacy agreements, vendor terms, data retention, and student data elements."
    ]
  };

  report.aipcEvaluation = await evaluateWithAipc(report);
  return report;
}

function discoverDeepUrls(page, firstPartyDomain) {
  const $ = load(page.html || "");
  const baseUrl = new URL(page.url);
  const candidates = [];

  $("a[href]").each((_index, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const href = $(element).attr("href");
    try {
      const url = new URL(href, baseUrl);
      const domain = getDomain(url.hostname) || url.hostname;
      if (domain !== firstPartyDomain || !["http:", "https:"].includes(url.protocol)) return;

      const haystack = `${text} ${url.pathname}`.toLowerCase();
      const score = scoreDeepLink(haystack);
      if (score > 0) candidates.push({ url: url.href, score });
    } catch {
      // Ignore malformed links.
    }
  });

  return candidates
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

function scoreDeepLink(value) {
  const rules = [
    [/privacy|student.?privacy|data.?privacy/, 100],
    [/terms|conditions|legal/, 80],
    [/cookie|tracking|advertising|subprocessor|processor|security|trust|dpa/, 70],
    [/children|student|school|parent|education|ferpa|coppa|utah/, 55],
    [/login|sign.?in|signup|register|account/, 35],
    [/contact|support|about/, 15]
  ];

  return rules.reduce((total, [pattern, score]) => total + (pattern.test(value) ? score : 0), 0);
}

function normalizeForSeen(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href.replace(/\/$/, "");
}

function collectResourceUrls($, baseUrl) {
  const urls = new Set();
  const selectors = [
    ["script[src]", "src"],
    ["iframe[src]", "src"],
    ["img[src]", "src"],
    ["link[href]", "href"],
    ["form[action]", "action"],
    ["source[src]", "src"]
  ];

  for (const [selector, attr] of selectors) {
    $(selector).each((_index, element) => addUrl(urls, $(element).attr(attr), baseUrl));
  }

  $("[srcset]").each((_index, element) => {
    for (const candidate of ($(element).attr("srcset") || "").split(",")) {
      addUrl(urls, candidate.trim().split(/\s+/)[0], baseUrl);
    }
  });

  for (const match of htmlUrlMatches($.html())) {
    addUrl(urls, match, baseUrl);
  }

  return [...urls];
}

function htmlUrlMatches(html) {
  return html.match(/https?:\/\/[^\s"'<>)]{4,}/gi) || [];
}

function addUrl(urls, value, baseUrl) {
  if (!value || value.startsWith("data:") || value.startsWith("mailto:") || value.startsWith("tel:")) return;
  try {
    urls.add(new URL(value, baseUrl).href);
  } catch {
    // Ignore malformed embedded values.
  }
}

function classifyThirdParties(resourceUrls, firstPartyDomain) {
  const buckets = { advertisers: [], processors: [], other: [] };
  const seen = new Set();

  for (const resourceUrl of resourceUrls) {
    const parsed = new URL(resourceUrl);
    const domain = getDomain(parsed.hostname) || parsed.hostname;
    if (domain === firstPartyDomain || seen.has(domain)) continue;
    seen.add(domain);

    const entry = {
      domain,
      host: parsed.hostname,
      sampleUrl: resourceUrl,
      category: classifyDomain(parsed.hostname)
    };

    if (entry.category === "Advertising / analytics") buckets.advertisers.push(entry);
    else if (entry.category === "Processor / infrastructure") buckets.processors.push(entry);
    else buckets.other.push(entry);
  }

  return buckets;
}

function classifyDomain(hostname) {
  const host = hostname.toLowerCase();
  if (AD_PATTERNS.some((pattern) => host.includes(pattern))) return "Advertising / analytics";
  if (PROCESSOR_PATTERNS.some((pattern) => host.includes(pattern))) return "Processor / infrastructure";
  return "Third-party resource";
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseCookieHeader(header, pageUrl = "") {
  const [nameValue, ...attributes] = header.split(";").map((part) => part.trim());
  const [name] = nameValue.split("=");
  return {
    name: name || "unnamed",
    pageUrl,
    secure: attributes.some((attr) => /^secure$/i.test(attr)),
    httpOnly: attributes.some((attr) => /^httponly$/i.test(attr)),
    sameSite: attributes.find((attr) => /^samesite=/i.test(attr))?.split("=")[1] || "Not declared"
  };
}

function detectStorageSignals(html) {
  const checks = [
    ["document.cookie", "JavaScript cookie access"],
    ["localStorage", "Local storage"],
    ["sessionStorage", "Session storage"],
    ["indexedDB", "IndexedDB"]
  ];

  return checks
    .filter(([token]) => html.includes(token))
    .map(([token, label]) => ({ token, label }));
}

function collectPrivacyLinks($, baseUrl) {
  const links = [];
  $("a[href]").each((_index, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const href = $(element).attr("href");
    if (!/privacy|terms|data|student/i.test(`${text} ${href}`)) return;
    try {
      links.push({ label: text || href, url: new URL(href, baseUrl).href });
    } catch {
      // Ignore malformed links.
    }
  });
  return links.slice(0, 8);
}

function collectForms($, baseUrl) {
  const forms = [];

  $("form").each((_index, element) => {
    const form = $(element);
    const fields = [];
    form.find("input, textarea, select").each((_fieldIndex, fieldElement) => {
      const field = $(fieldElement);
      const fieldText = [
        field.attr("name"),
        field.attr("id"),
        field.attr("placeholder"),
        field.attr("type"),
        field.attr("autocomplete")
      ]
        .filter(Boolean)
        .join(" ");
      if (!fieldText) return;
      fields.push({
        name: field.attr("name") || field.attr("id") || field.attr("placeholder") || "unnamed",
        type: field.attr("type") || fieldElement.tagName?.toLowerCase() || "field",
        sensitive: isSensitiveField(fieldText)
      });
    });

    let action = "";
    try {
      action = new URL(form.attr("action") || baseUrl.href, baseUrl).href;
    } catch {
      action = form.attr("action") || "";
    }

    forms.push({
      action,
      method: (form.attr("method") || "GET").toUpperCase(),
      fields: fields.slice(0, 16),
      sensitiveFieldCount: fields.filter((field) => field.sensitive).length
    });
  });

  return forms.slice(0, 20);
}

function isSensitiveField(value) {
  return /student|child|name|email|phone|address|birth|birthday|dob|grade|school|teacher|parent|guardian|location|password|username|id/i.test(value);
}

function detectPolicySignals(text) {
  const normalized = text.replace(/\s+/g, " ").slice(0, 60000);
  const checks = [
    ["studentData", "Student data", /student data|student information|education record|school record/i],
    ["children", "Children or minors", /children|child|minor|under 13|coppa/i],
    ["ferpa", "FERPA", /ferpa/i],
    ["coppa", "COPPA", /coppa/i],
    ["targetedAdvertising", "Targeted advertising", /targeted advertising|behavioral advertising|interest-based advertising|cross-site/i],
    ["sellShare", "Sell or share language", /sell|share personal information|third parties/i],
    ["subprocessors", "Subprocessors", /subprocessor|service provider|processor|vendor/i],
    ["retention", "Data retention", /retain|retention|delete|deletion|destroy/i],
    ["security", "Security controls", /encrypt|security|safeguard|access control/i],
    ["utah", "Utah reference", /utah|ucpa|student data protection/i],
    ["dpa", "DPA or contract", /data privacy agreement|dpa|contract/i]
  ];

  return checks
    .filter(([, , pattern]) => pattern.test(normalized))
    .map(([key, label]) => ({ key, label }));
}

function summarizePolicySignals(pages) {
  const byKey = new Map();

  for (const page of pages) {
    for (const signal of page.policySignals) {
      if (!byKey.has(signal.key)) byKey.set(signal.key, { ...signal, pages: [] });
      byKey.get(signal.key).pages.push(page.url);
    }
  }

  return [...byKey.values()];
}

function summarizeSecurityHeaders(pages) {
  const firstPage = pages[0] || { securityHeaders: {} };
  const headers = firstPage.securityHeaders || {};

  return {
    contentSecurityPolicy: Boolean(headers.contentSecurityPolicy),
    strictTransportSecurity: Boolean(headers.strictTransportSecurity),
    permissionsPolicy: Boolean(headers.permissionsPolicy),
    referrerPolicy: Boolean(headers.referrerPolicy)
  };
}

function uniqueByLabel(items) {
  return [...new Map(items.map((item) => [item.label, item])).values()];
}

function uniqueByUrl(items) {
  return [...new Map(items.map((item) => [item.url, item])).values()];
}

function scoreFindings({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders }) {
  let score = 100;
  score -= thirdParties.advertisers.length * 18;
  score -= thirdParties.processors.length * 8;
  score -= thirdParties.other.length * 4;
  score -= cookieHeaders.length * 6;
  score -= storageSignals.length * 5;
  score -= forms.filter((form) => form.sensitiveFieldCount > 0).length * 8;
  if (!privacyLinks.length) score -= 14;
  if (policySignals.some((signal) => signal.key === "targetedAdvertising")) score -= 12;
  if (!policySignals.some((signal) => signal.key === "retention")) score -= 5;
  if (!securityHeaders.contentSecurityPolicy) score -= 4;
  if (!securityHeaders.strictTransportSecurity) score -= 4;
  score = Math.max(0, Math.min(100, score));

  const risk = score >= 82 ? "Low" : score >= 60 ? "Moderate" : "High";
  return { score, risk };
}

function category(label, count, status) {
  return { label, count, status };
}

function buildFindings({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders, pagesScanned }) {
  const rows = [];

  rows.push({
    severity: "Low",
    area: "Scan depth",
    evidence: `${pagesScanned.length} public page(s) scanned: ${pagesScanned.map((page) => page.title).join(", ")}`,
    action: "Use the scanned page list to confirm whether the site requires login or has additional student-facing flows."
  });

  if (cookieHeaders.length) {
    rows.push({
      severity: "Review",
      area: "Cookies",
      evidence: `${cookieHeaders.length} Set-Cookie header(s) observed on the public page.`,
      action: "Confirm purpose, duration, consent needs, and whether cookies are used for student tracking."
    });
  }

  if (thirdParties.advertisers.length) {
    rows.push({
      severity: "High",
      area: "Advertising / analytics",
      evidence: thirdParties.advertisers.map((item) => item.domain).join(", "),
      action: "Verify the vendor does not use student data for targeted advertising or unrelated profiling."
    });
  }

  if (thirdParties.processors.length) {
    rows.push({
      severity: "Review",
      area: "Third-party processors",
      evidence: thirdParties.processors.map((item) => item.domain).join(", "),
      action: "Check data privacy agreement coverage, subprocessors, security terms, and breach notification language."
    });
  }

  if (storageSignals.length) {
    rows.push({
      severity: "Review",
      area: "Browser storage",
      evidence: storageSignals.map((item) => item.label).join(", "),
      action: "Confirm what student or device data is stored locally and whether it persists after sign-out."
    });
  }

  const sensitiveForms = forms.filter((form) => form.sensitiveFieldCount > 0);
  if (sensitiveForms.length) {
    rows.push({
      severity: "Review",
      area: "Forms and data entry",
      evidence: `${sensitiveForms.length} form(s) include fields that may collect student, parent, account, or contact data.`,
      action: "Confirm what each form collects, whether students use it, and whether submitted data is covered by a DPA."
    });
  }

  const policyLabels = policySignals.map((signal) => signal.label);
  if (policyLabels.length) {
    rows.push({
      severity: policySignals.some((signal) => ["targetedAdvertising", "sellShare"].includes(signal.key)) ? "High" : "Review",
      area: "Policy language",
      evidence: policyLabels.join(", "),
      action: "Read the linked policies for student-specific terms, advertising limits, retention, deletion, subprocessors, and Utah applicability."
    });
  }

  if (!securityHeaders.contentSecurityPolicy || !securityHeaders.strictTransportSecurity) {
    rows.push({
      severity: "Review",
      area: "Security headers",
      evidence: [
        !securityHeaders.contentSecurityPolicy ? "Content-Security-Policy missing" : "",
        !securityHeaders.strictTransportSecurity ? "Strict-Transport-Security missing" : ""
      ].filter(Boolean).join(", "),
      action: "Ask the vendor about browser security controls and whether production pages enforce HTTPS and script restrictions."
    });
  }

  if (!privacyLinks.length) {
    rows.push({
      severity: "Review",
      area: "Public documentation",
      evidence: "No privacy or data policy link was detected on the scanned page.",
      action: "Request vendor privacy policy, student data terms, and DPA before classroom adoption."
    });
  }

  return rows.length ? rows : [
    {
      severity: "Low",
      area: "Public page scan",
      evidence: "No obvious cookies, advertising trackers, third-party processors, or missing privacy links were detected.",
      action: "Continue with contract, DPA, and classroom workflow review."
    }
  ];
}

function buildUtahNotes({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals }) {
  return [
    {
      label: "Student data protection",
      status: thirdParties.processors.length ? "Needs DPA review" : "No processor signal",
      detail:
        "For any site receiving student data, verify DPA/contract terms, subprocessors, security controls, breach notice, retention, and deletion."
    },
    {
      label: "Advertising and profiling",
      status: thirdParties.advertisers.length ? "High priority review" : "No ad-tech signal",
      detail:
        "Advertising or analytics domains should be reviewed for targeted advertising, cross-site tracking, and use beyond the educational purpose."
    },
    {
      label: "Cookies and storage",
      status: cookieHeaders.length || storageSignals.length ? "Review purpose" : "Low signal",
      detail:
        "Document cookie/storage purpose, whether identifiers are tied to students, and whether consent or opt-out workflows apply."
    },
    {
      label: "Vendor documentation",
      status: privacyLinks.length ? "Policy link found" : "Request documentation",
      detail:
        "Attach vendor privacy policy, student data privacy terms, DPA status, and district approval evidence to the final evaluation."
    },
    {
      label: "Student-facing workflows",
      status: forms.some((form) => form.sensitiveFieldCount > 0) ? "Review form fields" : "No sensitive form signal",
      detail:
        "If teachers or students sign in, submit assignments, or enter contact details, review those flows separately from the public homepage scan."
    },
    {
      label: "Policy depth",
      status: policySignals.length ? "Policy terms detected" : "Policy terms not detected",
      detail:
        "Look for student-data-specific language covering FERPA/COPPA, targeted advertising, data retention, deletion, subprocessors, and district contract terms."
    }
  ];
}

async function evaluateWithAipc(report) {
  const endpoint = process.env.AIPC_ENDPOINT || process.env.OLLAMA_BASE_URL;
  if (!endpoint) {
    return {
      status: "Not configured",
      summary: "Set AIPC_ENDPOINT or OLLAMA_BASE_URL on the server to enable AI privacy evaluation."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AIPC_TIMEOUT_MS || 30000));

  try {
    const request = buildAipcRequest(endpoint, report);
    const response = await fetch(request.url, {
      method: "POST",
      signal: controller.signal,
      headers: request.headers,
      body: JSON.stringify(request.body)
    });

    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      return {
        status: "Error",
        summary: `AIPC returned HTTP ${response.status}.`,
        result
      };
    }

    return {
      status: "Completed",
      summary: "AIPC evaluation completed.",
      result
    };
  } catch (error) {
    return {
      status: "Error",
      summary:
        error.name === "AbortError"
          ? "AIPC evaluation timed out."
          : error.message || "AIPC evaluation failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildAipcPayload(report) {
  return {
    scannedAt: report.scannedAt,
    requestedUrl: report.requestedUrl,
    finalUrl: report.finalUrl,
    httpStatus: report.httpStatus,
    pageTitle: report.pageTitle,
    summary: report.summary,
    categories: report.categories,
    thirdParties: report.thirdParties,
    cookies: report.cookies,
    storageSignals: report.storageSignals,
    privacyLinks: report.privacyLinks,
    pagesScanned: report.pagesScanned,
    forms: report.forms,
    policySignals: report.policySignals,
    securityHeaders: report.securityHeaders,
    findings: report.findings,
    utahReview: report.utahReview,
    references: report.references
  };
}

function buildAipcRequest(endpoint, report) {
  const isOllama = process.env.AIPC_PROVIDER === "ollama" || endpoint.includes(":11434");
  const url = isOllama ? new URL("/api/chat", endpoint).href : endpoint;
  const headers = {
    "content-type": "application/json",
    ...(process.env.AIPC_API_KEY ? { authorization: `Bearer ${process.env.AIPC_API_KEY}` } : {})
  };
  const prompt = [
    "Evaluate this website privacy scan for Utah K-12 school use.",
    "Focus on cookies, advertising/analytics trackers, third-party processors, student data risk, DPA review needs, and teacher/IT director recommendations.",
    "Return a concise report with: overall assessment, key concerns, questions for the vendor, and recommended decision.",
    JSON.stringify(buildAipcPayload(report), null, 2)
  ].join("\n\n");

  if (isOllama) {
    return {
      url,
      headers,
      body: {
        model: process.env.AIPC_MODEL || "qwen2.5:14b",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are a K-12 student-data privacy reviewer. Be practical, cautious, and concise. Do not claim legal compliance; identify review risks and next steps."
          },
          { role: "user", content: prompt }
        ]
      }
    };
  }

  return {
    url,
    headers,
    body: {
      task: "utah_k12_privacy_evaluation",
      instructions:
        "Evaluate the scanned website data for Utah K-12 privacy review. Focus on cookies, advertising, third-party processors, student data risk, DPA review needs, and teacher/IT director recommendations.",
      scannedData: buildAipcPayload(report)
    }
  };
}
