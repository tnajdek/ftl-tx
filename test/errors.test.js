/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. 
//        Changing indentation WILL BREAK the tests.

import { assert } from 'chai';
import { JSONToFtl } from '../src/json-to-ftl.js';


describe('Errors', () => {
    it('should error if invalid plural variant found', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-plurals': { string: 'I have { num, plural, one {{ num } file} scores {{ num } files} }.' } }),
            'Invalid plural variant: scores'
        });
    });
});