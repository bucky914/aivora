/* ServerTimer – a countdown anchored to the SERVER's clock.
 *
 * The browser never decides when time is up by itself. It is told:
 *   - expiresAtMs : the deadline stored in the database
 *   - serverNowMs : what the server's clock said when it answered
 * and then counts forward using performance.now(), a monotonic clock that
 * ignores anything the participant does to their system date/time.
 *
 * Refreshing the page just fetches these two numbers again, so the timer
 * continues from the same deadline instead of restarting.
 *
 * When the display reaches 0 it only ASKS the server (onZero). The server's
 * answer decides whether the attempt is really over.
 */
(function (global) {
  'use strict';

  function ServerTimer(options) {
    options = options || {};
    this.onTick = options.onTick || function () {};
    this.onZero = options.onZero || function () {};
    this.expiresAt = null;
    this.serverNow = 0;
    this.mark = 0;
    this.handle = null;
    this.lastZero = -Infinity;
  }

  /* perfMark (optional): performance.now() value that best matches the moment
   * the server produced serverNowMs, e.g. the midpoint of the request. */
  ServerTimer.prototype.sync = function (expiresAtMs, serverNowMs, perfMark) {
    this.expiresAt = expiresAtMs;
    this.serverNow = serverNowMs;
    this.mark = typeof perfMark === 'number' ? perfMark : performance.now();
  };

  ServerTimer.prototype.remainingMs = function () {
    if (this.expiresAt == null) return 0;
    var serverTime = this.serverNow + (performance.now() - this.mark);
    return Math.max(0, this.expiresAt - serverTime);
  };

  ServerTimer.prototype.tick = function () {
    var ms = this.remainingMs();
    this.onTick(ms);
    if (ms <= 0) {
      var now = performance.now();
      // Ask the server at most every 2 seconds while we wait for its answer.
      if (now - this.lastZero >= 2000) {
        this.lastZero = now;
        this.onZero();
      }
    }
  };

  ServerTimer.prototype.start = function () {
    var self = this;
    this.stop();
    this.tick();
    this.handle = setInterval(function () { self.tick(); }, 250);
  };

  ServerTimer.prototype.stop = function () {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  };

  /* 2700000 ms -> "45:00". Rounds up so the display never shows 00:00 early. */
  ServerTimer.format = function (ms) {
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };

  global.ServerTimer = ServerTimer;
})(window);
