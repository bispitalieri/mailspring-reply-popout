/**
 * Reply Pop-out Interceptor for Mailspring
 *
 * Intercepts Mailspring's standard inline reply actions (Reply, Reply All, Forward)
 * and routes them through Mailspring's native pop-out composer mechanism by
 * setting the `popout: true` flag on the action payload.
 *
 * This is the same mechanism Mailspring's own thread-list context menu uses
 * (see thread-list-context-menu.js replyItem/replyAllItem/forwardItem). It is
 * the only supported, non-invasive way to force a detached composer window:
 * DraftStore._onComposeReply forwards the flag to _finalizeAndPersistNewMessage,
 * which calls _onPopoutDraft -> AppEnv.newWindow({ windowType: 'composer' }).
 * Because the draft is flagged as popped-out before React flushes a repaint,
 * the inline composer never mounts.
 */

class ReplyPopoutInterceptor {
  constructor({ Actions, DraftStore }) {
    if (!Actions) {
      throw new Error('ReplyPopoutInterceptor requires Mailspring Actions object.');
    }
    this.Actions = Actions;
    this.DraftStore = DraftStore;
    this.originalActions = {};
    this.isActive = false;
  }

  /**
   * Activates interception by wrapping composeReply, composeReplyAll, and
   * composeForward so that `popout: true` is always present in the payload.
   */
  activate() {
    if (this.isActive) return;

    this.originalActions = {
      composeReply: this.Actions.composeReply,
      composeReplyAll: this.Actions.composeReplyAll,
      composeForward: this.Actions.composeForward,
    };

    const self = this;

    if (typeof this.Actions.composeReply === 'function') {
      const original = this.originalActions.composeReply;
      this.Actions.composeReply = function (payload) {
        return self._routeToPopout(original, payload);
      };
      Object.assign(this.Actions.composeReply, original);
    }

    if (typeof this.Actions.composeReplyAll === 'function') {
      const original = this.originalActions.composeReplyAll;
      this.Actions.composeReplyAll = function (payload) {
        return self._routeToPopout(original, payload);
      };
      Object.assign(this.Actions.composeReplyAll, original);
    }

    if (typeof this.Actions.composeForward === 'function') {
      const original = this.originalActions.composeForward;
      this.Actions.composeForward = function (payload) {
        return self._routeToPopout(original, payload);
      };
      Object.assign(this.Actions.composeForward, original);
    }

    this.isActive = true;
  }

  /**
   * Forwards the original action with `popout: true` so Mailspring opens a
   * detached native Electron composer window instead of the inline composer.
   *
   * @param {Function} originalAction - The original Mailspring Reflux action.
   * @param {Object} payload - { thread, threadId, message, messageId, type, behavior, ... }
   */
  _routeToPopout(originalAction, payload = {}) {
    // Preserve all original fields (thread, message, type, behavior, etc.) and
    // force the native pop-out flag. Any caller-supplied popout value is
    // honored so the wrapper stays transparent when already popping out.
    const popout = payload.popout !== undefined ? payload.popout : true;
    const nextPayload = Object.assign({}, payload, { popout });
    return originalAction.call(this.Actions, nextPayload);
  }

  /**
   * Deactivates interception and restores all original Mailspring functions.
   */
  deactivate() {
    if (!this.isActive) return;

    if (this.originalActions.composeReply) {
      this.Actions.composeReply = this.originalActions.composeReply;
    }
    if (this.originalActions.composeReplyAll) {
      this.Actions.composeReplyAll = this.originalActions.composeReplyAll;
    }
    if (this.originalActions.composeForward) {
      this.Actions.composeForward = this.originalActions.composeForward;
    }

    this.originalActions = {};
    this.isActive = false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ReplyPopoutInterceptor };
}