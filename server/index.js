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
  },
  {
    label: "FERPA Regulations - 34 CFR Part 99",
    url: "https://studentprivacy.ed.gov/ferpa"
  },
  {
    label: "FERPA School Official Exception",
    url: "https://studentprivacy.ed.gov/faq/who-school-official-under-ferpa"
  },
  {
    label: "FTC COPPA Rule",
    url: "https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa"
  }
];

app.get("/api/scan", async (req, res) => {
  try {
    const candidates = normalizeUrlCandidates(req.query.url);
    const startedAt = new Date().toISOString();
    const { targetUrl, scan } = await scanFirstReachable(candidates);
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

function normalizeUrlCandidates(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Enter a website URL to scan.");
  }

  const trimmed = rawUrl.trim();
  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const parsedInput = new URL(hasProtocol ? trimmed : `https://${trimmed}`);

  if (!["http:", "https:"].includes(parsedInput.protocol)) {
    throw new Error("Only HTTP and HTTPS websites can be scanned.");
  }

  const host = parsedInput.hostname.replace(/^www\./i, "");
  const path = `${parsedInput.pathname || "/"}${parsedInput.search || ""}`;
  const candidates = [];

  if (hasProtocol) {
    candidates.push(parsedInput.href);
    if (!parsedInput.hostname.startsWith("www.")) {
      candidates.push(`${parsedInput.protocol}//www.${host}${path}`);
    }
  } else {
    candidates.push(`https://${host}${path}`);
    candidates.push(`https://www.${host}${path}`);
    candidates.push(`http://${host}${path}`);
    candidates.push(`http://www.${host}${path}`);
  }

  return [...new Set(candidates)].map((url) => new URL(url));
}

async function scanFirstReachable(candidates) {
  let lastError;

  for (const targetUrl of candidates) {
    try {
      return { targetUrl, scan: await scanWebsite(targetUrl) };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to resolve this website URL.");
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
    loginSignals: detectLoginSignals($, page.html || ""),
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
  const loginSignals = uniqueByLabel(pages.flatMap((page) => page.loginSignals));
  const policySignals = summarizePolicySignals(pages);
  const securityHeaders = summarizeSecurityHeaders(pages);
  const pagesScanned = pages.map(({ url, status, title, error }) => ({ url, status, title, error }));
  const firstPartyDomain = scan.firstPartyDomain;
  const thirdParties = classifyThirdParties(resourceUrls, firstPartyDomain);
  const scores = scoreFindings({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders });
  const findings = buildFindings({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders, pagesScanned });
  const evaluationChecks = buildEvaluationChecks({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, loginSignals, policySignals, securityHeaders, pagesScanned });
  const highLevelSummary = buildHighLevelSummary({ scores, thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders, evaluationChecks });

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
    loginSignals,
    policySignals,
    securityHeaders,
    evaluationChecks,
    highLevelSummary,
    findings,
    utahReview: buildUtahNotes({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals }),
    ferpaConsiderations: buildFerpaConsiderations({ thirdParties, forms, policySignals }),
    references: UTAH_REFERENCES,
    limitations: [
      `This is a bounded public scan of up to ${scan.pageLimit} public pages.`,
      "It does not log in, accept consent banners, submit forms, run classroom workflows, or confirm legal compliance.",
      "District review should still verify contracts, data privacy agreements, vendor terms, data retention, and student data elements."
    ]
  };

  report.teacherNotification = await createTeacherNotification(report);
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
    [/terms|conditions|legal|tos/, 90],
    [/cookie|tracking|advertising|subprocessor|processor|security|trust|dpa/, 70],
    [/children|student|school|parent|education|ferpa|coppa|utah|accessibility|ai|artificial.?intelligence/, 55],
    [/login|sign.?in|sso|clever|classlink|google|microsoft|signup|register|account/, 35],
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

function classifyCookiePurpose(cookie) {
  const name = cookie.name.toLowerCase();
  if (/^_ga|^_gid|^_gat|fbp|fbc|gcl|doubleclick|ad|track|pixel|mkto|hubspot|intercom|ajs|amplitude|mixpanel/.test(name)) {
    return "Advertising / analytics";
  }
  if (/session|csrf|xsrf|auth|token|login/.test(name)) return "Necessary or account";
  return "Unknown";
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
  const cookie = {
    name: name || "unnamed",
    pageUrl,
    secure: attributes.some((attr) => /^secure$/i.test(attr)),
    httpOnly: attributes.some((attr) => /^httponly$/i.test(attr)),
    sameSite: attributes.find((attr) => /^samesite=/i.test(attr))?.split("=")[1] || "Not declared"
  };
  cookie.purpose = classifyCookiePurpose(cookie);
  return cookie;
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

function detectLoginSignals($, html) {
  const signals = [];
  const text = $.text();
  const checks = [
    ["Google SSO", /continue with google|sign in with google|accounts\.google\.com|googleoauth/i],
    ["Microsoft SSO", /sign in with microsoft|login\.microsoftonline\.com|microsoftonline|azuread/i],
    ["Clever SSO", /clever\.com|sign in with clever/i],
    ["ClassLink SSO", /classlink|launchpad\.classlink\.com/i],
    ["Account login", /log in|login|sign in|student login|teacher login/i],
    ["Account registration", /sign up|create account|register/i]
  ];

  for (const [label, pattern] of checks) {
    if (pattern.test(`${text} ${html}`)) signals.push({ label });
  }

  return signals;
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
    ["dpa", "DPA or contract", /data privacy agreement|dpa|contract/i],
    ["aiTraining", "AI training or model improvement", /train (our )?(ai|models)|model improvement|improve (our )?(ai|models)|machine learning|artificial intelligence|generative ai/i],
    ["automatedDecision", "Automated decision-making", /automated decision|profiling|predictive|algorithmic/i],
    ["parentalConsent", "Parental consent", /parental consent|parent consent|verifiable consent/i],
    ["breach", "Breach notification", /breach|security incident|incident notification|notify.*breach/i],
    ["dataLocation", "Data location or transfer", /data transfer|international transfer|outside the united states|data location|data residency|subprocessor location/i],
    ["accessibility", "Accessibility statement", /accessibility|wcag|ada|section 508/i],
    ["vendorTrust", "Vendor trust certification", /soc 2|iso 27001|security certification|privacy pledge|student privacy pledge/i],
    ["userGeneratedContent", "User-generated content or chat", /user.?generated|post content|chat|message|forum|community|comments/i],
    ["ageSuitability", "Age suitability", /under 13|children under|age requirement|minimum age|not intended for children/i]
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
  if (policySignals.some((signal) => signal.key === "aiTraining")) score -= 10;
  if (policySignals.some((signal) => signal.key === "sellShare")) score -= 12;
  if (!policySignals.some((signal) => signal.key === "retention")) score -= 5;
  if (!policySignals.some((signal) => signal.key === "breach")) score -= 3;
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
    action: "The conclusion is based on public pages only. A login-only student workflow may change the ruling."
  });

  if (cookieHeaders.length) {
    const parsedCookies = cookieHeaders.map((header) => parseCookieHeader(header));
    const adCookieCount = parsedCookies.filter((cookie) => cookie.purpose === "Advertising / analytics").length;
    rows.push({
      severity: adCookieCount ? "High" : "Review",
      area: "Cookies",
      evidence: `${cookieHeaders.length} Set-Cookie header(s) observed on the public page.`,
      action: adCookieCount
        ? "Advertising or analytics cookies are not appropriate for student use unless a written agreement prohibits targeted advertising, profiling, and secondary use."
        : "Cookies appear present but not clearly advertising-related from their names; approval still depends on purpose, retention, and vendor agreement language."
    });
  }

  if (thirdParties.advertisers.length) {
    rows.push({
      severity: "High",
      area: "Advertising / analytics",
      evidence: thirdParties.advertisers.map((item) => item.domain).join(", "),
      action: "Advertising or cross-site analytics trackers are a denial-level concern for K-12 use unless a signed agreement blocks targeted advertising, profiling, sale/share, and reuse of student data."
    });
  }

  if (thirdParties.processors.length) {
    rows.push({
      severity: "Review",
      area: "Third-party processors",
      evidence: thirdParties.processors.map((item) => item.domain).join(", "),
      action: "These subprocessors require written coverage in the vendor agreement or DPA before student use should be approved."
    });
  }

  if (storageSignals.length) {
    rows.push({
      severity: "Review",
      area: "Browser storage",
      evidence: storageSignals.map((item) => item.label).join(", "),
      action: "Persistent browser storage can create student or device identifiers; approve only if the vendor terms limit use to the educational purpose."
    });
  }

  const sensitiveForms = forms.filter((form) => form.sensitiveFieldCount > 0);
  if (sensitiveForms.length) {
    rows.push({
      severity: "Review",
      area: "Forms and data entry",
      evidence: `${sensitiveForms.length} form(s) include fields that may collect student, parent, account, or contact data.`,
      action: "If students enter names, email, school, login, or similar information, FERPA and Utah student-data review should be completed before approval."
    });
  }

  const policyLabels = policySignals.map((signal) => signal.label);
  if (policyLabels.length) {
    rows.push({
      severity: policySignals.some((signal) => ["targetedAdvertising", "sellShare"].includes(signal.key)) ? "High" : "Review",
      area: "Policy language",
      evidence: policyLabels.join(", "),
      action: policySignals.some((signal) => ["targetedAdvertising", "sellShare"].includes(signal.key))
        ? "Policy language suggests advertising or sale/share concepts; do not approve for student use without explicit contractual limits."
        : "Policy terms were detected, but approval depends on whether they specifically cover student data, FERPA use limits, retention, deletion, and subprocessors."
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
      action: "Missing browser security headers do not automatically block approval, but they lower confidence and justify a technical security review."
    });
  }

  if (!privacyLinks.length) {
    rows.push({
      severity: "Review",
      area: "Public documentation",
      evidence: "No privacy or data policy link was detected on the scanned page.",
      action: "Do not approve for classroom use until a privacy policy, student data terms, and district agreement are available."
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

function buildEvaluationChecks({ thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, loginSignals, policySignals, securityHeaders, pagesScanned }) {
  const cookies = cookieHeaders.map((header) => parseCookieHeader(header));
  const adCookies = cookies.filter((cookie) => cookie.purpose === "Advertising / analytics");
  const sensitiveForms = forms.filter((form) => form.sensitiveFieldCount > 0);
  const policy = new Set(policySignals.map((signal) => signal.key));
  const scannedTitles = pagesScanned.map((page) => page.title).join(", ");

  return [
    evaluationCheck("Login / account signals", loginSignals.length ? "review" : "low", loginSignals.length ? loginSignals.map((item) => item.label).join(", ") : "No public login or SSO signal detected.", "If students authenticate through SSO or create accounts, review student data flow and agreement terms."),
    evaluationCheck("Student data categories", sensitiveForms.length ? "review" : "low", sensitiveForms.length ? `${sensitiveForms.length} form(s) may collect student, parent, account, or contact data.` : "No public sensitive form fields detected.", "Names, emails, grades, assignments, photos, voice, location, and device IDs require student-data review."),
    evaluationCheck("COPPA indicators", policy.has("coppa") || policy.has("children") || policy.has("parentalConsent") || policy.has("ageSuitability") ? "review" : "unknown", matchingPolicyLabels(policySignals, ["coppa", "children", "parentalConsent", "ageSuitability"]) || "No COPPA or under-13 policy signal detected.", "For tools directed to children under 13 or collecting personal information from them, check parental consent and school-consent basis."),
    evaluationCheck("FERPA contract fit", policy.has("ferpa") || policy.has("dpa") ? "review" : "unknown", matchingPolicyLabels(policySignals, ["ferpa", "dpa"]) || "No FERPA or DPA language detected in scanned pages.", "Approval is stronger when terms cover educational purpose, school control, no redisclosure, and no secondary use."),
    evaluationCheck("Targeted advertising", thirdParties.advertisers.length || adCookies.length || policy.has("targetedAdvertising") ? "blocker" : "low", [...thirdParties.advertisers.map((item) => item.domain), ...adCookies.map((cookie) => cookie.name), matchingPolicyLabels(policySignals, ["targetedAdvertising"])].filter(Boolean).join(", ") || "No advertising tracker or targeted advertising signal detected.", "Advertising trackers or targeted advertising language should block approval without explicit student-data restrictions."),
    evaluationCheck("Data retention / deletion", policy.has("retention") ? "review" : "review", policy.has("retention") ? "Retention/deletion language detected." : "No retention/deletion language detected.", "District approval should require deletion/return of student data at contract end or request."),
    evaluationCheck("Subprocessor list", thirdParties.processors.length || policy.has("subprocessors") ? "review" : "unknown", [...thirdParties.processors.map((item) => item.domain), matchingPolicyLabels(policySignals, ["subprocessors"])].filter(Boolean).join(", ") || "No public subprocessor signal detected.", "Observed processors should match vendor subprocessor/DPA terms."),
    evaluationCheck("AI use", policy.has("aiTraining") || policy.has("automatedDecision") ? "review" : "unknown", matchingPolicyLabels(policySignals, ["aiTraining", "automatedDecision"]) || "No AI training or automated decision language detected.", "Student data should not be used to train models, improve generalized AI, profile students, or make automated decisions without district-approved terms."),
    evaluationCheck("Security posture", !securityHeaders.strictTransportSecurity || !securityHeaders.contentSecurityPolicy ? "review" : "low", Object.entries(securityHeaders).map(([key, value]) => `${key}: ${value ? "present" : "missing"}`).join(", "), "HTTPS enforcement, CSP, permissions, and referrer policy improve technical confidence."),
    evaluationCheck("Breach terms", policy.has("breach") ? "review" : "review", policy.has("breach") ? "Breach/security incident language detected." : "No breach notification language detected.", "Vendor terms should include breach notification timing and security incident duties."),
    evaluationCheck("Data location", policy.has("dataLocation") ? "review" : "unknown", policy.has("dataLocation") ? "Data location or transfer language detected." : "No data location or international transfer language detected.", "Districts may need to know hosting region, international transfers, and subprocessor locations."),
    evaluationCheck("Accessibility basics", policy.has("accessibility") ? "review" : "unknown", policy.has("accessibility") ? "Accessibility/WCAG statement detected." : "No accessibility statement detected.", "Accessibility does not decide privacy approval, but it matters for classroom suitability."),
    evaluationCheck("Age/content suitability", policy.has("userGeneratedContent") || policy.has("ageSuitability") ? "review" : "low", matchingPolicyLabels(policySignals, ["userGeneratedContent", "ageSuitability"]) || "No user-generated content, chat, or age restriction signal detected.", "Chat, comments, public sharing, unsafe external links, or age restrictions may make a tool unsuitable even if privacy terms are adequate."),
    evaluationCheck("Vendor trust signals", policy.has("vendorTrust") ? "review" : "unknown", policy.has("vendorTrust") ? "Vendor trust/security certification language detected." : "No SOC 2, ISO 27001, privacy pledge, or similar trust signal detected.", "Trust signals support review but do not replace a district DPA."),
    evaluationCheck("Privacy/terms pages inspected", privacyLinks.length ? "review" : "blocker", privacyLinks.length ? `Detected policy/terms links; scanned pages include: ${scannedTitles}` : "No privacy, terms, data, or student policy link detected.", "Approval should rely on actual privacy policy, terms of service, and DPA language.")
  ];
}

function evaluationCheck(label, status, evidence, conclusion) {
  return { label, status, evidence, conclusion };
}

function matchingPolicyLabels(policySignals, keys) {
  return policySignals
    .filter((signal) => keys.includes(signal.key))
    .map((signal) => signal.label)
    .join(", ");
}

function buildHighLevelSummary({ scores, thirdParties, cookieHeaders, storageSignals, privacyLinks, forms, policySignals, securityHeaders, evaluationChecks }) {
  const cookies = cookieHeaders.map((header) => parseCookieHeader(header));
  const adCookies = cookies.filter((cookie) => cookie.purpose === "Advertising / analytics");
  const sensitiveForms = forms.filter((form) => form.sensitiveFieldCount > 0);
  const concerning = [];
  const likelyViolationWithoutAgreement = [];
  const requiresDetailedReview = [];

  if (thirdParties.advertisers.length) {
    likelyViolationWithoutAgreement.push(
      `Advertising or analytics tracker domains were detected (${thirdParties.advertisers.map((item) => item.domain).join(", ")}). For K-12 use, this should be treated as not approved unless a written agreement prohibits targeted advertising, profiling, sale/share, and secondary use of student data.`
    );
  }

  if (adCookies.length) {
    likelyViolationWithoutAgreement.push(
      `Advertising or analytics-style cookies were detected (${adCookies.map((cookie) => cookie.name).join(", ")}). These are a denial-level concern without contract language limiting them to the educational purpose.`
    );
  }

  if (!privacyLinks.length) {
    likelyViolationWithoutAgreement.push(
      "No public privacy or student-data policy link was detected. Without written privacy terms or a DPA, the site should not be approved for student data use."
    );
  }

  if (sensitiveForms.length) {
    requiresDetailedReview.push(
      `${sensitiveForms.length} public form(s) appear to collect account, student, parent, or contact data. This triggers FERPA/Utah review before a ruling.`
    );
  }

  if (thirdParties.processors.length) {
    requiresDetailedReview.push(
      `Third-party processors were detected (${thirdParties.processors.map((item) => item.domain).join(", ")}). These need to be covered as service providers/subprocessors in the vendor agreement.`
    );
  }

  if (storageSignals.length) {
    concerning.push(
      `Browser storage signals were detected (${storageSignals.map((item) => item.label).join(", ")}), which may create persistent student or device identifiers.`
    );
  }

  if (policySignals.some((signal) => signal.key === "targetedAdvertising")) {
    likelyViolationWithoutAgreement.push(
      "Policy language references targeted or behavioral advertising. This is not acceptable for student use without explicit student-data restrictions."
    );
  }

  if (policySignals.some((signal) => signal.key === "sellShare")) {
    likelyViolationWithoutAgreement.push(
      "Policy language references selling or sharing personal information. This requires denial or legal review unless student data is clearly excluded by agreement."
    );
  }

  if (policySignals.some((signal) => signal.key === "aiTraining")) {
    requiresDetailedReview.push(
      "Policy language references AI training, model improvement, or machine learning. Student data should not be used for generalized AI training without explicit district-approved terms."
    );
  }

  if (policySignals.some((signal) => signal.key === "userGeneratedContent")) {
    concerning.push(
      "User-generated content, chat, comments, or community features were detected in policy language. This may create moderation and student safety concerns."
    );
  }

  if (!policySignals.some((signal) => signal.key === "retention")) {
    requiresDetailedReview.push("No data retention/deletion language was detected in the scanned public pages.");
  }

  if (!securityHeaders.contentSecurityPolicy || !securityHeaders.strictTransportSecurity) {
    concerning.push("One or more baseline browser security headers were missing.");
  }

  const decision = decideApproval({ scores, likelyViolationWithoutAgreement, requiresDetailedReview });

  return {
    rating: decision.rating,
    decision: decision.decision,
    score: scores.score,
    summary: decision.summary,
    concerning,
    likelyViolationWithoutAgreement,
    requiresDetailedReview
  };
}

function decideApproval({ scores, likelyViolationWithoutAgreement, requiresDetailedReview }) {
  if (likelyViolationWithoutAgreement.length) {
    return {
      rating: "Not approved baseline",
      decision: "Deny until agreement fixes concerns",
      summary:
        "The scan found advertising, policy, or missing-documentation signals that should block classroom use unless a district-approved agreement resolves them."
    };
  }

  if (scores.score < 60) {
    return {
      rating: "High risk",
      decision: "Do not approve",
      summary: "The site has multiple technical or documentation issues that make it unsuitable for student use at this stage."
    };
  }

  if (requiresDetailedReview.length || scores.score < 82) {
    return {
      rating: "Review required",
      decision: "Hold for detailed review",
      summary:
        "The scan did not prove a denial-level advertising issue, but it found data collection, processor, policy, or contract questions that require review before approval."
    };
  }

  return {
    rating: "Low risk baseline",
    decision: "Approval likely",
    summary:
      "The public scan did not detect advertising trackers, sensitive public forms, or missing core documentation signals. Final approval still depends on district agreement requirements."
  };
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

function buildFerpaConsiderations({ thirdParties, forms, policySignals }) {
  return [
    {
      label: "Education records and student PII",
      status: forms.some((form) => form.sensitiveFieldCount > 0) ? "Possible student PII collection" : "No public form PII signal",
      detail:
        "If the site receives student names, emails, grades, assignments, login identifiers, or other education-record information, FERPA restrictions may apply."
    },
    {
      label: "School official exception",
      status: thirdParties.processors.length ? "Agreement needed" : "No processor signal",
      detail:
        "For outsourced services, FERPA generally requires the provider to perform an institutional service, be under school or district direct control for the data, and use PII only for the disclosed educational purpose."
    },
    {
      label: "Redisclosure and secondary use",
      status: policySignals.some((signal) => ["targetedAdvertising", "sellShare"].includes(signal.key)) ? "High concern" : "No public ad-sale policy signal",
      detail:
        "Student PII should not be reused, redisclosed, sold, or used for targeted advertising unless a valid exception and agreement clearly allows the use."
    }
  ];
}

async function createTeacherNotification(report) {
  const endpoint = process.env.AIPC_ENDPOINT || process.env.OLLAMA_BASE_URL;
  if (!endpoint) {
    return {
      status: "Not configured",
      summary: "Set AIPC_ENDPOINT or OLLAMA_BASE_URL on the server to generate teacher notification emails.",
      email: buildFallbackTeacherEmail(report)
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
        summary: `Teacher notification generation returned HTTP ${response.status}.`,
        email: buildFallbackTeacherEmail(report),
        raw: result
      };
    }

    return {
      status: "Completed",
      summary: "Teacher notification email generated.",
      email: extractGeneratedEmail(result),
      raw: result
    };
  } catch (error) {
    return {
      status: "Error",
      summary:
        error.name === "AbortError"
          ? "Teacher notification generation timed out."
          : error.message || "Teacher notification generation failed.",
      email: buildFallbackTeacherEmail(report)
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
    loginSignals: report.loginSignals,
    policySignals: report.policySignals,
    securityHeaders: report.securityHeaders,
    evaluationChecks: report.evaluationChecks,
    highLevelSummary: report.highLevelSummary,
    ferpaConsiderations: report.ferpaConsiderations,
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
    "Write a copy-paste email to a teacher explaining whether this website is approved, denied, or held for review for Utah K-12 classroom use.",
    "Use the high-level summary decision as the ruling. Include FERPA considerations where relevant.",
    "Be direct. Make reasonable conclusions from advertising trackers, advertising cookies, policy language, missing privacy terms, forms, and third-party processors.",
    "Do not call it an AIPC result. Do not overuse 'check into this'. Use plain language suitable for a teacher notification.",
    "Format with Subject, decision, short reason, and next steps.",
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
              "You are a K-12 student-data privacy reviewer writing a teacher notification email. Be practical, cautious, and concise. Do not claim to provide legal advice, but do make a clear approval, denial, or review-needed recommendation."
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
      task: "utah_k12_teacher_privacy_notification",
      instructions:
        "Write a copy-paste teacher notification email for Utah K-12 privacy review. Include FERPA considerations, decision, score, reasons, and next steps.",
      scannedData: buildAipcPayload(report)
    }
  };
}

function extractGeneratedEmail(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  return result.message?.content || result.email || result.summary || JSON.stringify(result, null, 2);
}

function buildFallbackTeacherEmail(report) {
  const summary = report.highLevelSummary;
  const concerns = [
    ...summary.likelyViolationWithoutAgreement,
    ...summary.requiresDetailedReview,
    ...summary.concerning
  ].slice(0, 4);

  return [
    `Subject: Website Privacy Review - ${report.pageTitle}`,
    "",
    `Decision: ${summary.decision}`,
    `Baseline rating: ${summary.rating} (${summary.score}/100)`,
    "",
    `I reviewed ${report.finalUrl} for Utah K-12 privacy concerns. ${summary.summary}`,
    "",
    concerns.length ? "Key reasons:" : "Key reasons: No denial-level public-page signals were detected.",
    ...concerns.map((concern) => `- ${concern}`),
    "",
    "FERPA note: if the site receives student education-record information or student PII, vendor use should be limited to the educational purpose and covered by district-approved agreement terms before classroom use.",
    "",
    "This is a technical screening result, not legal advice. Final approval depends on district policy and any required vendor agreement."
  ].join("\n");
}
