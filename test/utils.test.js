/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. 
//        Changing indentation WILL BREAK the tests.

import { assert } from 'chai';
import { extractTerms } from '../src/ftl-to-json.js';


describe('Utils', () => {
    it('should extract terms from FTL', () => {
        const ftl = 
`-my-term = Foo
-another-term-here = Bar
string-with-terms = There is { -my-term } and { -another-term-here }. It also has a { $var }.`;

        assert.deepEqual(
            extractTerms(ftl), 
            { 'my-term': 'Foo', 'another-term-here': 'Bar' 
        });
    });
});
