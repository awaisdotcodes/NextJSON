# Privacy Policy for NextJSON

**Last updated: June 15, 2026**

NextJSON ("the extension") is a Chrome extension for formatting, viewing, and
exploring JSON. This policy explains exactly what data the extension touches and
what it does not. The short version: **NextJSON runs entirely on your device and
sends none of your data to us or to any third party.**

## Summary

- **No data is collected.** We have no servers, no analytics, and no telemetry.
- **No data is transmitted to the developer or any third party.**
- **Everything happens locally** in your browser.
- The only network requests NextJSON makes are the ones **you explicitly trigger**
  by entering a URL into the "Fetch URL" feature.

## What the Extension Does With Your Data

### JSON content you view or paste

When you open a JSON page, paste JSON into the popup, or fetch JSON from a URL,
that content is processed locally to render the tree, graph, table, diff, and
other views. JSON content is stored temporarily in your browser's local storage
(`chrome.storage.local`) so the viewer can load it. This data:

- never leaves your device,
- is not sent to the developer or any external service,
- remains under your control and can be cleared at any time (see
  "Clearing Your Data" below).

### Local preferences

The extension stores your settings — such as theme (light/dark), key-sorting and
line-wrap toggles, and your list of recently fetched URLs — in
`chrome.storage.local`. These are saved only on your device to preserve your
preferences between sessions. They are never transmitted anywhere.

### The "Fetch URL" feature

NextJSON includes a feature that lets you fetch JSON from a URL you type in. When
you use it:

- the request goes **directly from your browser to the URL you entered**, using
  the method and headers you specify;
- the request is made for the sole purpose of retrieving the JSON you asked for;
- no copy of the request, the response, or the URL is sent to the developer.

If you do not use the Fetch URL feature, the extension makes no network requests
at all.

## Permissions and Why They Are Needed

| Permission | Why it is used |
|------------|----------------|
| `storage` | To save your JSON content for the viewer and to remember your local preferences. Stored only on your device. |
| `<all_urls>` (host access) | (1) To detect when a page you visit is a JSON document so the viewer can render it, and (2) to perform the Fetch URL request you explicitly initiate. |

NextJSON requests no other permissions. It does not access your browsing history,
cookies, passwords, or activity on pages other than detecting whether a page is
JSON.

## What We Do NOT Do

- We do **not** collect, store, or transmit any personal information.
- We do **not** use analytics, tracking pixels, fingerprinting, or telemetry.
- We do **not** sell or share any data — because we never receive any.
- We do **not** include third-party advertising or tracking code.
- We do **not** transmit the content of the JSON you view, paste, or fetch to any
  server controlled by the developer.

## Data Retention and Clearing Your Data

All data is stored locally via `chrome.storage.local`. You can clear it at any time:

- Remove the extension from `chrome://extensions/`, which clears its local storage, or
- Clear the extension's storage through your browser's site/extension data controls.

## Children's Privacy

NextJSON is a developer utility and is not directed at children. Because it
collects no data, it does not knowingly collect any information from children.

## Changes to This Policy

If this policy changes, the updated version will be published in the extension's
repository and the "Last updated" date above will be revised. Material changes
will be reflected before they take effect.

## Contact

If you have questions about this privacy policy, contact:

- **Email:** auth.awais@gmail.com
- **Repository:** https://github.com/awaisdotcodes/NextJSON
