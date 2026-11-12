# Mailspring Reply Pop-out

> A lightweight, non-invasive Mailspring plugin that transforms the standard inline **Reply**, **Reply All**, and **Forward** buttons into native, independent Electron pop-out composer windows.

---

## 1. What It Does

By default, clicking **Reply** below an email in Mailspring mounts an inline composer directly inside the conversation thread.

**Reply Pop-out** intercepts the inline reply workflow at the Flux Action layer and diverts it to Mailspring's native detached composer window mechanism.

### Key Behaviors
- **Independent Window**: Clicking **Reply**, **Reply All**, or **Forward** opens Mailspring's native detached Electron `BrowserWindow`.
- **No Inline Composer**: The inline editor is never shown under the email — only the pop-out window opens.
- **Full Context Preservation**: To/CC/BCC recipients, subject line (`Re: ...`), In-Reply-To/References headers, signatures, and quoted email content are preserved natively.
- **Draft Reuse**: If an unsaved draft already exists for the thread, it is reused and brought to the front rather than creating a duplicate.
- **Zero Forking / No Core File Modifications**: Operates 100% within Mailspring's standard plugin architecture.

---

## 2. How It Works

The plugin wraps Mailspring's shared `Actions` singleton (exposed via `require('mailspring-exports')`) and forwards every `composeReply`, `composeReplyAll`, and `composeForward` invocation with the `popout: true` flag.

This is the same mechanism Mailspring's own thread-list context menu uses (`internal_packages/thread-list/lib/thread-list-context-menu.js`). `DraftStore._onComposeReply` forwards the flag to `_finalizeAndPersistNewMessage(draft, { popout })`, which calls `_onPopoutDraft(draft.headerMessageId)` → `AppEnv.newWindow({ windowType: 'composer' })`.

### Why CSS Is Needed

With `popout: true` the draft is persisted to SQLite *and* the pop-out opens. Because the draft now exists in the thread, Mailspring's `MessageItemContainer` renders the inline composer too. Mailspring has no `poppedOut` flag on the draft model to suppress this programmatically, so the plugin hides the inline composer with a scoped CSS rule:

```css
.message-item-wrap.draft {
  display: none !important;
}
```

The selector is precise — `.message-item-wrap.draft` is the exact class `MessageItemContainer._classNames()` adds for draft messages, so non-draft messages are unaffected. The detached pop-out window is never affected because this package only loads in the main mail window (`windowTypes: { default: true }`), and the pop-out's root element is `composer-full-window`.

---

## 3. Project Structure

```text
mailspring-reply-popout/
├── package.json               # Mailspring plugin manifest (windowTypes: default)
├── LICENSE                    # MIT License
├── README.md                  # Documentation and architecture guide
└── lib/
    ├── main.js                # Mailspring lifecycle entry point (activate/deactivate)
    └── reply-interceptor.js   # Flux action wrapper and pop-out router logic
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
| **1. Standard Reply** | Click **Reply** button below an email | A new detached native Electron composer window opens immediately. The inline editor is never shown under the email. | Verified |
| **2. Reply All** | Click **Reply All** | Detached window opens with all original recipients populated in To/CC fields. | Verified |
| **3. Forward** | Click **Forward** | Detached window opens with quoted content and original attachments intact; To field is blank. | Verified |
| **4. Existing Draft Reuse** | Draft a reply in popout, leave it open, click Reply again | The existing popout window is focused; no duplicate draft is created in the Drafts folder. | Verified |
| **5. Send & Sync** | Click Send in the popout window | Message is sent through the native sync engine, draft is cleaned up, and window closes. | Verified |
| **6. Clean Deactivation** | Disable plugin in Preferences > Packages | Clicking Reply reverts to Mailspring's standard inline reply behavior without errors. | Verified |

---

## 6. License

MIT © Mailspring Community Contributor