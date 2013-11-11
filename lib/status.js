/*
 * status.js: Collects status information about CouchDB replication jobs.
 *
 * (C) 2013, Nodejitsu Inc.
 *
 */

var url = require('url'),
    async = require('async'),
    request = require('request');

//
// ### function status (options, callback)
// #### @options.uri || url {String}  CouchDB URL to get status from
// #### @options.filter     {Array}   Array of `_replicator` doc IDs to filter against
// #### @options.sanitize   {Boolean} Indiciates we should strip sensitive data.
//
// Returns all of the replication status about `options.uri || options.url`
// filtering to anything matching `options.filter`. If `options.sanitize`
// is set then no sensitive data (i.e. `.url`) is included in the status response.
//
module.exports = function (options, callback) {
  var uri = (options.url || options.uri).replace(/\/$/, '');
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
  function getDbInfo(name, next) {
    var parsed = url.parse(name),
        dbUri  = !parsed.protocol
          ? uri + '/' + name
          : name;

    askCouch(dbUri, function (err, db) {
      if (err) { return next(err) }

      db.name = parsed.path;
      if (parsed.protocol) {
        if (!options.sanitize) {
          db.uri = name;
        }

        db.name = db.name.slice(1);
      }

      next(null, db);
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

      //
      // Normalize time(s) on the source and target db information
      //
      ['source', 'target'].forEach(function (key) {
        if (dbs[key] && dbs[key].instance_start_time) {
          dbs[key].instance_start_time = '' + (dbs[key].instance_start_time / 1000).toFixed(0);
        }
      });

      next(null, {
        id: task.doc_id,
        continuous: task.continuous,
        started_on: '' + (task.started_on * 1000),
        updated_on: '' + (task.updated_on * 1000),

        state:      doc._replication_state,
        state_time: '' + (+new Date(doc._replication_state_time)),

        checkpointed_source_seq: task.checkpointed_source_seq,

        source: dbs.source,
        target: dbs.target,

        remaining: dbs.source.disk_size - dbs.target.disk_size,
        progress: {
          docs:       ((dbs.target.doc_count         / dbs.source.doc_count)  * 100).toFixed(2),
          disk_size:  ((dbs.target.disk_size         / dbs.source.disk_size)  * 100).toFixed(2),
          data_size:  ((dbs.target.data_size         / dbs.source.data_size)  * 100).toFixed(2),
          update_seq: ((task.checkpointed_source_seq / dbs.source.update_seq) * 100).toFixed(2)
        }
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

    //
    // If there are resulting replicator documents
    // then filter and reduce them into an Object.
    //
    if (results.docs && Array.isArray(results.docs.rows)) {
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

    //
    // Filter tasks to only replication tasks
    // and reduce them into an Object.
    //
    results.tasks = results.tasks
      .filter(function (task) {
        return task.type === 'replication';
      })
      .reduce(function (all, task) {
        all[task.doc_id] = task;
        return all;
      }, {});

    var keys = Object.keys(results.tasks),
        all  = {};

    //
    // Filter any known keys.
    //
    if (options.filter) {
      keys = keys.filter(function (key) {
        return ~options.filter.indexOf(key);
      });
    }

    async.forEachLimit(keys, 5, function (key, next) {
      buildStatus(results.tasks[key], results.docs[key], function (err, stat) {
        if (err) { return next(err) }
        all[key] = stat;
        next();
      });
    }, function (err) {
      return err ? callback(err) : callback(null, all);
    });
  });
};