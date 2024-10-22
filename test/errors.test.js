/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. 
//        Changing indentation WILL BREAK the tests.

import { assert } from 'chai';
import { JSONToFtl } from '../src/json-to-ftl.js';
import { ftlToJSON } from '../src/ftl-to-json.js';
import sinon from 'sinon';


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

    it('should print a warning when JSON contains a message not present in base FTL', () => {
        let stub = sinon.stub(console, 'warn');
        stub.returns();
        assert.doesNotThrow(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a { foo } in string' } }, 'string-with-foo = This is a { $foo } in string')
        }, );
        assert(stub.calledWith('The following message was found in JSON but not in the base FTL and will be skipped: "string-with-var"'));
        stub.restore();
    });

    it('should print a warning when JSON contains a message and attribute not present in base FTL', () => {
        let stub = sinon.stub(console, 'warn');
        stub.returns();
        assert.doesNotThrow(() => {
            JSONToFtl({ 'string-with-var.label': { string: 'This is a { foo } in string' } }, 'string-with-var = This is a { $foo } in string')
        });
        assert(stub.calledWith('The following message and attribute were found in JSON but not in the base FTL and will be skipped: "string-with-var.label"'));
        stub.restore();
    });

    it('should error when using pre 0.11.0 syntax, with no base FTL', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a { $var } in string' } })
        }, 'As of 0.11.0 Second argument to JSONToFTL must be string containing base FTL file.');
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

    it('should error if FTL contains a var and term of the same name', () => {
        assert.throws(() => {
            ftlToJSON(
`string-with-var-and-term = This is a { $foo } which is a var. This is a { -foo } which is a term.`
            )
        }
        , 'Duplicate reference found! Names must be unique between different reference types in the "string-with-var-and-term" message.');
    });

    it('should error if JSON has different number of select/plural expressions than base FTL', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-plurals': { string: 'num, plural, one { num } file other { num } files' } },
`string-with-plurals = 
    { $num ->
        [one] { $num } file
       *[other] { $num } files
    }`
            )
        }, 'Different number of select/plural expressions in "string-with-plurals" message.');

        assert.throws(() => {
            JSONToFtl({ 'string-with-many-plurals': { string: '{num, plural, one { num } file other { num } files} and { count }' } },
`string-with-many-plurals =
    { $num ->
        [one] { $num } file
       *[other] { $num } files
    } and { $count ->
        [one] just one
        *[other] many
    }`
            )
        }, 'Different number of select/plural expressions in "string-with-many-plurals" message.');

        assert.throws(() => {
            JSONToFtl(
                { 'string-with-no-plurals': { string: '{num, plural, one {{ num } file} other {{ num } files}}' } },
                `string-with-no-plurals = { $num }, plural, one { $num } file other { $num } files`
            )
        }, 'Different number of select/plural expressions in "string-with-no-plurals" message.');

        // different number of variants is OK
        assert.doesNotThrow(() => {
            JSONToFtl(
                { 'string-with-plurals': { string: '{num, plural, one {one file} two { two files} other {{ num } files}}' } },
`string-with-plurals =
    { $num ->
        [one] { $num } file
       *[other] { $num } files
    }`
            )
        });
    });

    it('should error if JSON is missing references from base FTL', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a { foo } in string' } }, 'string-with-var = This is a { $foo } and a { $bar } in string')
        }, 'Missing variable "bar" not found in processed JSON for "string-with-var" message');

        assert.throws(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a foo in string' } }, 'string-with-var = This is a { $foo } in string')
        }, 'Missing variable "foo" not found in processed JSON for "string-with-var" message.');

        assert.throws(() => {
            JSONToFtl({ 'string-with-term': { string: 'This is a { foo } in string' } }, 'string-with-term = This is a { -foo } and a { -bar } in string')
        }, 'Missing term "bar" not found in processed JSON for "string-with-term" message.');

        assert.throws(() => {
            JSONToFtl({ ref: { string: 'foobar' }, 'string-with-msg-ref.label': { string: 'ref' } },
`ref = foobar
string-with-msg-ref =
    .label = { ref }`
            )
        }, 'Missing message reference "ref" not found in processed JSON for "string-with-msg-ref.label" message.');

        assert.throws(() => {
            JSONToFtl({ 'return-or-enter': { string: '{FOOBAR(), select, macos {Return} other {Enter}}' } },
`return-or-enter =
    { PLATFORM() ->
        [macos] Return
        *[other] Enter
    }`
            )
        }, 'Missing function reference "PLATFORM" not found in processed JSON for "return-or-enter" message');
    });

    it('should error if JSON contains a function reference not present in base FTL', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-fn': { string: 'This is a { UNKNOWN() } in string' } }, 'string-with-fn = This is a string')
        }, 'Could not determine type of "UNKNOWN" in message named "string-with-fn"');
    });

    it('should error if JSON contains a different number of references than the base FTL', () => {
        assert.throws(() => {
            JSONToFtl({ 'string-with-var': { string: 'This is a { foo } and a { NUMBER() } in string' } }, 'string-with-var = This is a { $foo } in string')
        }, 'Different number of references in "string-with-var" message.');
    });
});