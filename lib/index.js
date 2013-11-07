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
  function askCouch(to, qs, next) {
    if (!next && typeof qs === 'function') {
      next = qs;
      qs = null;
    }

    return request({
      uri:       to,
      qs:        qs,
      strictSSL: false,
      json:      true
    }, function (err, res, body) {
      return !err
        ? next(null, body)
        : next(err);
    });
  }

  //
  // Helper function which either queries the
  // remote database or attempts to make the check
  // "locally" against `options.url`.
  //
  function getDbInfo(name) {
    var parsed = url.parse(name),
        dbUri  = !parsed.protocol
          ? uri + '/' + name
          : name;

    askCouch(dbUri, function (err, db) {
      if (err) { return next(err) }
      
      var info = {
        name: parsed.path,
        doc_count: db.doc_count,
        disk_size: db.disk_size,
        update_seq: db.update_seq
      };

      if (parsed.protocol) {
        info.uri = name;
        info.name = info.slice(1);
      }

      next(null, info);
    });
  }

  //
  // Helper function to build the replicator
  // status entry for the given task and replicator
  // doc.
  //
  function buildStatus(task, doc, next) {
    async.parallel({
      source: async.apply(getDbInfo, doc.source),
      target: async.apply(getDbInfo, doc.target)
    }, function (err, dbs) {
      if (err) { return next(err) }
      next(null, {
        id: task.id,
        continuous: task.continuous,
        started_on: task.started_on,
        updated_on: task.updated_on,

        state:      doc._replication_state,
        state_time: doc._replication_state_time,

        checkpoint_source_seq: task.checkpoint_source_seq,

        source: dbs.source,
        target: dbs.target
      });
    });
  }

  async.parallel({
    //
    // * Get everything at `/_replicator/_all_docs?include_docs=true`
    //
    docs: async.apply(
      askCouch,
      uri + '/_replicator/_all_docs', 
      { include_docs: true }
    ),
    //
    // * Get everything at `/_active_tasks`
    //
    tasks: async.apply(
      askCouch,
      uri + '/_active_tasks'
    )
  }, function (err, results) {
    if (err) {
      return callback(err);
    }

    if (results.docs) {
      results.docs = results.docs.rows
        .map(function (row) {
          return row.doc;
        })
        .filter(function (doc) {
          return !/^_design/.test(doc._id);
        })
        .reduce(function (all, doc) {
          all[doc._id] = doc;
          return all;
        }, {});
    }

    result.tasks = result.tasks
      .filter(function (task) {
        return task.type === 'replication';
      })
      .reduce(function (all, task) {
        all[task.doc_id] = task;
        return all;
      });

    var keys = Object.keys(result.tasks)
    if (options.filter) {
      keys = keys.filter(function (key) {
        return ~options.filter.indexOf(key);
      });
    }

    async.forEachLimit(keys, 5, function (all, key, next) {
      buildStatus(result.tasks[key], result.docs[key], function (err, stat) {
        if (err) { return next(err) }
        all[key] = stat;
        next(null, all);
      });
    }, callback);
  });
};
