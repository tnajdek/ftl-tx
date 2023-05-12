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
        assert.throws(() => {
            JSONToFtl({ 'string-with-plurals': { string: 'I have { num, plural, one {{ num } file} scores {{ num } files} }.' } })
        }, 'Invalid plural variant: scores');
    });

    it('should error if trying to convert from JSON where terms are not included and not provided', () => {
        assert.throws(() => {
            JSONToFtl(
                { 'string-with-terms': { string: 'This message has a reference to { -my-ref }. It also has a { var }.' } },
                { storeTermsInJSON: false, transformTerms: false }
            )
        }, 'Found 1 term(s) in JSON, but no terms were provided in the options');

        assert.throws(() => {
            JSONToFtl(
                { 'string-with-terms': { string: 'This message has a reference to { -my-ref }. It also has a { var }.' } },
                { storeTermsInJSON: false, terms: [], transformTerms: false }
            )
        }, 'Found 1 term(s) in JSON, but no terms were provided in the options');
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
});