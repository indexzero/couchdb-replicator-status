/*
 * index.js: A module for returning various status information about CouchDB replication jobs
 *
 * (C) 2013, Nodejitsu Inc.
 *
 */

//
// Export various submodules
//
exports.diff   = require('./diff');
exports.status = require('./status');
exports.watch  = require('./watch');