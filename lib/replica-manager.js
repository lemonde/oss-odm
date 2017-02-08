/**
 * Module dependencies.
 */

const _ = require('lodash');
const async = require('async');

/**
 * Expose module.
 */

exports.replicateAllIndexes = replicateAllIndexes;

/**
 * Replicate index schemas.
 *
 * @param {OssClient|OssClient[]} clients
 * @param {Object|Object[]} schemas
 * @param {Function} cb
 */

function replicateAllIndexes(clients, schemas, cb) {
  schemas = _.isArray(schemas) ? schemas : [schemas];

  async.eachSeries(clients.searchers, (searcher, callback) => {
    replicateIndexesOnOneSearcher(clients, searcher, schemas, callback);
  }, (err) => {
    return cb(err);
  });
}

function replicateIndexesOnOneSearcher(clients, searcher, schemas, asyncCb) {
  //console.log('searcher', searcher);
  const mainIndexer = clients.indexers[0];
  async.waterfall([
  function getNonExistingIndexesOnSearcher (callback) {
    async.concat(schemas, (schema, cb) => {
      searcher.indexes.exists(schema.name, (err) => {
        if(err) {
          return cb(null, schema.name);
        }
        else cb();
      });

    },callback);
  },

  function createIndexesOnSearcher(replicaIndexes, callback) {
    async.each(replicaIndexes, (replica, cb) => {
      searcher.indexes.create(replica, (err) => {
        if (err) return cb(err);
        cb(err);
      });
    }, callback);
  },
  function createIndexesReplication(callback) {
     async.eachSeries(clients.indexers, _.partial(replicateIndexes, schemas, searcher), callback);
  },

  function startAReplicationOnAllIndexes(callback) {
    async.eachSeries(schemas, (schema, cb) => {
      mainIndexer.indexes.replicate(schema.name, searcher.options, cb);
    }, callback);
  }], (err) => {
    if (err) return asyncCb(err);
    asyncCb();
  });
}

function replicateIndexes(schemas, searcher, indexer, callback) {
  async.eachSeries(schemas, (schema, cb) => {
     indexer.createIndexReplication(schema.name, searcher.options, cb);
   },callback);
}
