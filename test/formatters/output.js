var expect = require('chai').use(require('sinon-chai')).expect;
var formatter = require('../../lib/formatters/output');

describe('Output formatter', function () {
  var document;

  describe('given no document', function () {
    it('should return nothing', function () {
      expect(formatter(document)).to.eql({});
    });
  });

  describe('given empty document', function () {
    beforeEach(function () {
      document = {};
    });

    it('should return nothing', function () {
      expect(formatter(document)).to.eql({});
    });
  });

  describe('given mixed document', function () {
    beforeEach(function () {
      document = {
        foo: 'bar',
        bar: ['foo']
      };
    });

    it('should return flatten document', function () {
      expect(formatter(document)).to.eql({
        foo: 'bar',
        bar: 'foo'
      });
    });
  });

  describe('given document info', function () {
    beforeEach(function () {
      document = {
        info: {
          some: 'info'
        },
        foo: 'bar',
        bar: ['foo']
      };
    });

    it('should filter document info', function () {
      expect(formatter(document)).to.eql({
        foo: 'bar',
        bar: 'foo'
      });
    });
  });
});