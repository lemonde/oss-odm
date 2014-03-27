'use strict';

/**
 * Module dependencies.
 */

var _ = require('lodash');
var async = require('async');
var events = require('events');
var util = require('util');

/**
 * Expose module.
 */

module.exports = Index;

/**
 * Create a new index.
 *
 * @param {Object} options
 * @param {String} options.name Index name.
 * @param {OssClient|OssClient[]} options.indexers Indexers clients.
 * @param {OssClient} options.searcher Searcher client.
 * @param {Object} options.templates Search templates.
 */

function Index(options) {
  this.name = options.name;
  this.searcher = options.searcher;
  this.format = options.format;
  this.templates = options.templates || {};
  this.lang = options.lang || 'ENGLISH';

  // Accept single indexer.
  this.indexers = _.isArray(options.indexers) ? options.indexers : [options.indexers];

  events.EventEmitter.call(this);
}

// Inherits from EventEmitter.
util.inherits(Index, events.EventEmitter);

/**
 * Create documents in index.
 *
 * @param {Object|Object[]} documents
 * @param {Function} callback
 */

Index.prototype.create = function create(documents, options, callback) {
  var index = this;

  // search(query, callback)
  if (! callback) {
    callback = options;
    options = {};
  }

  // Default to index lang.
  options.lang = options.lang || this.lang;

  // Accept single document.
  documents = _.isArray(documents) ? documents : [documents];

  // Format documents in OSS format.
  documents = documents.map(formatDocument);

  // Create documents in each clients.
  async.each(this.indexers, createInClient, callback);

  /**
   * Format a document in OSS format.
   *
   * @param {Object} document
   * @returns {Object}
   */

  function formatDocument(document) {
    return {
      lang: options.lang,
      fields: _.map(document, function (value, key) {
        return { name: key, value: value };
      })
    };
  }

  /**
   * Create document in OSS client.
   *
   * @param {OssClient} client
   * @param {Function} callback
   */

  function createInClient(client, callback) {
    client.documents.create(index.name, documents, function (err) {
      // Errors are not blocking indexation, we just emit an event.
      if (err) index.emit('error', err, client, index.name, documents);
      else index.emit('create', client, index.name, documents);
      callback();
    });
  }
};

/**
 * Search in the index.
 *
 * @param {String} query
 * @param {Object} options
 * @param {Function} callback
 */

Index.prototype.search = function search(query, options, callback) {
  var index = this;

  // search(query, callback)
  if (! callback) {
    callback = options;
    options = {};
  }

  // Extend with default options.
  options = _.defaults(options || {}, {
    template: 'default',
    query: query,
    lang: this.lang
  });

  // Extend with template.
  options = _.defaults(options, this.templates[options.template]);
  options = _.omit(options, 'template');

  this.searcher.search(this.name, options, function (err, result) {
    if (err) return callback(err);
    if (! result || ! result.documents) return callback(null, { documents: [] });

    // Format documents in a plain object.
    result.documents = result.documents.map(formatDocument);

    // Format document using a custom formatter.
    if (index.format) result.documents = result.documents.map(index.format);

    callback(null, result);
  });

  /**
   * Format a document in a plain object.
   *
   * @param {Object} document
   * @returns {Object}
   */

  function formatDocument(document) {
    return document.fields.reduce(function (obj, field) {
      obj[field.fieldName] = field.values && field.values[0] || null;
      return obj;
    }, {});
  }
};