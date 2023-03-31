/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. 
//        Changing indentation WILL BREAK the tests.

import { assert } from 'chai';
import { JSONToFtl } from '../src/json-to-ftl.js';


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
            JSONToFtl({ 'string-with-plurals': { string: 'I have { num, plural, one {{ num } file} other {{ num } files}}.' }}).trim(),
            expected
        );

        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 'I have {     num,    plural   ,    one {{num} file} other {{    num    } files}}.' } }).trim(),
            expected
        );
        
        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 
`I have { num, plural,
    one {{ num } file}
    other {{ num } files}
}.` } }).trim(),
            expected
        );
    });

    it('should mark "other" variant as default if present, otherwise fallback to the last item on the list', () => {
        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 'I have { num, plural, other {{ num } files} one {{ num } file} }.' } }).trim(),
`string-with-plurals =
    I have { $num ->
       *[other] { $num } files
        [one] { $num } file
    }.`);

        assert.equal(
            JSONToFtl({ 'string-with-plurals': { string: 'I have { num, plural, =1 {{ num } file} =0 {{ num } files} }.' } }).trim(),
`string-with-plurals =
    I have { $num ->
       *[0] { $num } files
        [1] { $num } file
    }.`);
    });
});