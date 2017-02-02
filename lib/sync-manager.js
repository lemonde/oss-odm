/**
 * Module dependencies.
 */

const _ = require('lodash');
const async = require('async');

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

  let commands = [];

  clients.forEach(dropSchemas);

  /**
   * Drop schemas on a specific client.
   *
   * @param {OssClient} client
   */

  function dropSchemas(client) {
    commands = commands.concat(names.map((name) => {
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
    const creationCommands = schemas.map((schema) => {
      return (callback) => {
        client.indexes.exists(schema.name, (err) => {
          if (! err) return callback();
          client.indexes.create(schema.name, callback);
        });
      };
    });

    // Check differences between existing schemas and input schemas.
    async.series(creationCommands, (err) => {
      if (err) return callback(err);
      async.each(schemas, (schema, callback) => {
        client.indexes.fields.list(schema.name, (err, res) => {
          if (err) return callback(err);

          let commands = [];

          // Sync templates.
          commands.push(syncTemplates.bind(null, schema));

          // If schema if diff, sync fields.
          if (schemaDiff(res, schema)) commands.push(syncFields.bind(null, schema));

          async.series(commands, callback);
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
      const formattedInputSchema = {
        unique: inputSchema.uniqueField,
        default: inputSchema.defaultField,
        fields: inputSchema.fields.map(function (field) {
          const { name, indexed, stored, termVector } = field;
          let formattedField = {
            name,
            indexed: indexed ? 'YES' : 'NO',
            stored: stored ? 'YES' : 'NO',
            termVector: termVector ? 'YES' : 'NO'
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
     * Sync templates.
     */

    function syncTemplates(schema, callback) {
      let commands = [];

      schema.templates = schema.templates || [];

      // Create / update templates.
      commands = commands.concat(schema.templates.map((template) => {
        return client.templates.createOrUpdate.bind(
          client.templates,
          schema.name,
          template.name,
          _.omit(template, 'name')
        );
      }));

      // Delete templates wich are no longer in the schema.
      commands.push(deleteTemplates.bind(null, schema));

      async.series(commands, callback);
    }

    /**
     * Delete templates.
     *
     * @param {Object} schema
     * @param {Function} callback
     */

    function deleteTemplates(schema, callback) {
      client.templates.list(schema.name, (err, res) => {
        if (err) return callback(err);
        if (! res.templates) return callback();
        async.each(res.templates, deleteTemplate.bind(null, schema), callback);
      });
    }

    /**
     * Delete template.
     *
     * @param {Object} schema
     * @param {Object} template
     * @param {Function} callback
     */

    function deleteTemplate(schema, template, callback) {
      const schemaTemplateNames = _.pluck(schema.templates, 'name');
      if(_.contains(schemaTemplateNames, template.name)) return callback();
      client.templates.destroy(schema.name, template.name, callback);
    }

    /**
     * Sync fields.
     *
     * @param {Function} callback
     */

    function syncFields(schema, callback) {
      let commands = [];

      // Create / update fields.
      commands = commands.concat(schema.fields.map((field) => {
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
     * Delete fields.
     *
     * @param {Object} schema
     * @param {Function} callback
     */

    function deleteFields(schema, callback) {
      client.fields.list(schema.name, (err, res) => {
        if (err) return callback(err);
        if (! res.fields) return callback();
        async.each(res.fields, deleteField.bind(null, schema), callback);
      });
    }

    /**
     * Delete field.
     *
     * @param {Object} schema
     * @param {Object} field
     * @param {Function} callback
     */

    function deleteField(schema, field, callback) {
      const schemaFieldNames = _.map(schema.fields, 'name');
      if(_.contains(schemaFieldNames, field.name)) return callback();
      client.fields.destroy(schema.name, field.name, callback);
    }
  }
}
