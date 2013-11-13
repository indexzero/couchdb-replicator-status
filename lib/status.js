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
// #### @options.uri || url {String}  CouchDB URL to get status from.
// #### @options.filter     {Array}   Array of `_replicator` doc IDs to filter against.
// #### @options.sanitize   {Boolean} Indiciates we should strip sensitive data.
// #### @options.maxTries   {Number}  Maximum number of retries.
//
// Returns all of the replication status about `options.uri || options.url`
// filtering to anything matching `options.filter`. If `options.sanitize`
// is set then no sensitive data (i.e. `.url`) is included in the status response.
//
module.exports = function (options, callback) {
  var uri      = (options.url || options.uri).replace(/\/$/, ''),
      maxTries = options.maxTries || 3;

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
      if (!err && !body.error) {
        return next(null, body)
      }

      return !err
        ? next(new Error(err.error + ' ' + err.reason))
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

        if (db.name && db.name.slice) {
          db.name = db.name.slice(1);
        }
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
      else if (!task) {
        //
        // Ensure this is not `null` or `undefined` which could throw,
        // but still "falsey".
        //
        task = false;
      }

      //
      // Normalize time(s) on the source and target db information
      //
      ['source', 'target'].forEach(function (key) {
        if (dbs[key] && dbs[key].instance_start_time) {
          dbs[key].instance_start_time = '' + (dbs[key].instance_start_time / 1000).toFixed(0);
        }
      });

      next(null, {
        id:         task.doc_id     || doc._id,
        continuous: task.continuous || doc.continuous,
        started_on: '' + (task.started_on * 1000),
        updated_on: '' + (task.updated_on * 1000),

        state:      doc._replication_state,
        state_time: '' + (+new Date(doc._replication_state_time)),
        has:        { task: !!task, doc: !!doc },

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

  //
  // Setup `options.attempt` if it does not exist.
  //
  options.attempt = options.attempt || 0;
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
    else if (!Array.isArray(results.tasks)) {
      //
      // _active_tasks SHOULD ALWAYS be an Array, even an empty one
      // when nothing is running.
      //
      if (++(options.attempt) < maxTries) {
        return setTimeout(module.exports.bind(null, options, callback), 10 * 1000)
      }

      return results.tasks && results.tasks.error
        ? callback(new Error(results.tasks.error +' '+ results.tasks.reason))
        : callback(new Error('No active tasks returned from CouchDB'));
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
    // If there are resulting replicator documents
    // then add them to the set of known keys in
    // case there were no _active_tasks
    //
    if (results.docs) {
      keys = keys.concat(
        Object.keys(results.docs).filter(function (key) {
          return !~keys.indexOf(key);
        })
      )
    }

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
        if (err) { return next(err); }
        all[key] = stat;
        next();
      });
    }, function (err) {
      return err ? callback(err) : callback(null, all);
    });
  });
};
