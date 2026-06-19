// NextJSON - Background Service Worker
// Handles URL fetching to bypass CORS

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Only accept messages originating from this extension's own pages
  // (popup / viewer). With no `externally_connectable` declared, web pages
  // and other extensions cannot reach us — this asserts that invariant so a
  // future manifest change can't silently open the privileged fetch handler.
  if (!sender || sender.id !== chrome.runtime.id) return;

  if (request.type === 'FETCH_URL') {
    fetchURL(request.url, request.method, request.headers)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Block requests to loopback, link-local, and private (RFC 1918) ranges so
// the privileged fetch can't be abused as an SSRF gadget to reach internal
// services or cloud metadata endpoints (e.g. 169.254.169.254).
function isBlockedHost(hostname) {
  const h = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '::' || h === '::1') return true;
  // IPv4 literal checks
  if (/^127\./.test(h)) return true;                              // loopback
  if (/^10\./.test(h)) return true;                               // private
  if (/^192\.168\./.test(h)) return true;                         // private
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;          // private
  if (/^169\.254\./.test(h)) return true;                         // link-local / metadata
  if (/^0\./.test(h)) return true;                                // "this" network
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true;
  return false;
}

// Drop headers that could be abused to spoof identity / smuggle requests
// against internal targets, and reject any header carrying CRLF.
const FORBIDDEN_HEADER = /^(host|cookie|authorization|origin|referer|x-forwarded-[\w-]+|forwarded|proxy-[\w-]+)$/i;
function sanitizeHeaders(customHeaders) {
  const out = { 'Accept': 'application/json, text/plain, */*' };
  if (!customHeaders || typeof customHeaders !== 'object') return out;
  for (const [k, v] of Object.entries(customHeaders)) {
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    if (/[\r\n]/.test(k) || /[\r\n]/.test(v)) continue;   // header injection
    if (FORBIDDEN_HEADER.test(k.trim())) continue;
    out[k] = v;
  }
  return out;
}

async function fetchURL(url, method, customHeaders) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error('Refusing to fetch internal / private address');
  }

  const headers = sanitizeHeaders(customHeaders);

  // 30s timeout via AbortController so a hanging endpoint doesn't block the popup.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(parsed.href, {
      method: (method || 'GET').toUpperCase(),
      headers,
      signal: controller.signal,
      redirect: 'error',          // a public URL must not 30x into an internal host
      credentials: 'omit',        // never attach the user's cookies
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('Request timed out (30s)');
    throw e;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  try {
    JSON.parse(text);
  } catch (e) {
    throw new Error('Response is not valid JSON');
  }

  return text;
}
