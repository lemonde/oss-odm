const oss = require('node-oss-client');
const Index = require('../lib/index');
const expect = require('chai').use(require('sinon-chai')).expect;
const sinon = require('sinon');
const _ = require('lodash');

describe('Index', () => {

  describe('#create', () => {
    let indexer1, indexer2, index, documents;
    let expectedOssInput, expectedOssInputFields1, expectedOssInputFields2;

    beforeEach(() => {
      indexer1 = createOssClient();
      indexer2 = createOssClient();

      index = new Index({
        name: 'my_index',
        indexers: [indexer1, indexer2]
      });

      documents = [
        {
          foo: 'bar',
          otk: 7
        },
        // another document, to test multi-document capabilities
        {
          bar: 'baz',
          otk: 10,
          targets: [ 7, 'all' ] // this tests multi-valued inputs
        }
      ];

      // the documents, as expected to be presented to OSS
      expectedOssInputFields1 = [
        { name: 'foo', value: 'bar' },
        { name: 'otk', value: 7 }
      ];
      expectedOssInputFields2 = [
        { name: 'bar',     value: 'baz' },
        { name: 'otk',     value: 10 },
        { name: 'targets', value: 7 },    //< note the flattening
        { name: 'targets', value: 'all' } //<
      ];
      expectedOssInput = [
        {
          lang: 'ENGLISH',
          fields: expectedOssInputFields1
        },
        {
          lang: 'ENGLISH',
          fields: expectedOssInputFields2
        }
      ];

      function createOssClient() {
        const client = oss.createClient();
        sinon.stub(client.documents, 'create').yields();
        return client;
      }
    });

    it('should format to correct OSS inputs', (done) => {
      index.create(documents, (err) => {
        if (err) return done(err);
        expect(indexer1.documents.create).to.have.been.calledWith('my_index', expectedOssInput);
        done();
      });
    });

    describe('when given a single document', () => {
      it('should format to correct OSS inputs', (done) => {
        const singleDocument = documents[1];
        const singleExpectedOssInput = [{
          lang: 'ENGLISH',
          fields: expectedOssInputFields2
        }];
        index.create(singleDocument, (err) => {
          if (err) return done(err);
          expect(indexer1.documents.create).to.have.been.calledWith('my_index', singleExpectedOssInput);
          done();
        });
      });
    });

    it('should create documents on each indexer', (done) => {
      index.create(documents, (err) => {
        if (err) return done(err);
        expect(indexer1.documents.create).to.have.been.calledWith('my_index', expectedOssInput);
        expect(indexer2.documents.create).to.have.been.calledWith('my_index', expectedOssInput);
        done();
      });
    });

    it('should emit the "create" event', (done) => {
      const spy = sinon.spy();
      index.on('create', spy);

      index.create(documents, (err) => {
        if (err) return done(err);
        expect(spy).to.have.been.calledWith(indexer1, 'my_index', expectedOssInput);
        expect(spy).to.have.been.calledWith(indexer2, 'my_index', expectedOssInput);
        done();
      });
    });

    describe('on error', () => {
      it('should emit an "error" event', (done) => {
        const spy = sinon.spy();
        index.on('error', spy);

        const indexError = new Error('Indexing error.');
        indexer1.documents.create.restore();
        sinon.stub(indexer1.documents, 'create').yields(indexError);

        index.create(documents,(err) => {
          if (err) return done(err);
          expect(spy).to.have.been.calledWith(indexError, indexer1, 'my_index', expectedOssInput);
          done();
        });
      });
    });

    describe('options', () => {
      var specificExpectedOssInput;
      beforeEach(function() {
        specificExpectedOssInput = _.cloneDeep(expectedOssInput);
      });

      describe('lang', () => {
        it('should be handled', (done) => {
          specificExpectedOssInput[0].lang = 'FRENCH';
          specificExpectedOssInput[1].lang = 'FRENCH';

          index.create(documents, { lang: 'FRENCH' }, (err) => {
            if (err) return done(err);
            expect(indexer1.documents.create).to.have.been.calledWith('my_index', specificExpectedOssInput);
            expect(indexer2.documents.create).to.have.been.calledWith('my_index', specificExpectedOssInput);
            done();
          });
        });
      });

      describe('custom formatter', () => {
        it('should be handled', (done) => {
          index.formatters.input = (document) => {
            document.x = 'y';
            return document;
          };

          specificExpectedOssInput[0].fields.push({ name: 'x', value: 'y' });
          specificExpectedOssInput[1].fields.push({ name: 'x', value: 'y' });

          index.create(documents, (err) => {
            if (err) return done(err);
            expect(indexer1.documents.create).to.have.been.calledWith('my_index', specificExpectedOssInput);
            done();
          });
        });
      });
    });
  });

  describe('#destroy', () => {
    let indexer1, indexer2, index, values;

    beforeEach(() => {
      indexer1 = createOssClient();
      indexer2 = createOssClient();

      index = new Index({
        name: 'my_index',
        indexers: [indexer1, indexer2]
      });

      values = [34928, 81238];

      function createOssClient() {
        const client = oss.createClient();
        sinon.stub(client.documents, 'destroy').yields();
        return client;
      }
    });

    it('should destroy documents on each indexer', (done) => {
      index.destroy(values, (err) => {
        if (err) return done(err);
        expect(indexer1.documents.destroy).to.have.been.calledWith('my_index', {
          field: 'id',
          values
        });
        expect(indexer2.documents.destroy).to.have.been.calledWith('my_index', {
          field: 'id',
          values
        });
        done();
      });
    });

    it('should emit "destroy" event', (done) => {
      const spy = sinon.spy();
      index.on('destroy', spy);

      index.destroy(values, (err) => {
        if (err) return done(err);
        expect(spy).to.have.been.calledWith(indexer1, 'my_index', {
          field: 'id',
          values
        });
        expect(spy).to.have.been.calledWith(indexer2, 'my_index', {
          field: 'id',
          values
        });
        done();
      });
    });

    it('should emit an "error" event', (done) => {
      const spy = sinon.spy();
      index.on('error', spy);

      const indexError = new Error('Indexing error.');
      indexer1.documents.destroy.restore();
      sinon.stub(indexer1.documents, 'destroy').yields(indexError);

      index.destroy(values, (err) => {
        if (err) return done(err);
        expect(spy).to.have.been.calledWith(indexError, indexer1, 'my_index', {
          field: 'id',
          values: values
        });
        done();
      });
    });

    it('should be possible to add options', (done) => {
      index.destroy(values, { field: 'id_test' }, (err) => {
        if (err) return done(err);
        expect(indexer1.documents.destroy).to.have.been.calledWith('my_index', {
          field: 'id_test',
          values
        });
        expect(indexer2.documents.destroy).to.have.been.calledWith('my_index', {
          field: 'id_test',
          values
        });
        done();
      });
    });
  });

  describe('#search', () => {
    let index, searcher, searchResult;

    beforeEach(function () {
      searchResult = {};
      searcher = createOssClient();

      index = new Index({ name: 'my_index', searcher: searcher });

      function createOssClient() {
        const client = oss.createClient();
        sinon.stub(client, 'search').yields(null, searchResult);
        return client;
      }
    });

    it('should be possible to search without options', (done) => {
      index.search('my query', (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should be possible to search with options', (done) => {
      index.search('my query', { foo: 'bar' }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          foo: 'bar',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should extend with the default template', (done) => {
      index.templates.default = { x: 'y' };

      index.search('my query', { foo: 'bar' }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
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

    it('should extend with a custom template', (done) => {
      index.templates.custom = { z: 'x' };

      index.search('my query', { template: 'custom' }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          z: 'x',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should be possible to format results', (done) => {
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

      index.search('my query', { template: 'custom' }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([{ foo: 'bar', x: 'y' }]);
        done();
      });
    });

    it('should ignore not defined filters', (done) => {
      index.search('my query', { filters: { id: 'x' } }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should map object filter', (done) => {
      index.filters = {
        id: (value) => {
          return {
            type: 'QueryFilter',
            negative: false,
            query: 'id:' + value
          };
        }
      };

      index.search('my query', { filters: { id: 'x' } }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
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

    it('should map array of filters', (done) => {
      index.filters = {
        id: (value) => {
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

      index.search('my query', { filters: { id: 'x' } }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
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

    it('should ignore it if the filter returns a falsy value', (done) => {
      index.filters = { id: () => false };

      index.search('my query', { filters: { id: 'x' } }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
          lang: 'ENGLISH',
          query: 'my query',
          filters: [],
          joins: []
        });
        done();
      });
    });

    it('should transmit options in filters', (done) => {
      index.filters = {
        id: (value, options) => {
          return {
            type: 'QueryFilter',
            negative: false,
            query: 'id:' + options.foo
          };
        }
      };

      index.search('my query', { filters: { id: 'x' }, filterOptions: { foo: 'bar' } }, (err, res) => {
        if (err) return done(err);
        expect(res.documents).to.eql([]);
        expect(searcher.search).to.have.been.calledWith('my_index', {
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

    describe('joins', () => {
      beforeEach(() => {
        index.filters = {
          id: (value) => {
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
                sectionId: (value) => {
                  return {
                    type: 'QueryFilter',
                    negative: false,
                    query: 'section_id:' + value
                  };
                },
                roleId: (value) => {
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

      it('should support query and filters', (done) => {
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
        }, (err, res) => {
          if (err) return done(err);
          expect(res.documents).to.eql([]);
          expect(searcher.search).to.have.been.calledWith('my_index', {
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

      it('should support empty query', (done) => {
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
        }, (err, res) => {
          if (err) return done(err);
          expect(res.documents).to.eql([]);
          expect(searcher.search).to.have.been.calledWith('my_index', {
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
