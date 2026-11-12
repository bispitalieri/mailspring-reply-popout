# Mailspring Reply Pop-out

> A lightweight, non-invasive Mailspring plugin that transforms the standard inline **Reply**, **Reply All**, and **Forward** buttons into native, independent Electron pop-out composer windows.

---

## 1. Project Goal & Overview

By default, clicking the **Reply** button below an email in Mailspring mounts an inline composer directly inside the conversation thread. However, Mailspring already contains full native support for opening detached composer windows (via `Actions.composePopoutDraft`).

**Reply Pop-out** intercepts the inline reply workflow at the Flux Action layer and immediately diverts it to Mailspring's existing pop-out composer mechanism.

### Key Behaviors:
- **Independent Window**: Clicking **Reply**, **Reply All**, or **Forward** opens Mailspring's native detached Electron `BrowserWindow`.
- **Zero Inline Composer Flash**: The inline composer never mounts or flickers in the message list.
- **Full Context Preservation**: To/CC/BCC recipients, subject line (`Re: ...`), In-Reply-To/References headers, signatures, and quoted email content are preserved natively.
- **Draft Deduplication**: If an unsaved draft already exists for the thread, it is reused and brought to the front rather than creating a duplicate.
- **Zero Forking / No Core File Modifications**: Operates 100% within Mailspring's standard plugin architecture.

---

## 2. Technical Investigation & Findings

Below are the detailed answers to the technical questions regarding Mailspring's internal architecture:

### 1. How Mailspring registers and executes plugin extensions
Mailspring packages reside in:
- **macOS**: `~/Library/Application Support/Mailspring/packages`
- **Linux**: `~/.config/Mailspring/packages`
- **Windows**: `%APPDATA%\Mailspring\packages`

The `PackageManager` reads each package's `package.json`, checks `windowTypes` (where `"default": true` specifies execution in the main mail window), loads the entry module specified in `main`, and invokes the exported `activate()` function. On package disable or client shutdown, `deactivate()` is called. Plugins access core APIs via `require('mailspring-exports')`.

### 2. Which React component renders the inline Reply button
In Mailspring's internal package `message-list` (`app/internal_packages/message-list/`):
- `MessageItem` renders individual message cards.
- `MessageControls` / `MessageActions` renders the quick action buttons (Reply, Reply All, Forward, More Options `...`) inside the message header.
- At the bottom of an opened thread, the message list renders the quick reply box (`MessageQuickReply`) prompting "Click here to reply...".
- When an active draft session exists, `ComposerView` is rendered inline at the bottom of the message list.

### 3. Which callback or command is executed when that button is clicked
When clicked, the button triggers:
- `Actions.composeReply({ threadId, messageId })`
- `Actions.composeReplyAll({ threadId, messageId })`
- `Actions.composeForward({ threadId, messageId })`

These are Reflux actions exposed on the global `Actions` singleton. Keyboard shortcuts (such as `r` for reply, `a` for reply all, `f` for forward) also dispatch these exact actions.

### 4. How the context-menu Reply action works internally
When triggering Reply via context menu or thread actions:
- Mailspring creates a draft session via `DraftStore` (using `DraftFactory` to format quoted body and recipients).
- Because a context menu outside the thread view has no inline container to host a composer, Mailspring dispatches `Actions.composePopoutDraft(draftClientId)`.

### 5. Which function creates and opens a separate composer window
The high-level action is `Actions.composePopoutDraft(draftClientId)`.
Under the hood:
1. `DraftStore` marks the draft session as popped out.
2. Mailspring issues an IPC call to Electron's main process: `ipcRenderer.send('command', 'application:new-window', { windowType: 'composer', draftClientId })`.
3. Electron's `window-manager.ts` instantiates a new `BrowserWindow` loading `app/static/index.html?windowType=composer&draftClientId=...`.
4. The new window loads Mailspring's native `Composer` component bound to the existing SQLite draft.

### 6. Can the inline Reply action be intercepted through the Plugin API?
**Yes.** In Mailspring, `Actions` is a shared singleton exposed by `mailspring-exports`. Reflux action emitters like `Actions.composeReply` are callable JavaScript functions. By wrapping `Actions.composeReply`, `Actions.composeReplyAll`, and `Actions.composeForward`, the plugin intercepts all invocations regardless of whether they originate from UI buttons, context menus, or keyboard shortcuts.

### 7. Does Mailspring expose suitable extension points or event handlers?
Yes. The combination of:
- `Actions` method wrapping
- Synchronous `DraftStore.listen()` subscription
- `Actions.composePopoutDraft()` invocation
provides a clean, non-destructive extension mechanism that requires no core modifications.

### 8. Can the native composer be opened using an existing Draft?
**Yes.** `Actions.composePopoutDraft(draftClientId)` accepts the `draftClientId` (or `id`) of an existing draft. The draft is already stored in Mailspring's local SQLite database and memory cache; the new window simply queries and mounts the existing draft session.

### 9. Can the inline action be prevented without modifying core source code?
**Yes.** When `originalComposeReply()` is called, `DraftStore` updates synchronously in memory. By listening to `DraftStore` in the same microtask and immediately invoking `Actions.composePopoutDraft(draft.clientId)`, the draft session is flagged as popped out *before* React flushes a repaint to the DOM. As a result, React never renders the inline composer.

---

## 3. Project Structure

```text
mailspring-reply-popout/
├── package.json               # Mailspring plugin manifest (windowTypes: default)
├── LICENSE                    # MIT License
├── README.md                  # Documentation and architecture guide
└── lib/
    ├── main.js                # Mailspring lifecycle entry point (activate/deactivate)
    └── reply-interceptor.js   # Flux action wrapper and draft router logic
```

---

## 4. Local Installation Guide

### Option A: Install via Mailspring UI (Recommended)
1. In Mailspring, open **Developer** from the menu:
   - On macOS: **Mailspring > Developer > Install Package Locally...**
   - On Windows/Linux: **Edit > Developer > Install Package Locally...**
2. Select the `mailspring-reply-popout` directory.
3. Mailspring will copy the folder into its packages directory and activate it immediately.

### Option B: Manual Directory Link

#### On macOS:
```bash
mkdir -p ~/Library/Application\ Support/Mailspring/packages
cp -R path/to/mailspring-reply-popout ~/Library/Application\ Support/Mailspring/packages/
```

#### On Linux:
```bash
mkdir -p ~/.config/Mailspring/packages
cp -R path/to/mailspring-reply-popout ~/.config/Mailspring/packages/
```

#### On Windows (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Mailspring\packages"
Copy-Item -Recurse "path\to\mailspring-reply-popout" "$env:APPDATA\Mailspring\packages\"
```

After copying, reload Mailspring by pressing `Cmd+Alt+R` (macOS) or `Ctrl+Alt+R` (Windows/Linux), or restart the application.

---

## 5. Verification Checklist

| Step | Action | Expected Behavior | Status |
| :--- | :--- | :--- | :--- |
| **1. Standard Reply** | Click **Reply** button below an email | A new detached native Electron composer window opens immediately. The inline composer never appears. | Verified |
| **2. Reply All** | Click **Reply All** | Detached window opens with all original recipients populated in To/CC fields. | Verified |
| **3. Forward** | Click **Forward** | Detached window opens with quoted content and original attachments intact; To field is blank. | Verified |
| **4. Existing Draft Reuse** | Draft a reply in popout, leave it open, click Reply again | The existing popout window is focused; no duplicate draft is created in the Drafts folder. | Verified |
| **5. Send & Sync** | Click Send in the popout window | Message is sent through the native sync engine, draft is cleaned up, and window closes. | Verified |
| **6. Clean Deactivation** | Disable plugin in Preferences > Packages | Clicking Reply reverts to Mailspring's standard inline reply behavior without errors. | Verified |

---

## 6. License

MIT © Mailspring Community Contributor
