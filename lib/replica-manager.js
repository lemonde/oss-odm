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
  const mainIndexer = clients.indexers[0];
  async.waterfall([
  function getNonExistingIndexesOnSearcher (callback) {
    async.concat(schemas, (schema, cb) => {
      clients.searcher.indexes.exists(schema.name, (err) => {
        if(err) {
          return cb(null, schema.name);
        }
        else cb();
      });

    },callback);
  },

  function createIndexesOnSearcher(replicaIndexes, callback) {
    async.each(replicaIndexes, (replica, cb) => {
      clients.searcher.indexes.create(replica, (err) => {
        if (err) return done(err);
        cb(err);
      });
    }, callback);
  },
  function createReplicationIndexes(callback) {
     async.each(clients.indexers, _.partial(replicateIndexes, schemas, clients.searcher), callback);
  },

  function startAReplicationOnAllIndexes(callback) {
    async.each(schemas, (schema, cb) => {
      mainIndexer.indexes.replicate(schema.name, clients.searcher.options, cb);
    }, callback);
  }], (err) => {
    if (err) return cb(err);
    cb();
  });

  function replicateIndexes(schemas, searcher, indexer, callback) {
    async.each(schemas, (schema, cb) => {
       indexer.createReplicationIndex(schema.name, clients.searcher.options, cb);
     },callback);
  }
}
