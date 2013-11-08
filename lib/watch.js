/*
 * watch.js: Performs replication status checks on a specified interval, saving the last N.
 *
 * (C) 2013, Nodejitsu Inc.
 *
 */

var events = require('events'),
    util = require('util'),
    errs = require('errs'),
    status = require('./status');

//
// ### function watch (options, callback)
// Returns a new replication status Watcher for
// the specified options that will invoke the callback
// (if supplied).
//
module.exports = function (options, callback) {
  return (new Watcher(options, callback)).start();
};

//
// ### function Watcher (options, fn)
// Constructor function for the replication status Watcher
// which will call `replicator.status(options, callback)`
// on the specified `options.interval`.
//
var Watcher = module.exports.Watcher = function (options, fn) {
  if (!options || !fn) {
    throw new Error('Both options and a handler fn are required.');
  }

  events.EventEmitter.call(this);

  this.interval = options.interval || 60 * 1000;
  delete options.interval;

  this.options  = options;
  this.handler  = fn;
};

//
// Inherit from events.EventEmitter
//
util.inherits(Watcher, events.EventEmitter);

//
// ### function start (fn)
// Performs the status check immediately then
// starts watching the replicator status
// invoking `fn` on the specified interval.
//
Watcher.prototype.start = function (fn) {
  var self = this;
  
  if (!this.started) {
    this.started = true;
    this.handler = fn || this.handler;
    if (!this.handler) {
      process.nextTick(function () {
        self.emit('error', new Error('No handler to start with'));
      });
    }

    process.nextTick(function () {
      self.once('status', function () {
        self.intervalId = setInterval(self.check.bind(self), self.interval);
      });

      self.check();
    });
  }

  return this;
};

//
// ### function stop ()
// Stops watching the replicator status.
//
Watcher.prototype.stop = function () {
  if (this.started) {
    this.started = false;
    clearInterval(this.intervalId);
  }

  return this;
};

//
// ### function check ()
// Performs the actual check of replicator status
//
Watcher.prototype.check = function () {
  var self = this;

  this.emit('check', this.options, this);
  status(self.options, function (err, status) {
    if (err) { return errs.handle(err, self.handler, self); }
    self.emit('status', status, self);
    self.handler(null, status, self);
  });
};