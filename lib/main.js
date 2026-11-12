/**
 * Mailspring Reply Pop-out Plugin
 *
 * Entry point: exports activate() and deactivate()
 *
 * Intercepts default inline reply buttons and keyboard shortcuts,
 * routing them into independent native Electron composer windows.
 */

const { ReplyPopoutInterceptor } = require('./reply-interceptor');

let interceptor = null;

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