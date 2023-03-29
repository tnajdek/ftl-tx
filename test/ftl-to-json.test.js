/* eslint-env mocha */
import { assert } from 'chai';
import { ftlToJSON } from '../src/ftl-to-json.js';

describe('FTL -> JSON', () => {
    it('should convert a simple message', () => {
        assert.deepEqual(
            ftlToJSON(`simple-string = This is a simple string`),
            { 'simple-string': { string: 'This is a simple string' } }
        );
    });
    it('should convert a message with attributes into multiple messages', () => {
        assert.deepEqual(
            ftlToJSON(`message-with-attrs = 
                .label = This is a label
                .aria-label = This is an aria label
                .accesskey = L
            `),
            {
                'message-with-attrs.label': { string: 'This is a label' },
                'message-with-attrs.aria-label': { string: 'This is an aria label' },
                'message-with-attrs.accesskey': { string: 'L' }
            }
        );
    });
    it('should convert a message with a variable', () => {
        assert.deepEqual(
            ftlToJSON(`string-with-var = This is a {$var} in string`),
            { 'string-with-var': { string: 'This is a {$var} in string' } }
        );
    });

    it('should convert a message with a reference', () => {
        assert.deepEqual(
            ftlToJSON(`string-with-ref = This is { -my-ref } in a string`),
            { 'string-with-ref': { string: 'This is { -my-ref } in a string' } }
        );
    });

    it('should convert a message with plurals', () => {
        assert.deepEqual(
            ftlToJSON(`string-with-plurals = I have { $num ->
                    [one] {$num} file
                    *[other] {$num} files
                }.`),
            { 'string-with-plurals': { string: 'I have {$num, plural, one {{$num} file} other {{$num} files}}.' } }
        );
    });
    it('should include message-level comments, if prefixed with tx:', () => {
        assert.deepEqual(
            ftlToJSON(
`# tx: This comment is included
string-with-comment = This one has comment`
            ),
            { 'string-with-comment': { string: 'This one has comment', developer_comment: 'This comment is included' } }
        );
    });
});