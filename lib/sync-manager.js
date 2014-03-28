/**
 * Module dependencies.
 */

var _ = require('lodash');
var async = require('async');

/**
 * Expose module.
 */

exports.drop = drop;
exports.sync = sync;

/**
 * Drop indexes.
 *
 * @param {OssClient|OssClient[]} clients
 * @param {String|String[]} names
 * @param {Function} callback
 */

function drop(clients, names, callback) {
  clients = _.isArray(clients) ? clients : [clients];
  names = _.isArray(names) ? names : [names];

  var commands = [];

  clients.forEach(dropSchemas);

  /**
   * Drop schemas on a specific client.
   *
   * @param {OssClient} client
   */

  function dropSchemas(client) {
    commands = commands.concat(names.map(function (name) {
      return client.indexes.destroy.bind(client.indexes, name);
    }));
  }

  async.series(commands, callback);
}

/**
 * Sync index schemas.
 *
 * @param {OssClient|OssClient[]} clients
 * @param {Object|Object[]} schemas
 * @param {Function} callback
 */

function sync(clients, schemas, callback) {
  clients = _.isArray(clients) ? clients : [clients];
  schemas = _.isArray(schemas) ? schemas : [schemas];

  var commands = [];

  clients.forEach(syncSchemas);

  /**
   * Sync schemas on a specific client.
   *
   * @param {OssClient} client
   */

  function syncSchemas(client) {
    // Create indexes.
    commands = commands.concat(schemas.map(function (schema) {
      return function (callback) {
        client.indexes.exists(schema.name, function (err) {
          if (! err) return callback();
          client.indexes.create(schema.name, callback);
        });
      };
    }));

    // Create / update fields.
    schemas.forEach(function (schema) {
      commands = commands.concat(schema.fields.map(function (field) {
        return client.fields.createOrUpdate.bind(client.indexes, schema.name, field);
      }));
    });

    // Set unique and default fields.
    schemas.forEach(function (schema) {
      if (! schema.uniqueField || ! schema.defaultField) return ;

      commands.push(client.fields.setUniqueDefault.bind(client.fields, schema.name, {
        unique: schema.uniqueField,
        default: schema.defaultField
      }));
    });

    // Delete OSS fields which are no longer in the schema.
    commands.push(function (callback) {
      async.each(schemas, deleteFields, callback);
    });

    /**
     * Delete all fields present in a schema.
     *
     * @param {Object} schema
     * @param {Function} callback
     */

    function deleteFields(schema, callback) {
      client.fields.list(schema.name, function (err, res) {
        if (err) return callback(err);
        if (! res.fields) return callback();
        async.each(res.fields, deleteField.bind(null, schema), callback);
      });
    }

    /**
     * Delete a specific field in a schema.
     *
     * @param {Object} schema
     * @param {Object} field
     * @param {Function} callback
     */

    function deleteField(schema, field, callback) {
      var schemaFieldNames = _.pluck(schema.fields, 'name');
      if(_.contains(schemaFieldNames, field.name)) return callback();
      client.fields.destroy(schema.name, field.name, callback);
    }
  }

  async.series(commands, callback);
}