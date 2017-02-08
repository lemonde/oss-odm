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
        createIndexReplication: replicationIndexStub,
        indexes: { replicate: replicateStub }
      }
    ];
    client.searchers = [{ indexes: { create: createIndexStub, exists: indexExistsStub } }];
    schemas = { name: 'articles' };

  });

  describe('#replicateAllIndexes', () => {
    it('should call client method to check if index exists in searcher', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, () => {
        expect(client.searchers[0].indexes.exists).to.have.been.called;
        done();
      });
    });

    it('should call client method to create non existent indexes', function (done) {
      replicaManager.replicateAllIndexes(client, schemas, () => {
        expect(client.searchers[0].indexes.create).to.have.been.called;
        expect(client.searchers[0].indexes.create).to.have.been.calledWithMatch('articles')
        done();
      });
    });

    it('should call client method to create createIndexReplication', (done) => {
      replicaManager.replicateAllIndexes(client, schemas, function() {
        expect(client.indexers[0].createIndexReplication).to.have.been.called;
        expect(client.indexers[0].createIndexReplication).to.have.been.calledWithMatch('articles')
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
