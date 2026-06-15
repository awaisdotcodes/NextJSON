// NextJSON - Background Service Worker
// Handles URL fetching to bypass CORS

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_URL') {
    fetchURL(request.url, request.method, request.headers)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function fetchURL(url, method, customHeaders) {
  const headers = Object.assign(
    { 'Accept': 'application/json, text/plain, */*' },
    customHeaders && typeof customHeaders === 'object' ? customHeaders : {}
  );

  // 30s timeout via AbortController so a hanging endpoint doesn't block the popup.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(url, {
      method: (method || 'GET').toUpperCase(),
      headers,
      signal: controller.signal,
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
