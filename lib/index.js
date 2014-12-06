/*
 * index.js: A module for returning various status information about CouchDB replication jobs
 *
 * (C) 2013, Charlie Robbins
 *
 */

//
// Export various submodules
//
exports.diff   = require('./diff');
exports.status = require('./status');
exports.watch  = require('./watch');