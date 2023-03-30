/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. Changing indentation
//        to tabs WILL BREAK the tests.
import { assert } from 'chai';
import { ftlToJSON } from '../src/ftl-to-json.js';
import { JSONToFtl } from '../src/json-to-ftl.js';

function convert(ftl, json) {
    // ftl = ftl.replace(/^(?:\t)+/gm, (tabs) => '    '.repeat(tabs.length));
    assert.deepEqual(ftlToJSON(ftl), json, 'FTL -> JSON');
    assert.equal(JSONToFtl(json).trim(), ftl.trim(), 'JSON -> FTL');
}

describe('Two-way conversions', () => {
    it('should convert a simple message', () => {
        assert.deepEqual(convert(
            `simple-string = This is a simple string`,
            { 'simple-string': { string: 'This is a simple string' } }
        ));
    });
    it('should convert a message with attributes into multiple messages', () => {
        assert.deepEqual(convert(
`message-with-attrs =
    .label = This is a label
    .aria-label = This is an aria label
    .accesskey = L`,
            {
                'message-with-attrs.label': { string: 'This is a label' },
                'message-with-attrs.aria-label': { string: 'This is an aria label' },
                'message-with-attrs.accesskey': { string: 'L' }
            }
        ));
    });
    it('should convert a message with a variable', () => {
        assert.deepEqual(convert(
            `string-with-var = This is a { $var } in string`,
            { 'string-with-var': { string: 'This is a { var } in string' } }
        ));
    });

    it('should convert a message with a reference', () => {
        assert.deepEqual(convert(
            `string-with-ref = This is { -my-foo-ref } in a string`,
            { 'string-with-ref': { string: 'This is { FTLREF_my_foo_ref } in a string' } }
        ));
    });

    it('should convert a message with variables and references', () => {
        assert.deepEqual(convert(
            `string-with-both = { $foo } is here, { $bar } is there is no { -moo-boo }`,
            { 'string-with-both': { string: '{ foo } is here, { bar } is there is no { FTLREF_moo_boo }' } }
        ));
    });

    it('should convert a message with plurals', () => {
        assert.deepEqual(convert(
`string-with-plurals =
    I have { $num ->
        [one] { $num } file
       *[other] { $num } files
    } on my { $drive } in { -my-app }.`,
            { 
                'string-with-plurals': { string: 'I have {num, plural, one {{ num } file} other {{ num } files}} on my { drive } in { FTLREF_my_app }.' }
            }
        ));
    });
    it('should include message-level comments, if prefixed with tx:', () => {
        assert.deepEqual(convert(
`# tx: This comment is included
string-with-comment = This one has comment`,
            { 'string-with-comment': { string: 'This one has comment', developer_comment: 'This comment is included' } }
        ));
    });
});