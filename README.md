[![CI](https://github.com/tnajdek/ftl-tx/actions/workflows/ci.yml/badge.svg)](https://github.com/tnajdek/ftl-tx/actions/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/github/tnajdek/ftl-tx/badge.svg?branch=master)](https://coveralls.io/github/tnajdek/ftl-tx?branch=master) [![npm version](https://img.shields.io/npm/v/ftl-tx)](https://www.npmjs.com/package/ftl-tx)
# ftl-tx

Simple library that converts [.ftl](https://projectfluent.org/) to/from structured JSON with ICU Messages that [Transifex](https://www.transifex.com/) can understand.

It has many limitations (see below).

## Usage

````js
import { ftlToJSON, JSONToFtl } from 'ftl-tx';
const ftl = `message = Hello, { $user }!`;
console.assert(JSONToFtl(ftlToJSON(ftl)).trim() === ftl);
console.log(ftlToJSON(ftl));
````

## Limitations
A limited set of features is supported, specifically:

* attributes are translated into new messages, with the attribute name concatenated with the message key to create a new message key
* fluent [functions](https://projectfluent.org/fluent/guide/functions.html)  (including [built-in functions](https://projectfluent.org/fluent/guide/builtins.html)) are not supported
* [message referencing](https://projectfluent.org/fluent/guide/references.html) is not supported
* [terms](https://projectfluent.org/fluent/guide/terms.html) are converted to variables, prefixed with `FTLREF_` and with "-" replaced as "_"
* All comments are ignored, except for [message-bound comments](https://projectfluent.org/fluent/guide/comments.html) prefixed `tx: `
* Message nesting level is limited to 10 levels (using a variable/reference inside a variant value "costs" 0.5 level). This value is configurable and can be increased at a slight performance cost

## Configuration 

* `termPrefix`, prefix used for term references, defaults to `FTLREF_`
* `commentPrefix`, prefix used for comments, defaults to `tx:`
* `nestLimit`, maximum message nesting level, defaults to 10

## Examples

See `tests/translate.test.js` for examples.