// Content script to detect JSON responses and format them

(function() {
  'use strict';

  // Check if we've already processed this page
  if (window.__jsonFormatterProcessed) {
    return;
  }
  window.__jsonFormatterProcessed = true;

  // Check if this is likely a JSON page based on URL
  function isJsonUrl() {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    
    // Check URL extension
    if (pathname.endsWith('.json')) {
      return true;
    }
    
    // Check for .json with query params or hash
    if (pathname.includes('.json?') || pathname.includes('.json#')) {
      return true;
    }
    
    // Check for common API patterns
    if (url.includes('/api/') || url.includes('/json/')) {
      return true;
    }

    return false;
  }

  // Check if the body contains raw JSON
  function containsRawJson() {
    const body = document.body;
    if (!body) return false;

    // Get all child elements
    const children = body.children;
    
    // Raw JSON pages typically have:
    // 1. No children (just text)
    // 2. Only a <pre> tag
    // 3. A <pre> wrapped in other minimal elements
    
    let textContent = null;
    
    if (children.length === 0) {
      textContent = body.textContent;
    } else if (children.length === 1) {
      const child = children[0];
      if (child.tagName === 'PRE') {
        textContent = child.textContent;
      } else if (child.tagName === 'DIV' || child.tagName === 'BODY') {
        // Some browsers wrap in a div
        const grandChildren = child.children;
        if (grandChildren.length === 0) {
          textContent = child.textContent;
        } else if (grandChildren.length === 1 && grandChildren[0].tagName === 'PRE') {
          textContent = grandChildren[0].textContent;
        }
      }
    } else if (children.length === 2) {
      // Chrome sometimes adds a style element
      let preElement = null;
      for (const child of children) {
        if (child.tagName === 'PRE') {
          preElement = child;
          break;
        }
      }
      if (preElement) {
        textContent = preElement.textContent;
      }
    }

    if (textContent) {
      return tryParseJson(textContent);
    }

    return false;
  }

  // Try to parse content as JSON
  function tryParseJson(content) {
    if (!content) return false;
    
    const trimmed = content.trim();
    if (!trimmed) return false;

    // Quick check for JSON-like content
    const firstChar = trimmed[0];
    const lastChar = trimmed[trimmed.length - 1];
    
    // Check for object or array
    if (!((firstChar === '{' && lastChar === '}') || 
          (firstChar === '[' && lastChar === ']'))) {
      return false;
    }

    try {
      JSON.parse(trimmed);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Get the raw JSON content from the page
  function getJsonContent() {
    const body = document.body;
    if (!body) return null;

    const children = body.children;
    
    // Try to extract text content from various structures
    if (children.length === 0) {
      return body.textContent.trim();
    }
    
    if (children.length === 1) {
      const child = children[0];
      if (child.tagName === 'PRE') {
        return child.textContent.trim();
      } else if (child.tagName === 'DIV' || child.tagName === 'BODY') {
        const grandChildren = child.children;
        if (grandChildren.length === 0) {
          return child.textContent.trim();
        } else if (grandChildren.length === 1 && grandChildren[0].tagName === 'PRE') {
          return grandChildren[0].textContent.trim();
        }
      }
    }
    
    if (children.length === 2) {
      for (const child of children) {
        if (child.tagName === 'PRE') {
          return child.textContent.trim();
        }
      }
    }

    // Last resort: try the full body text
    const bodyText = body.textContent.trim();
    if (tryParseJson(bodyText)) {
      return bodyText;
    }

    return null;
  }

  // Replace the page content with the formatted JSON viewer.
  // Instead of redirecting (which would replace the URL bar with
  // chrome-extension://...), we inject the viewer as a full-viewport
  // iframe over the page so the address bar keeps showing the original
  // *.json URL.
  function formatPage() {
    if (window.__jsonFormatterRedirected) return;
    window.__jsonFormatterRedirected = true;

    const jsonContent = getJsonContent();
    if (!jsonContent) return;

    try {
      JSON.parse(jsonContent);

      chrome.storage.local.set({
        jsonToFormat: jsonContent,
        jsonSourceUrl: window.location.href
      }, () => {
        injectViewerIframe();
      });
    } catch (e) {
      console.error('NextJSON: Failed to parse JSON', e);
    }
  }

  function injectViewerIframe() {
    if (document.getElementById('__next-json-viewer')) return;

    // Reset host-page chrome and hide the raw <pre>/<body> content so
    // only the iframe shows. !important to beat any stylesheet the page
    // may inject before our content script runs.
    const reset = document.createElement('style');
    reset.id = '__next-json-reset';
    reset.textContent =
      'html,body{margin:0!important;padding:0!important;height:100%!important;width:100%!important;overflow:hidden!important;background:#fafaf9!important}' +
      'body>*:not(#__next-json-viewer){display:none!important}';
    (document.head || document.documentElement).appendChild(reset);

    const iframe = document.createElement('iframe');
    iframe.id = '__next-json-viewer';
    iframe.src = chrome.runtime.getURL('html/viewer.html');
    iframe.allow = 'clipboard-read; clipboard-write';
    iframe.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100vw',
      'height:100vh',
      'border:0',
      'margin:0',
      'padding:0',
      'z-index:2147483647',
      'background:#fafaf9',
      'color-scheme:normal',
    ].join(';');

    if (document.body) {
      document.body.appendChild(iframe);
    } else {
      // Body not ready yet — wait then inject.
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(iframe), { once: true });
    }
  }

  // Main detection logic
  function detectAndFormat() {
    if (window.__jsonFormatterRedirected) return;
    
    // Check if it looks like a JSON page or contains raw JSON
    if (isJsonUrl() || containsRawJson()) {
      // Double-check that we can actually get valid JSON content
      const content = getJsonContent();
      if (content && tryParseJson(content)) {
        formatPage();
      }
    }
  }

  // Run detection with multiple attempts
  function runDetection() {
    // First attempt immediately
    detectAndFormat();
    
    // Retry after a short delay for slow-loading pages
    setTimeout(() => {
      if (!window.__jsonFormatterRedirected) {
        detectAndFormat();
      }
    }, 100);
    
    // Final attempt for very slow pages
    setTimeout(() => {
      if (!window.__jsonFormatterRedirected) {
        detectAndFormat();
      }
    }, 500);
  }

  // Run detection when page is ready
  if (document.readyState === 'complete') {
    runDetection();
  } else if (document.readyState === 'interactive') {
    runDetection();
  } else {
    document.addEventListener('DOMContentLoaded', runDetection);
    window.addEventListener('load', runDetection);
  }
})();
