couchdb-replicator-status
=========================

Retu sadfsadfrns status of various replication tasks for a given CouchDB server

## Data format

``` js
[{
  id: 'in:some-db',
  progress: 43.14,
  reminaing: 45000000000,
  continuous: true,
  checkpoint_source_seq: 64858,
  started_on: 1383701360,
  updated_on: 1383701360,
  state: 'triggered',
  state_time: "2013-11-06T01:29:17+00:00",
  target: {
    name: 'target_database',
    source_seq: 64858,
    disk_size:  34147589769
  },
  source: {
    name: 'source_database'
    disk_size:  79147589769,
    source_seq: 121858,
    url: 'https://user:pass@remotedb.addr.com/source_database'
  }
}]
```