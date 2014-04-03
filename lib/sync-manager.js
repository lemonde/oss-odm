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

  async.each(clients, syncSchemas, callback);

  /**
   * Sync schemas on a specific client.
   *
   * @param {OssClient} client
   */

  function syncSchemas(client, callback) {

    // Create indexes.
    var creationCommands = schemas.map(function (schema) {
      return function (callback) {
        client.indexes.exists(schema.name, function (err) {
          if (! err) return callback();
          client.indexes.create(schema.name, callback);
        });
      };
    });

    // Check differences between existing schemas and input schemas.
    async.series(creationCommands, function (err) {
      if (err) return callback(err);
      async.each(schemas, function (schema, callback) {
        client.indexes.fields.list(schema.name, function (err, res) {
          if (err) return callback(err);
          if (schemaDiff(res, schema)) return syncFields(schema, callback);
          callback();
        });
      }, callback);
    });

    /**
     * Check diff between OSS schema and input schema.
     *
     * @param {Object} ossSchema
     * @param {Object} inputSchema
     */

    function schemaDiff(ossSchema, inputSchema) {
      var formattedInputSchema = {
        unique: inputSchema.uniqueField,
        default: inputSchema.defaultField,
        fields: inputSchema.fields.map(function (field) {
          var formattedField = {
            name: field.name,
            indexed: field.indexed ? 'YES' : 'NO',
            stored: field.stored ? 'YES' : 'NO',
            termVector: field.termVector ? 'YES' : 'NO'
          };

          if (field.copyOf) formattedField.copyOf = field.copyOf;
          if (field.analyzer) formattedField.analyzer = field.analyzer;

          return formattedField;
        })
      };

      return ! _.isEqual(
        _.pick(ossSchema, 'unique', 'default', 'fields'),
        formattedInputSchema
      );
    }

    /**
     * Sync fields.
     *
     * @param {Function} callback
     */

    function syncFields(schema, callback) {
      var commands = [];

      // Create / update fields.
      commands = commands.concat(schema.fields.map(function (field) {
        return client.fields.createOrUpdate.bind(client.indexes, schema.name, field);
      }));

      // Set unique and default fields.
      if (schema.uniqueField && schema.defaultField) {
        commands.push(client.fields.setUniqueDefault.bind(client.fields, schema.name, {
          unique: schema.uniqueField,
          default: schema.defaultField
        }));
      }

      // Delete OSS fields which are no longer in the schema.
      commands.push(deleteFields.bind(null, schema));

      async.series(commands, callback);
    }


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
}