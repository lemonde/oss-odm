var oss = require('node-oss-client');
var replicaManager = require('../lib/replica-manager');
var expect = require('chai').use(require('sinon-chai')).expect;
var sinon = require('sinon');

describe('Replica manager', function () {
  var client, schemas;

  beforeEach(function () {
    client = oss.createClient();
    var indexExistsStub = sinon.stub().yields('articles');
    var replicationIndexStub = sinon.stub().yields();
    var replicateStub = sinon.stub().yields();
    var createIndexStub = sinon.stub().yields();

    client.indexers = [
      {
        createReplicationIndex: replicationIndexStub,
        indexes: {
          replicate: replicateStub
        }
      }
    ];
    client.searcher = {
      indexes: {
        create: createIndexStub,
        exists: indexExistsStub
      }
    }
    schemas = { name: 'articles' };

  });

  describe('#replicateAllIndexes', function () {
    it('should call client method to check if index exists in searcher', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, function() {
        expect(client.searcher.indexes.exists).to.have.been.called;
        done();
      });
    });

    it('should call client method to create non existent indexes', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, function() {
        expect(client.searcher.indexes.create).to.have.been.called;
        expect(client.searcher.indexes.create).to.have.been.calledWithMatch('articles')
        done();
      });
    });

    it('should call client method to create createReplicationIndex', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, function() {
        expect(client.indexers[0].createReplicationIndex).to.have.been.called;
        expect(client.indexers[0].createReplicationIndex).to.have.been.calledWithMatch('articles')
        done();
      });
    });

    it('should call client method to replicate an index', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, function() {
        expect(client.indexers[0].indexes.replicate).to.have.been.called;
        expect(client.indexers[0].indexes.replicate).to.have.been.calledWithMatch('articles')
        done();
      });
    });

  });

});
