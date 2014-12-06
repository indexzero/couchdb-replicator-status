/*
 * diff.js: Compares two status objects.
 *
 * (C) 2013, Charlie Robbins
 *
 */

//
// ## function diff (lstat, rstat)
// Performs a comparison of the two status objects
//
module.exports = function (lstat, rstat) {
  //
  // Start the diff by subtracting the integer scalar values at
  // the top-level of the status Object(s).
  //
  var diff = ['updated_on', 'state_time', 'checkpointed_source_seq', 'remaining']
    .reduce(function (all, key) {
      all[key] = lstat[key] - rstat[key];
      return all;
    }, {});

  //
  // Compute diffs of the source and target databases so that
  // they can be used later.
  //
  ['source', 'target'].forEach(function (db) {
    diff[db] = ['doc_count', 'doc_del_count', 'update_seq', 'disk_size',
      'data_size', 'committed_update_seq'].reduce(function (all, key) {
        all[key] = lstat[db][key] - rstat[db][key];
        return all;
      }, {});
  });

  //
  // Compute the diff in progress by diffing the floating
  // point progress values to two decimal points.
  //
  diff.progress = Object.keys(lstat.progress)
    .reduce(function (all, key) {
      all[key] = (lstat.progress[key] - rstat.progress[key]).toFixed(2);
      return all;
    }, {});

  return diff;
};
