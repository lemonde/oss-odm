# oss-odm [![Build Status](https://travis-ci.org/lemonde/oss-odm.svg?branch=master)](https://travis-ci.org/lemonde/oss-odm)

Object document mapper for [Open Search Server](http://www.open-search-server.com/).

See also parent module [node-oss-client](https://github.com/lemonde/node-oss-client).


## Install

```
npm install oss-odm
```

## Usage

```js
var oss = require('node-oss-client');
var Index = require('oss-odm').Index;

var index = new Index({
  name: 'my_index',
  indexers: oss.createClient(),
  searcher: oss.createClient()
});

// Insert a new document in "my_index".
index.create({ title: 'My first document' }, function (err) { ... });

// Search in "my_index".
index.search('my query', function (err, res) {
  console.log(res.documents); // [{ title: 'My first document' }]
});
```

### new Index(options)

Create a new index with some options.

#### name

Type: `String`

Name of the index.

```js
new Index({ name: 'my_index' });
```

#### lang

Type: `String`

Default language of the index, defaults to "ENGLISH".

```js
new Index({
  lang: 'FRENCH'
});
```

#### indexers

Type: `Array` or `Object`

OSS clients used to index document.

```js
var indexer1 = oss.createClient({ host: 'indexer1' });
var indexer2 = oss.createClient({ host: 'indexer2' });
new Index({ indexers: [indexer1, indexer2] });
```

#### searcher

Type: `Object`

OSS client used to search.

```js
var searcher = oss.createClient({ host: 'searcher' });
new Index({ searcher: searcher });
```

#### templates

Type: `Object`

Search templates that can be used in `index.search`, the default template must be called "default".
All [search options known by OSS](https://github.com/jaeksoft/opensearchserver/wiki/Search-field) can be specified in the template.

```js
new Index({
  templates: {
    default: {
      returnedFields: [
        'id',
        'title'
      ],
      searchFields: [
          {
            field: 'text',
            mode: 'TERM_AND_PHRASE',
            boost: 1
          }
      ]
    },
    title: {
      returnedFields: [
        'id',
        'title'
      ],
      searchFields: [
          {
            field: 'title',
            mode: 'TERM_AND_PHRASE',
            boost: 1
          }
      ]
    }
  }
});
```

#### formatters

Type: `Object`

You can specify an input (indexing) and an output (search) formatters. These formatter are applied to each documents.

```js
new Index({
  formatters: {
    input: inputFormatter,
    output: outputFormatter
  }
});

function inputFormatter(document) {
  // Add a timestamp key.
  document.timestamp = Date.now();
  return document;
}

function outputFormatter(document) {
  // Convert id in Number.
  document.id = parseInt(document.id, 10);
  return document;
}
```

#### filters

Type: `Object`

Filters formatter that can be used in `index.search`.

```js
new Index({
  filters: {
    id: formatIdFilter
  }
});

function formatIdFilter(value, context) {
  return {
    type: 'QueryFilter',
    negative: false,
    query: 'id:' + value
  };
}
```

#### joins

Type: `Object`

Joins that can be used in `index.search`.

```js
new Index({
  joins: {
    myJoin: {
      index: customIndex,
      queryTemplate: 'customQueryTemplate',
      localField: 'local_id',
      foreignField: 'id',
      type: 'INNER',
      returnFields: false,
      returnScores: false,
      eturnFacets: false
    }
  }
});
```

### index.create(documents, [options], callback)

Insert a new document in the index.

Note : if an array is provided as value, it triggers a multi-valued field insertion.

```js
index.create([
  {
    title: 'My first document',
    foo: 'bar'
  },
  {
    title: 'My second document',
    ids: [23, 34]
  }
], function (err) { ... });
```

Some options are available:

#### lang

Type: `String`

The language of the document to index, default to the index language.

```js
index.create([
  { title: 'My first document' }
], { lang: 'FRENCH' }, function (err) { ... });
```

### index.destroy(values, [options], callback)

Destroy a documents in the index.

```js
index.destroy(['182', '85'], function (err) { ... });
```

Some options are available:

#### field

Type: `String`

The field used to match values, default to "id".

```js
index.destroy(['bob', 'tom'], { field: 'name' }, function (err) { ... });
```

### index.search(query, [options], callback)

Search in the index.

```js
index.search('my query', function (err, res) { ... });
```

Some options are available:

#### lang

Type: `String`

The language used for searching documents.

```js
index.search('my query', { lang: 'FRENCH' }, function (err, res) { ... });
```

#### template

Type: `String`

The template used to process the query, defaults to "default".

```js
index.search('my query', { template: 'custom' }, function (err, res) { ... });
```

#### filters

Type: `Object`

Filters applied to the query. Filters are transformed using filter formatters defined in the constructor.

```js
index.search('my query', {
  filters: {
    id: 10
  },
  filterOptions: {
    foo: 'bar'
  }
}, function (err, res) { ... });
```

#### joins

Type: `Object`

Joins applied to the query. Joins used the joins defined in the constructor.

```js
index.search('my query', {
  joins: {
    myJoin: {
      query: 'join query',
      template: 'myTemplate',
      filters: {
        myJoinFilter: 'test'
      }
    }
  }
})
```

#### OSS search options

All [search options known by OSS](https://github.com/jaeksoft/opensearchserver/wiki/Search-field) can be used in the search function.

### syncManager.sync(clients, schemas)

```js
var indexer1 = oss.createClient({ host: 'indexer1' });
var indexer2 = oss.createClient({ host: 'indexer2' });

syncManager.sync([indexer1, indexer2], [
  {
    name: 'articles',
    uniqueField: 'id',
    defaultField: 'text',
    fields: [
      {
        name: 'id',
        indexed: true,
        stored: true
      },
      {
        name: 'text',
        indexed: true,
        stored: true
      }
    ]
  }
]);
```

### syncManager.drop(clients, names)

```js
var indexer1 = oss.createClient({ host: 'indexer1' });
var indexer2 = oss.createClient({ host: 'indexer2' });

syncManager.drop([indexer1, indexer2], ['articles']);
```


## License

MIT
