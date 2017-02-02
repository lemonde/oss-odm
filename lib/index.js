/**
 * Module dependencies.
 */

const _ = require('lodash');
const async = require('async');
const events = require('events');
const util = require('util');

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

function Index({ name, searcher, indexers, formatters = {}, templates = {}, filters = {}, joins = {}, lang = 'ENGLISH' }) {
  this.name = name;
  this.searcher = searcher;
  this.formatters = formatters;
  this.templates = templates;
  this.filters = filters;
  this.joins = joins;
  this.lang = lang;

  // Accept single indexer.
  this.indexers = _.isArray(indexers) ? indexers : [indexers];

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
  const index = this;

  // search(query, callback)
  if (! callback) {
    callback = options;
    options = {};
  }

  // Default index lang.
  options.lang = options.lang || this.lang;

  // Rationalize input : single document into an array.
  documents = _.isArray(documents) ? documents : [documents];

  // Apply custom input formatter if any.
  if (this.formatters.input) documents = documents.map(this.formatters.input);

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
      // REM : multi-valued fields (when value is an array)
      //       should be flattened into several "fields" entries.
      //       Hence the reduce.
      fields: _.reduce(document, (accumulator, values, key) => {
        // rationalize input
        if (!_.isArray(values)) values = [ values ];
        // convert into field entries
        values.forEach((value) => {
          accumulator.push({ name: key, value });
        });
        return accumulator;
      }, [])
    };
  }

  /**
   * Create document in OSS client.
   *
   * @param {OssClient} client
   * @param {Function} callback
   */

  function createInClient(client, callback) {
    client.documents.create(index.name, documents, (err) => {
      // Errors are not blocking indexation, we just emit an event.
      if (err) index.emit('error', err, client, index.name, documents);
      else index.emit('create', client, index.name, documents);
      callback();
    });
  }
};

/**
 * Destroy documents in index.
 *
 * @param {String|String[]} values
 * @param {Function} callback
 */

Index.prototype.destroy = function destroy(values, options, callback) {
  const index = this;

  // search(query, callback)
  if (! callback) {
    callback = options;
    options = {};
  }

  // Default field to id.
  options.field = options.field || 'id';

  // Accept single value.
  values = _.isArray(values) ? values : [values];

  // Destroy documents in each clients.
  async.each(this.indexers, destroyInClient, callback);

  /**
   * Create document in OSS client.
   *
   * @param {OssClient} client
   * @param {Function} callback
   */

  function destroyInClient(client, callback) {
    const opts = {
      field: options.field,
      values
    };

    client.documents.destroy(index.name, opts, (err) => {
      // Errors are not blocking indexation, we just emit an event.
      if (err) index.emit('error', err, client, index.name, opts);
      else index.emit('destroy', client, index.name, opts);
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
  const index = this;

  // search(query, callback)
  if (! callback) {
    callback = options;
    options = {};
  }

  // Extend with default options.
  options = _.defaults(options || {}, {
    template: 'default',
    query,
    lang: this.lang
  });

  // Extend with template.
  options = _.defaults(options, this.templates[options.template]);

  // Map filters.
  options.filters = _.reduce(options.filters, (filters, value, key) => {
    const transformer = index.filters[key];

    // If transformer doesn't exist, do nothing.
    if (! transformer) return filters;

    // Map filter.
    const ossFilter = transformer(value, options.filterOptions);

    // Do nothing if filter is not a valid object.
    if (! ossFilter) return filters;

    // Append filter.
    if (_.isArray(ossFilter)) filters = filters.concat(ossFilter); // Array of filters.
    else filters.push(ossFilter); // One filter.

    return filters;
  }, []);

  // Map joins.
  options.joins = _.map(options.joins, (join, name) => {

    // Get join index options.
    const indexJoin = index.joins[name];

    // If join is not found on the index, return null.
    if (! indexJoin) return null;

    // Default template and filters.
    join = _.defaults(join, {
      template: 'default',
      filters: {}
    });

    // Get template.
    const template = indexJoin.index.templates[join.template];

    // If template is not found, return null.
    if (! template) return null;

    // Default query to '*:*'.
    join.query = join.query || '*:*';

    // Build query.
    let query = _.map(template.searchFields, (field) => {
      return `${field.field}:(${join.query})^${field.boost}`;
    })
    .join(' OR ');


    // Build filters and append them to query.
    query = _.map(join.filters, (value, key) => {
      return indexJoin.index.filters[key](value);
    })
    .filter((filter) => filter.type === 'QueryFilter')
    .map((filter) => {
      return filter.negative ? `-(${filter.query})` : `(${filter.query})`;
    })
    .concat([`(${query})`])
    .join(' AND ');

    return _.defaults({
      queryString: query,
      indexName: indexJoin.index.name
    }, _.omit(indexJoin, 'index'));
  })
  .filter((join) => join)

  // Remove unknown keys.
  options = _.omit(options, 'template', 'filterOptions');

  this.searcher.search(this.name, options, (err, result) => {
    if (err) return callback(err);
    if (! result || ! result.documents) return callback(null, { documents: [] });

    // Format documents in a plain object.
    result.documents = result.documents.map(formatDocument);

    // Apply a custom output formatter.
    if (index.formatters.output) result.documents = result.documents.map(index.formatters.output);

    callback(null, result);
  });

  /**
   * Format a document in a plain object.
   *
   * @param {Object} document
   * @returns {Object}
   */

  function formatDocument(document) {
    return document.fields.reduce((obj, field) => {
      obj[field.fieldName] = field.values && field.values[0] || null;
      return obj;
    }, {});
  }
};
