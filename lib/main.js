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
let styleElement = null;

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

    // Hide the inline composer that Mailspring mounts inside the thread
    // when a draft exists for that thread. With `popout: true` the draft is
    // persisted *and* the popout opens, so MessageItemContainer renders the
    // inline composer too. There is no `poppedOut` flag on the draft model to
    // suppress it programmatically, so we hide it with CSS.
    //
    // The selector is scoped to the inline composer only: `.message-item-wrap
    // .draft` is the class MessageItemContainer adds for draft messages
    // (message-item-container.js). The detached popout window is never
    // affected because this package only loads in the main mail window and
    // the popout root is `composer-full-window`.
    if (typeof document !== 'undefined') {
      styleElement = document.createElement('style');
      styleElement.setAttribute('id', 'mailspring-reply-popout-style');
      styleElement.textContent = `
        /* Hide the inline composer when a pop-out reply draft exists */
        .message-item-wrap.draft {
          display: none !important;
        }
      `;
      document.head.appendChild(styleElement);
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
    if (interceptor) {
      interceptor.deactivate();
      interceptor = null;
    }
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
      styleElement = null;
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