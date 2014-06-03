var _ = require('lodash');

/**
 * Module interface.
 */

module.exports = formatDocument;

/**
 * Convert document properties from array to scalar.
 *
 * @param {Object} document
 * @return {Object}
 */

function formatDocument(document) {
  return _.transform(document, function (result, value, key) {
    result[key] = Array.isArray(value) ? (value[0] || null) : (value || null);
  });
}