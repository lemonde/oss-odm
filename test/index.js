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
          query: 'my query'
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
          foo: 'bar'
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
          x: 'y'
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
          z: 'x'
        });
        done();
      });
    });

    it('should be possible to format results', function (done) {
      searchResult.documents = [{ id: 1 }];

      index.format = function formatDocument(document) {
        document.foo = 'bar';
        return document;
      };

      index.search('my query', { template: 'custom' }, function (err, res) {
        if (err) return done(err);
        expect(res.documents).to.eql([{ id: 1, foo: 'bar' }]);
        done();
      });
    });
  });
});