/**
 * Mailspring Reply Pop-out Plugin
 *
 * Entry point: exports activate() and deactivate()
 *
 * Intercepts default inline reply buttons and keyboard shortcuts,
 * routing them into independent native Electron composer windows.
 */

const { ReplyPopoutInterceptor } = require('./reply-interceptor');
const path = require('path');

let interceptor = null;
let visibilityPoller = null;
let wasComposerWindowOpen = false;

/**
 * Resolves Mailspring's bundled `@electron/remote`. Plugins run outside
 * `app.asar`, so the bare module name is not on the normal module resolution
 * path; fall back to the explicit path inside `app.asar` where Mailspring
 * bundles it, then reach `application.windowManager` through it.
 */
function _resolveElectronRemote() {
  const candidates = [
    '@electron/remote',
    path.join(process.resourcesPath, 'app.asar', 'node_modules', '@electron', 'remote'),
  ];
  let lastErr = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.log('[ReplyPopout] @electron/remote unavailable:', lastErr && lastErr.message);
  }
  return null;
}

/**
 * Returns true while at least one detached composer (pop-out) window is open.
 * Uses Mailspring's global `application.windowManager` (exposed via
 * `@electron/remote`'s getGlobal) rather than `BrowserWindow.getAllWindows()`,
 * which is not exposed by @electron/remote in this runtime. Inspects each
 * window's `windowType` for 'composer'.
 */
function _hasOpenComposerWindow() {
  try {
    const remote = _resolveElectronRemote();
    if (!remote) {
      return false;
    }
    const application = remote.getGlobal('application');
    const all = application.windowManager.getOpenWindows();
    return all.some((win) => {
      const type = win.windowType || (win.loadSettings && win.loadSettings().windowType);
      return type === 'composer';
    });
  } catch (err) {
    console.log('[ReplyPopout] _hasOpenComposerWindow error:', err && err.message);
    return false;
  }
}

/**
 * Hides the inline composer element(s) by setting an inline `display: none`
 * directly on the `.message-item-wrap.draft` DOM node(s). This is applied
 * only while a pop-out composer window is open; when the pop-out closes the
 * inline style is removed so the editor reappears (with the draft's text
 * intact, since DraftStore._onBeforeUnload commits the dirty draft to the DB
 * instead of destroying it).
 *
 * This is idempotent: on every tick it sets the correct style on every
 * matching element. This matters because the inline composer element mounts
 * asynchronously (after the draft is persisted) — sometimes after the pop-out
 * window is already open — so a transition-only check would miss it.
 */
function _applyInlineComposerVisibility() {
  const composerWindowOpen = _hasOpenComposerWindow();
  wasComposerWindowOpen = composerWindowOpen;

  const elements = document.querySelectorAll('.draft.message-item-wrap');
  elements.forEach((el) => {
    el.style.display = composerWindowOpen ? 'none' : '';
  });
}

/**
 * Called by Mailspring when the package is loaded or enabled.
 */
function activate() {
  try {
    // mailspring-exports is available in the Mailspring runtime environment
    const mailspring = require('mailspring-exports');
    const { Actions } = mailspring;

    if (!Actions) {
      console.error('[ReplyPopout] Actions not available in mailspring-exports.');
      return;
    }

    // Instantiate and activate the action interceptor. It wraps
    // composeReply / composeReplyAll / composeForward and forwards the
    // `popout: true` flag, which is Mailspring's native mechanism for
    // opening a detached composer window.
    interceptor = new ReplyPopoutInterceptor({ Actions });
    interceptor.activate();

    // Hide the inline composer element(s) while a pop-out is open, and
    // restore them when the pop-out closes. The poller tracks open/closed
    // transitions of the composer window (see _applyInlineComposerVisibility).
    if (typeof document !== 'undefined') {
      wasComposerWindowOpen = _hasOpenComposerWindow();
      _applyInlineComposerVisibility();
      visibilityPoller = setInterval(_applyInlineComposerVisibility, 150);
    }

    console.log('[ReplyPopout] Successfully activated. Standard replies will now open in native pop-out windows.');
  } catch (err) {
    console.error('[ReplyPopout] Failed to activate:', err);
  }
}

/**
 * Called by Mailspring when the package is unloaded or disabled.
 */
function deactivate() {
  try {
    if (visibilityPoller) {
      clearInterval(visibilityPoller);
      visibilityPoller = null;
    }
    // Restore any inline composer elements that were hidden.
    if (typeof document !== 'undefined') {
      const elements = document.querySelectorAll('.message-item-wrap.draft');
      elements.forEach((el) => {
        el.style.display = '';
      });
      wasComposerWindowOpen = false;
    }
    if (interceptor) {
      interceptor.deactivate();
      interceptor = null;
    }

    console.log('[ReplyPopout] Deactivated. Standard inline reply behavior restored.');
  } catch (err) {
    console.error('[ReplyPopout] Error during deactivation:', err);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    activate,
    deactivate,
    ReplyPopoutInterceptor,
  };
}