var oss = require("node-oss-client");
var manager = require("../lib/sync-manager");
var expect = require("chai").use(require("sinon-chai")).expect;
var sinon = require("sinon");

describe("Search sync manager", function () {
  var client;

  beforeEach(function () {
    client = oss.createClient();
    sinon.stub(client.indexes, "destroy").yields();
    sinon.stub(client.indexes, "create").yields();
    sinon.stub(client.indexes, "exists");
    sinon.stub(client.fields, "createOrUpdate").yields();
    sinon.stub(client.fields, "setUniqueDefault").yields();
    sinon.stub(client.fields, "list");
    sinon.stub(client.templates, "createOrUpdate").yields();
    sinon.stub(client.templates, "destroy").yields();
    sinon.stub(client.templates, "list").callsFake(function (index, callback) {
      if (index === "idx1")
        return callback(null, { templates: [{ name: "my_template" }] });
      callback(null, { templates: [] });
    });
  });

  afterEach(function () {
    client.indexes.destroy.restore();
    client.indexes.create.restore();
    client.indexes.exists.restore();
    client.fields.createOrUpdate.restore();
    client.fields.setUniqueDefault.restore();
    client.fields.list.restore();
    client.templates.createOrUpdate.restore();
    client.templates.destroy.restore();
    client.templates.list.restore();
  });

  describe("#drop", function () {
    it("should call client methods", function () {
      manager.drop(client, ["idx1", "idx2"]);
      expect(client.indexes.destroy).to.be.calledWith("idx1");
      expect(client.indexes.destroy).to.be.calledWith("idx2");
    });
  });

  describe("#sync", function () {
    var schemas;

    beforeEach(function () {
      schemas = [
        {
          name: "idx1",
          uniqueField: "unique_field",
          defaultField: "default_field",
          fields: [
            {
              name: "my_field",
            },
            {
              name: "other_field",
            },
          ],
          templates: [
            {
              name: "my_template",
              returnedFields: ["my_field"],
            },
          ],
        },
        {
          name: "idx2",
          fields: [],
        },
      ];
    });

    it("should call client methods", function () {
      client.fields.list.yields(null, {});

      // simulate that indexes not exists
      client.indexes.exists.yields("not exists error");

      manager.sync(client, schemas);
      expect(client.indexes.create).to.be.calledWith("idx1");
      expect(client.indexes.create).to.be.calledWith("idx2");
      expect(client.templates.createOrUpdate).to.be.calledWith(
        "idx1",
        "my_template",
        {
          returnedFields: ["my_field"],
        }
      );
      expect(client.templates.list).to.be.calledWith("idx1");
      expect(client.templates.list).to.be.calledWith("idx2");
      expect(client.templates.destroy).to.not.be.called;
      expect(client.fields.createOrUpdate).to.be.calledWith("idx1", {
        name: "my_field",
      });
      expect(client.fields.createOrUpdate).to.be.calledWith("idx1", {
        name: "other_field",
      });
      expect(client.fields.setUniqueDefault).to.be.calledWith("idx1", {
        unique: "unique_field",
        default: "default_field",
      });
      expect(client.fields.list).to.be.called;
    });

    it("should not call indexes.create if indexes already exists", function () {
      client.fields.list.yields(null, {});

      // simulate that indexes already exists
      client.indexes.exists.yields(null);

      manager.sync(client, schemas);
      expect(client.indexes.create).to.not.be.called;
      expect(client.fields.createOrUpdate).to.be.calledWith("idx1", {
        name: "my_field",
      });
      expect(client.fields.createOrUpdate).to.be.calledWith("idx1", {
        name: "other_field",
      });
    });

    it("should do nothing if indexes are already synced", function () {
      client.fields.list.yields(null, {
        unique: "unique_field",
        default: "default_field",
        fields: [
          {
            name: "my_field",
            indexed: "NO",
            stored: "NO",
            termVector: "NO",
          },
          {
            name: "other_field",
            indexed: "NO",
            stored: "NO",
            termVector: "NO",
          },
        ],
      });

      // simulate that indexes not exists
      client.indexes.exists.yields(null);

      manager.sync(client, [schemas[0]]);
      expect(client.indexes.create).to.not.be.called;
      expect(client.fields.createOrUpdate).not.to.be.called;
    });
  });
});
