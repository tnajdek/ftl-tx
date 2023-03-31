# ftl-tx translator

Simple library that converts [.ftl](https://projectfluent.org/) into structured JSON that [transifex](https://www.transifex.com/) can understand. It also translates JSON back to .ftl, presumable after it has been translated.

It has many limitations (see below)

# Usage

````js
import { ftlToJSON, JSONToFtl } from 'ftl-tx';
const ftl = `message = Hello, { $user }!`;
console.assert(JSONToFtl(ftlToJSON(ftl)).trim() === ftl);
console.log(ftlToJSON(ftl));
````

# Limitations
A limited set of features is supported, specifically:

* attributes are translated into new messages, with the attribute name concatenated with the message key to create a new message key.
* fluent [functions](https://projectfluent.org/fluent/guide/functions.html)  (including [built-in functions](https://projectfluent.org/fluent/guide/builtins.html) are not supported
* [message referencing](https://projectfluent.org/fluent/guide/references.html) is not supported
* [terms](https://projectfluent.org/fluent/guide/terms.html) are converted to variables, prefixed with `FTLREF_` and with "-" replaced as "_"
* All comments are ignored, except for [message-bound comments](https://projectfluent.org/fluent/guide/comments.html) prefixed `tx: `

# Examples

See `tests/translate.test.js` for examples.