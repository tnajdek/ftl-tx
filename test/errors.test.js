/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. 
//        Changing indentation WILL BREAK the tests.

import { assert } from 'chai';
import { JSONToFtl } from '../src/json-to-ftl.js';
import { ftlToJSON } from '../src/ftl-to-json.js';


describe('Errors', () => {
    it('should error if invalid plural variant found', () => {
        const matchingFTL = `
string-with-plurals = I have { $num ->
    [one] { $num } file
    *[other] { $num } files
}.`;
        
        assert.throws(() => {
            JSONToFtl({ 'string-with-plurals': { string: 'I have { num, plural, one {{ num } file} scores {{ num } files} }.' } }, matchingFTL)
        }, 'Invalid plural variant: scores');
    });

    it('should error when using string literal as a selector', () => {
        assert.throws(() => {
            ftlToJSON(
`selector-literal =
    { "astring" ->
        [a] A
       *[b] B
    }`
            )
        }, 'Unsupported selector type: StringLiteral ("astring")');
    });
    
    it('should error when using number literal as a selector', () => {
        assert.throws(() => {
            ftlToJSON(
                `selector-literal =
    { 13 ->
        [a] A
       *[b] B
    }`
            )
        }, 'Unsupported selector type: NumberLiteral (13)');
    });

    it('should error when unknown variable is included in JSON', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a { unknown } in string' } }, 'string-with-var = This is a { $var } in string')
        }, 'Could not determine type of "unknown" in message named "string-with-var"');
    });

    it('should error when unknown term is included in JSON', () => {
        assert.throws(() => {
            JSONToFtl({ '-string-with-term': { string: 'This is a { unknown } in string' } }, '-string-with-term = This is a { -term } in string')
        }, 'Could not determine type of "unknown" in message named "string-with-term"');
    });

    it('should error when using pre 0.11.0 syntax, with no base FTL', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a { $var } in string' } })
        }, 'As of 0.11.0 Second argument to JSONToFTL must be string containing base FTL file.');
    });

    it('should error if JSON contains a message not present in base FTL', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a { foo } in string' } }, 'string-with-foo = This is a { $foo } in string')
        }, 'Message "string-with-var" not found in base FTL');
    });
});