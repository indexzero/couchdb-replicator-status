couchdb-replicator-status
=========================

Returns, watches, and calculates the status of various replication tasks for a given CouchDB server

## Usage

The best way to get familiar with this module is to examine the `.status(options, callback)` method:

``` js
var replicatorStatus = require('couchdb-replicator-status');

replicatorStatus.status({ url: 'http://localhost:5984' }, function (err, status) {
  if (err) {
    console.error('Error getting status: ' + err);
    return process.exit(1);
  }

  Object.keys(status).forEach(function (k) {
    console.dir(status[k]);
  });
});
```

There are corresponding `bin/status` and `bin/watch` scripts in `bin/*` to help quickly evaluate the status of replication on a given CouchDB server:

```
$ bin/status
usage: status [url] [filter0] [filter1] ...
```

#### .status(options, callback)

Returns all of the replication status about `options.uri || options.url` filtering to anything matching `options.filter`. If `options.sanitize` is set then no sensitive data (i.e. `.url`) is included in the status response.

#### .watch(options, callback)

Returns a new replication status Watcher for the specified options that will invoke the callback (if supplied).

#### .diff(lstat, rstat)

Performs a comparison of the two status objects.

## Status data format

Every time that `.status(options, callback)` is invoked it will respond to the callback with an Object of status information that is keyed to the `_id` of the documents in the `_replicator` database.

``` js
{ 'in:registry':
  { id: 'in:registry',
    continuous: true,
    started_on: '1383872489000',
    updated_on: '1383872691000',
    state: 'triggered',
    state_time: '1383872489000',
    checkpointed_source_seq: 701252,
    source:
     { db_name: 'registry',
       doc_count: 46660,
       doc_del_count: 4182,
       update_seq: 769036,
       purge_seq: 0,
       compact_running: false,
       disk_size: 112441020551,
       data_size: 82286322757,
       instance_start_time: '1383607285802',
       disk_format_version: 6,
       committed_update_seq: 769036,
       name: 'registry',
       uri: 'http://d2b84f7d41808de1fb3d4cd7814b70da:d2b84f7d41808de1fb3d4cd7814b741e@isaacs.iriscouch.com/registry' },
    target:
     { db_name: 'registry',
       doc_count: 44269,
       doc_del_count: 3954,
       update_seq: 699244,
       purge_seq: 0,
       compact_running: false,
       disk_size: 109329328576,
       data_size: 75531157517,
       instance_start_time: '1383872334922',
       disk_format_version: 6,
       committed_update_seq: 699244,
       name: 'registry' },
    remaining: 3111691975,
    progress:
     { docs: '94.88',
       disk_size: '97.23',
       data_size: '91.79',
       update_seq: '91.19' } } }
```

**Note: All times from CouchDB are normalized to the epoch time strings the `new Date(str)` in Javascript would expect.**

##### Copyright (C) 2013 Charlie Robbins
##### LICENSE: MIT
