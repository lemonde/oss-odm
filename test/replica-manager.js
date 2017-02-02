const oss = require('node-oss-client');
const replicaManager = require('../lib/replica-manager');

describe('Replica manager', () => {
  let client, schemas;

  beforeEach(() => {
    client = oss.createClient();
    var indexExistsStub = sinon.stub().yields('articles');
    var replicationIndexStub = sinon.stub().yields();
    var replicateStub = sinon.stub().yields();
    var createIndexStub = sinon.stub().yields();

    client.indexers = [
      {
        createReplicationIndex: replicationIndexStub,
        indexes: { replicate: replicateStub }
      }
    ];
    client.searcher = { indexes: { create: createIndexStub, exists: indexExistsStub } };
    schemas = { name: 'articles' };

  });

  describe('#replicateAllIndexes', () => {
    it('should call client method to check if index exists in searcher', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, () => {
        expect(client.searcher.indexes.exists).to.have.been.called;
        done();
      });
    });

    it('should call client method to create non existent indexes', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, () => {
        expect(client.searcher.indexes.create).to.have.been.called;
        expect(client.searcher.indexes.create).to.have.been.calledWithMatch('articles')
        done();
      });
    });

    it('should call client method to create createReplicationIndex', (done) => {
      replicaManager.replicateAllIndexes(client, schemas, function() {
        expect(client.indexers[0].createReplicationIndex).to.have.been.called;
        expect(client.indexers[0].createReplicationIndex).to.have.been.calledWithMatch('articles')
        done();
      });
    });

    it('should call client method to replicate an index', (done) => {
      replicaManager.replicateAllIndexes(client, schemas, function() {
        expect(client.indexers[0].indexes.replicate).to.have.been.called;
        expect(client.indexers[0].indexes.replicate).to.have.been.calledWithMatch('articles')
        done();
      });
    });

  });

});
