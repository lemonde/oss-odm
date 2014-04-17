var oss = require('node-oss-client');
var Index = require('../lib/index');
var expect = require('chai').use(require('sinon-chai')).expect;
var sinon = require('sinon');

describe('Index', function () {
  describe('#create', function () {
    var indexer1, indexer2, index, documents;

    beforeEach(function () {
      indexer1 = createOssClient();
      indexer2 = createOssClient();

      index = new Index({
        name: 'my_index',
        indexers: [indexer1, indexer2]
      });

      documents = [{ my_custom_key: 'bar' }];

      function createOssClient() {
        var client = oss.createClient();
        sinon.stub(client.documents, 'create').yields();
        return client;
      }
    });

    it('should create documents on each indexer', function (done) {
      index.create(documents, function (err) {
        if (err) return done(err);
        expect(indexer1.documents.create).to.be.calledWith('my_index', [{
          lang: 'ENGLISH',
          fields: [
            { name: 'my_custom_key', value: 'bar' }
          ]
        }]);
        expect(indexer2.documents.create).to.be.calledWith('my_index', [{
          lang: 'ENGLISH',
          fields: [
            { name: 'my_custom_key', value: 'bar' }
          ]
        }]);
        done();
      });
    });

    it('should emit "create" event', function (done) {
      var spy = sinon.spy();
      index.on('create', spy);

      index.create(documents, function (err) {
        if (err) return done(err);
        expect(spy).to.be.calledWith(indexer1, 'my_index', [{
          lang: 'ENGLISH',
          fields: [
            { name: 'my_custom_key', value: 'bar' }
          ]
        }]);
        expect(spy).to.be.calledWith(indexer2, 'my_index', [{
          lang: 'ENGLISH',
          fields: [
            { name: 'my_custom_key', value: 'bar' }
          ]
        }]);
        done();
      });
    });

    it('should emit an "error" event', function (done) {
      var spy = sinon.spy();
      index.on('error', spy);

      var indexError = new Error('Indexing error.');
      indexer1.documents.create.restore();
      sinon.stub(indexer1.documents, 'create').yields(indexError);

      index.create(documents, function (err) {
        if (err) return done(err);
        expect(spy).to.be.calledWith(indexError, indexer1, 'my_index', [{
          lang: 'ENGLISH',
          fields: [
            { name: 'my_custom_key', value: 'bar' }
          ]
        }]);
        done();
      });
    });

    it('should be possible to add options', function (done) {
      index.create(documents, { lang: 'FRENCH' }, function (err) {
        if (err) return done(err);
        expect(indexer1.documents.create).to.be.calledWith('my_index', [{
          lang: 'FRENCH',
          fields: [
            { name: 'my_custom_key', value: 'bar' }
          ]
        }]);
        expect(indexer2.documents.create).to.be.calledWith('my_index', [{
          lang: 'FRENCH',
          fields: [
            { name: 'my_custom_key', value: 'bar' }
          ]
        }]);
        done();
      });
    });

    it('should be possible to add a custom formatter', function (done) {
      index.formatters.input = function (document) {
        document.x = 'y';
        return document;
      };

      index.create(documents, { lang: 'FRENCH' }, function (err) {
        if (err) return done(err);
        expect(indexer1.documents.create).to.be.calledWith('my_index', [{
          lang: 'FRENCH',
          fields: [
            { name: 'my_custom_key', value: 'bar' },
            { name: 'x', value: 'y' }
          ]
        }]);
        done();
      });
    });
  });

  describe('#destroy', function () {
    var indexer1, indexer2, index, values;

    beforeEach(function () {
      indexer1 = createOssClient();
      indexer2 = createOssClient();

      index = new Index({
        name: 'my_index',
        indexers: [indexer1, indexer2]
      });

      values = [34928, 81238];

      function createOssClient() {
        var client = oss.createClient();
        sinon.stub(client.documents, 'destroy').yields();
        return client;
      }
    });

    it('should destroy documents on each indexer', function (done) {
      index.destroy(values, function (err) {
        if (err) return done(err);
        expect(indexer1.documents.destroy).to.be.calledWith('my_index', {
          field: 'id',
          values: values
        });
        expect(indexer2.documents.destroy).to.be.calledWith('my_index', {
          field: 'id',
          values: values
        });
        done();
      });
    });

    it('should emit "destroy" event', function (done) {
      var spy = sinon.spy();
      index.on('destroy', spy);

      index.destroy(values, function (err) {
        if (err) return done(err);
        expect(spy).to.be.calledWith(indexer1, 'my_index', {
          field: 'id',
          values: values
        });
        expect(spy).to.be.calledWith(indexer2, 'my_index', {
          field: 'id',
          values: values
        });
        done();
      });
    });

    it('should emit an "error" event', function (done) {
      var spy = sinon.spy();
      index.on('error', spy);

      var indexError = new Error('Indexing error.');
      indexer1.documents.destroy.restore();
      sinon.stub(indexer1.documents, 'destroy').yields(indexError);

      index.destroy(values, function (err) {
        if (err) return done(err);
        expect(spy).to.be.calledWith(indexError, indexer1, 'my_index', {
          field: 'id',
          values: values
        });
        done();
      });
    });

    it('should be possible to add options', function (done) {
      index.destroy(values, { field: 'id_test' }, function (err) {
        if (err) return done(err);
        expect(indexer1.documents.destroy).to.be.calledWith('my_index', {
          field: 'id_test',
          values: values
        });
        expect(indexer2.documents.destroy).to.be.calledWith('my_index', {
          field: 'id_test',
          values: values
        });
        done();
      });
    });
  });

  describe('#search', function () {
    var index, searcher, searchResult;

    beforeEach(function () {
      searchResult = {};
      searcher = createOssClient();

      index = new Index({
        name: 'my_index',
        searcher: searcher
      });

      function createOssClient() {
        var client = oss.createClient();
        sinon.stub(client, 'search').yields(null, searchResult);
        return client;
      }
    });

    it('should be possible to search without options', function (done) {
      index.search('my query', function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should be possible to search with options', function (done) {
      index.search('my query', { foo: 'bar' }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          foo: 'bar',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should extend with the default template', function (done) {
      index.templates.default = { x: 'y' };

      index.search('my query', { foo: 'bar' }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          foo: 'bar',
          x: 'y',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should extend with a custom template', function (done) {
      index.templates.custom = { z: 'x' };

      index.search('my query', { template: 'custom' }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          z: 'x',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should be possible to format results', function (done) {
      searchResult.documents = [
        {
          pos: 0,
          score: 0.2,
          collapseCount: 0,
          fields: [
            {
              fieldName: 'foo',
              values: [ 'bar' ]
            }
          ]
        }
      ];

      index.formatters.output = function formatDocument(document) {
        document.x = 'y';
        return document;
      };

      index.search('my query', { template: 'custom' }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([{ foo: 'bar', x: 'y' }]);
        done();
      });
    });

    it('should ignore not defined filters', function (done) {
      index.search('my query', { filters: { id: 'x' } }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should map object filter', function (done) {
      index.filters = {
        id: function (value) {
          return {
            type: 'QueryFilter',
            negative: false,
            query: 'id:' + value
          };
        }
      };

      index.search('my query', { filters: { id: 'x' } }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [
            {
              type: 'QueryFilter',
              negative: false,
              query: 'id:x'
            }
          ],
          joins: []
        });
        done();
      });
    });

    it('should map array of filters', function (done) {
      index.filters = {
        id: function (value) {
          return [
            {
              type: 'QueryFilter',
              negative: false,
              query: 'id:' + value
            },
            {
              type: 'QueryFilter',
              negative: false,
              query: 'id2:' + value
            }
          ];
        }
      };

      index.search('my query', { filters: { id: 'x' } }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [
            {
              type: 'QueryFilter',
              negative: false,
              query: 'id:x'
            },
            {
              type: 'QueryFilter',
              negative: false,
              query: 'id2:x'
            }
          ],
          joins: []
        });
        done();
      });
    });

    it('should ignore it if the filter returns a falsy value', function (done) {
      index.filters = {
        id: function () {
          return false;
        }
      };

      index.search('my query', { filters: { id: 'x' } }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should transmit options in filters', function (done) {
      index.filters = {
        id: function (value, options) {
          return {
            type: 'QueryFilter',
            negative: false,
            query: 'id:' + options.foo
          };
        }
      };

      index.search('my query', { filters: { id: 'x' }, filterOptions: { foo: 'bar' } }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.be.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [
            {
              type: 'QueryFilter',
              negative: false,
              query: 'id:bar'
            }
          ],
          joins: []
        });
        done();
      });
    });

    describe('joins', function () {
      beforeEach(function () {
        index.filters = {
          id: function (value) {
            return {
              type: 'QueryFilter',
              negative: false,
              query: 'id:' + value
            };
          }
        };

        index.joins = {
          articles: {
            index: new Index({
              name: 'articles',
              templates: {
                searchText: {
                  returnedFields: [
                    'id'
                  ],
                  searchFields: [
                    {
                      field: 'title',
                      mode: 'TERM_AND_PHRASE',
                      boost: 2
                    },
                    {
                      field: 'text',
                      mode: 'TERM_AND_PHRASE',
                      boost: 1
                    }
                  ]
                }
              },
              searcher: searcher,
              filters: {
                sectionId: function (value) {
                  return {
                    type: 'QueryFilter',
                    negative: false,
                    query: 'section_id:' + value
                  };
                },
                roleId: function (value) {
                  return {
                    type: 'QueryFilter',
                    negative: true,
                    query: 'role_id:' + value
                  };
                }
              }
            }),
            queryTemplate: 'generic',
            localField: 'article_id',
            foreignField: 'id',
            type: 'INNER',
            returnFields: false,
            returnScores: false,
            returnFacets: false
          }
        };
      });

      it('should support query and filters', function (done) {
        index.search('my query', {
          filters: { id: 210384 },
          joins: {
            articles: {
              query: 'join query',
              template: 'searchText',
              filters: {
                sectionId: 213,
                roleId: 230
              }
            }
          }
        }, function (err, res) {
          if (err) return done(err);
          expect(res.documents).to.eql([]);
          expect(searcher.search).to.be.calledWith('my_index', {
            lang: 'ENGLISH',
            query: 'my query',
            filters: [
              {
                type: 'QueryFilter',
                negative: false,
                query: 'id:210384'
              }
            ],
            joins: [
              {
                foreignField: 'id',
                indexName: 'articles',
                localField: 'article_id',
                queryString: '(section_id:213) AND -(role_id:230) AND (title:(join query)^2 OR text:(join query)^1)',
                queryTemplate: 'generic',
                returnFacets: false,
                returnFields: false,
                returnScores: false,
                type: 'INNER'
              }
            ]
          });
          done();
        });

      });

      it('should support empty query', function (done) {
        index.search('my query', {
          filters: { id: 210384 },
          joins: {
            articles: {
              query: '',
              template: 'searchText',
              filters: {
                sectionId: 213,
                roleId: 230
              }
            }
          }
        }, function (err, res) {
          if (err) return done(err);
          expect(res.documents).to.eql([]);
          expect(searcher.search).to.be.calledWith('my_index', {
            lang: 'ENGLISH',
            query: 'my query',
            filters: [
              {
                type: 'QueryFilter',
                negative: false,
                query: 'id:210384'
              }
            ],
            joins: [
              {
                foreignField: 'id',
                indexName: 'articles',
                localField: 'article_id',
                queryString: '(section_id:213) AND -(role_id:230) AND (title:(*:*)^2 OR text:(*:*)^1)',
                queryTemplate: 'generic',
                returnFacets: false,
                returnFields: false,
                returnScores: false,
                type: 'INNER'
              }
            ]
          });
          done();
        });

      });
    });
  });
});