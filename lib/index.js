/*
 * index.js: A module for returning various status information about CouchDB replication jobs
 *
 * (C) 2013, Charlie Robbins
 *
 */

var url = require('url'),
    async = require('async'),
    request = require('request');

//
// ### function replicationStats(options, callback)
// Returns all of the replication status about `options.uri || options.url`
// filtering to anything matching `options.filter`
//
module.exports = function (options, callback) {
  var uri = options.url || options.uri;
  if (!uri) {
    return callback(new Error('options.uri or options.url is required'));
  }

  //
  // Helper function for making the request with
  // the default parameters
  //
  function askCouch(path, qs, next) {
    if (!next && typeof qs === 'function') {
      next = qs;
      qs = null;
    }

    return request({
      uri:       uri + path,
      qs:        qs,
      strictSSL: false,
      json:      true
    }, function (err, res, body) {
      return !err
        ? next(null, body)
        : next(err);
    });
  }

  async.parallel({
    //
    // * Get everything at `/_replicator/_all_docs?include_docs=true`
    //
    docs: async.apply(
      askCouch,
      '/_replicator/_all_docs', 
      { include_docs: true }
    ),
    //
    // * Get everything at `/_active_tasks`
    //
    tasks: async.apply(
      askCouch,
      '/_active_tasks'
    )
  }, function (err, results) {
    if (err) {
      return callback(err);
    }

    if (results.docs) {
      results.docs = results.docs.rows.map(function (row) {
        return row.doc;
      });
    }

    callback(null, results);
  })
};
