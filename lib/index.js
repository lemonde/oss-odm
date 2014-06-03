/**
 * Module dependencies.
 */

var _ = require('lodash');
var util = require('util');
var async = require('async');
var events = require('events');

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
  this.formatters = _.merge({
    output: require('./formatters/output')
  }, options.formatters);
  this.templates = options.templates || {};
  this.filters = options.filters || {};
  this.joins = options.joins || {};
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

  // Apply a custom input formatter.
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
 * Destroy documents in index.
 *
 * @param {String|String[]} values
 * @param {Function} callback
 */

Index.prototype.destroy = function destroy(values, options, callback) {
  var index = this;

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
    var opts = {
      field: options.field,
      values: values
    };

    client.documents.destroy(index.name, opts, function (err) {
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

  // Map filters.
  options.filters = this.mapFilters(options);

  // Map joins.
  options.joins = this.mapJoins(options);

  // Remove unknown keys.
  options = _.omit(options, 'template', 'filterOptions');

  this.searcher.search(this.name, options, function (err, result) {
    if (err) return callback(err);
    if (! result || ! result.documents) return callback(null, { documents: [] });

    // Format documents in a plain object.
    result.documents = result.documents.map(this.formatDocument, this);

    // Apply a custom output formatter.
    if (this.formatters.output) result.documents = result.documents.map(this.formatters.output);

    callback(null, result);
  }.bind(this));
};

/**
 * Query more like this on the index.
 *
 * @param {String} text
 * @param {Object} options
 * @param {Function} callback
 */

Index.prototype.moreLikeThis = function moreLikeThis(text, options, callback) {
  // moreLikeThis(text, callback)
  if (! callback) {
    callback = options;
    options = {};
  }

  // Extend with default options.
  options = _.defaults(options || {}, {
    likeText: text,
    lang: this.lang
  });

  // Map filters.
  options.filters = this.mapFilters(options);

  // Remove unknown keys.
  options = _.omit(options, 'filterOptions');

  this.searcher.moreLikeThis(this.name, options, function (err, result) {
    if (err) return callback(err);
    if (! result || ! result.documents) return callback(null, { documents: [] });

    // Format documents in a plain object.
    result.documents = result.documents.map(this.formatDocument, this);

    // Apply a custom output formatter.
    if (this.formatters.output) result.documents = result.documents.map(this.formatters.output);

    callback(null, result);
  }.bind(this));
};

/**
 * Map options.filters on index.filters.
 *
 * @param {Object} options
 * @param {[String]} options.filters
 * @return [Object]
 */

Index.prototype.mapFilters = function mapFilters(options) {
  return _.reduce(options.filters, function (filters, value, key) {
    var transformer = this.filters[key];

    // If transformer doesn't exist, do nothing.
    if (! transformer) return filters;

    // Map filter.
    var ossFilter = transformer(value, options.filterOptions);

    // Do nothing if filter is not a valid object.
    if (! ossFilter) return filters;

    // Append filter.
    if (_.isArray(ossFilter)) filters = filters.concat(ossFilter); // Array of filters.
    else filters.push(ossFilter); // One filter.

    return filters;
  }.bind(this), []);
};

/**
 * Map options.joins on index.joins.
 *
 * @param {Object} options
 * @param {[String]} options.join
 * @return [Object]
 */

Index.prototype.mapJoins = function (options) {
  return _.reduce(options.joins, function (joins, join, name) {

    // Get join index options.
    var indexJoin = this.joins[name];

    // If join is not found on the index, return null.
    if (! indexJoin) return joins;

    // Default template and filters.
    join = _.defaults(join, {
      template: 'default',
      filters: {}
    });

    // Get template.
    var template = indexJoin.index.templates[join.template];

    // If template is not found, return null.
    if (! template) return joins;

    // Default query to '*:*'.
    join.query = join.query || '*:*';

    // Build query.
    var query = _.map(template.searchFields, function (field) {
      return field.field + ':(' + join.query + ')^' + field.boost;
    })
    .join(' OR ');


    // Build filters and append them to query.
    query = _.map(join.filters, function (value, key) {
      return indexJoin.index.filters[key](value);
    })
    .filter(function (filter) {
      return filter.type === 'QueryFilter';
    })
    .map(function (filter) {
      return filter.negative ? '-(' + filter.query + ')' : '(' + filter.query + ')';
    })
    .concat(['(' + query + ')'])
    .join(' AND ');

    return joins.concat([_.defaults({
      queryString: query,
      indexName: indexJoin.index.name
    }, _.omit(indexJoin, 'index'))]);
  }, [], this);
};

/**
 * Format a document in a plain object.
 *
 * @param {Object} document
 * @returns {Object}
 */

Index.prototype.formatDocument = function (document) {
  return _.extend({
    info: _.omit(document, 'fields')
  }, document.fields.reduce(function (obj, field) {
    obj[field.fieldName] = field.values || [];
    return obj;
  }, {}));
};