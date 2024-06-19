/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. 
//        Changing indentation WILL BREAK the tests.

import { assert } from 'chai';
import { JSONToFtl } from '../src/json-to-ftl.js';
import { ftlToJSON } from '../src/ftl-to-json.js';


describe('Recoverable', () => {
    it('should handle various spacing around variables in JSON', () => {
        const expected = `string-with-var = This is a { $var } in string`;
        assert.equal(
            JSONToFtl({ 'string-with-var': { string: 'This is a {$var} in string' } }).trim(),
            expected
        );
        assert.equal(
            JSONToFtl({ 'string-with-var': { string: 'This is a {     $var} in string' } }).trim(),
            expected
        );
        assert.equal(
            JSONToFtl({ 'string-with-var': { string: 'This is a {     $var     } in string' } }).trim(),
            expected
        );
        assert.equal(
            JSONToFtl({ 'string-with-var': { string: 'This is a {$var     } in string' } }).trim(),
            expected
        );
    });
    it('should handle various spacing around plurals', () => {
        const expected = 
`string-with-plurals =
    I have { $num ->
        [one] { $num } file
       *[other] { $num } files
    }.`;
        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 'I have { $num, plural, one {{ $num } file} other {{ $num } files}}.' }}).trim(),
            expected
        );

        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 'I have {     $num,    plural   ,    one {{$num} file} other {{    $num    } files}}.' } }).trim(),
            expected
        );
        
        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 
`I have { $num, plural,
    one {{ $num } file}
    other {{ $num } files}
}.` } }).trim(),
            expected
        );
    });

    it('should mark "other" variant as default if present, otherwise fallback to the last item on the list', () => {
        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 'I have { $num, plural, other {{ $num } files} one {{ $num } file} }.' } }).trim(),
`string-with-plurals =
    I have { $num ->
       *[other] { $num } files
        [one] { $num } file
    }.`);

        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 'I have { $num, plural, =1 {{ $num } file} =0 {{ $num } files} }.' } }).trim(),
`string-with-plurals =
    I have { $num ->
       *[0] { $num } files
        [1] { $num } file
    }.`);
    });

    it('should convert a message with a string literal', () => {
        assert.deepEqual(
            ftlToJSON(`string-with-escaped = This message features {"a string"} literal`),
            { 'string-with-escaped': { string: 'This message features a string literal' } }
        );
    });

    it('should convert a message with a number literal', () => {
        assert.deepEqual(
            ftlToJSON(`string-with-escaped = This message features: { 42 }, a number literal`),
            { 'string-with-escaped': { string: 'This message features: 42, a number literal' } }
        );
    });

    it('should handle a message with a MessageReference', () => {
        assert.deepEqual(
            ftlToJSON(`string-with-msg-ref = This message has a { ref }.`),
            { 'string-with-msg-ref': { string: 'This message has a { ref }.' } }
        );
    });

    it('should preserve new lines', () => {
        assert.deepEqual(
            ftlToJSON(
`foo = This is a first line.
       This is still part of the first line?

       This is a second line.`,
            ),
            { 'foo': { string: "This is a first line.\nThis is still part of the first line?\n\nThis is a second line." } }
        );
    });

    it('should skip message-reference only messages, based on config', () => {
        assert.deepEqual(
            ftlToJSON(
`bar = lorem ipsum
foo = { bar }`
        ),
            { bar: { string: "lorem ipsum"}, foo: { string: "{ bar }"}  }
        );

        assert.deepEqual(
            ftlToJSON(
`bar = lorem ipsum
foo = { bar }`, { skipRefOnly: true }
            ),
            { bar: { string: "lorem ipsum" } }
        );

        assert.deepEqual(
            ftlToJSON(
`bar = lorem ipsum
foo =
    .label = { bar }`
            ),
            { bar: { string: "lorem ipsum" }, 'foo.label': { string: "{ bar }" } }
        );

        assert.deepEqual(
            ftlToJSON(
                `bar = lorem ipsum
foo =
    .label = { bar }`, { skipRefOnly: true }
            ),
            { bar: { string: "lorem ipsum" } }
        );
    });

    it('should skip var/term only messages, based on config', () => {
        // variable only, skipRefOnly = false
        assert.deepEqual(
            ftlToJSON(`
foo =
    .aria-label = Lorem
    .label = { $bar }
`,
            ),
            { "foo.aria-label": { string: "Lorem" }, "foo.label": { string: "{ $bar }" } }
        );
        // variable only, skipRefOnly = true
        assert.deepEqual(
            ftlToJSON(`
foo =
    .aria-label = Lorem
    .label = { $bar }
`,
                { skipRefOnly: true }
            ),
            { "foo.aria-label": { string: "Lorem" } }
        );

        // term only, skipRefOnly = false
        assert.deepEqual(
            ftlToJSON(`
foo =
    .aria-label = Lorem
    .label = { -bar }
`,
            ),
            { "foo.aria-label": { string: "Lorem" }, "foo.label": { string: "{ -bar }" } }
        );
        // term only, skipRefOnly = true
        assert.deepEqual(
            ftlToJSON(`
foo =
    .aria-label = Lorem
    .label = { -bar }
`,
                { skipRefOnly: true }
            ),
            { "foo.aria-label": { string: "Lorem" } }
        );
    });

    it('should skip terms, based on config', () => {
        assert.deepEqual(
            ftlToJSON(
                `-bar = lorem ipsum
foo = { -bar }`, { skipTerms: false }
            ),
            { '-bar': { string: 'lorem ipsum' }, foo: { string: "{ -bar }" } }
        );

        assert.deepEqual(
            ftlToJSON(
`-bar = lorem ipsum
foo = { -bar }`, { skipTerms: true }
            ),
            { foo: { string: "{ -bar }" } }
        );
    });

    it('should discard junk', () => {
        assert.deepEqual(
            ftlToJSON(
`junk
foo = lorem ipsum`),
        { foo: { string: 'lorem ipsum' } }
    )});
});