/* eslint-env mocha */
// @NOTE: This file uses spaces for indentation, not tabs.
//        This is because FTL requires spaces for indentation
//        and this file contains ftl strings. 
//        Changing indentation WILL BREAK the tests.

import { assert } from 'chai';
import { ftlToJSON } from '../src/ftl-to-json.js';
import { JSONToFtl } from '../src/json-to-ftl.js';

function convert(ftl, json) {
    assert.deepEqual(ftlToJSON(ftl), json, 'FTL -> JSON');
    assert.equal(JSONToFtl(json).trim(), ftl.trim(), 'JSON -> FTL');
}

describe('Translate', () => {
    it('should convert a simple message', () => {
        convert(
            `simple-string = This is a simple string`,
            { 'simple-string': { string: 'This is a simple string' } }
        );
    });
    it('should convert a message with attributes into multiple messages', () => {
        convert(
`message-with-attrs =
    .label = This is a label
    .aria-label = This is an aria label
    .accesskey = L`,
            {
                'message-with-attrs.label': { string: 'This is a label' },
                'message-with-attrs.aria-label': { string: 'This is an aria label' },
                'message-with-attrs.accesskey': { string: 'L' }
            }
        );
    });
    it('should convert a message with a variable', () => {
        convert(
            `string-with-var = This is a { $var } in string`,
            { 'string-with-var': { string: 'This is a { var } in string' } }
        );
    });

    it('should convert a message with references', () => {
        convert(
`-bar = 42
-my-foo-ref = foo
string-with-ref = This is { -my-foo-ref } in a string. The answer is { -bar }`,
            {
                'string-with-ref': {
                    string: 'This is { FTLREF_my_foo_ref } in a string. The answer is { FTLREF_bar }',
                    terms: {
                        'bar': '42',
                        'my-foo-ref': 'foo'
                    }
                }
            }
        );
    });

    it('should convert a message with references in attributes and include a comment', () => {
        convert(
`-bar = 42
-my-foo-ref = foo
# tx: This comment applies to attributes as well
string-with-ref = This is { -my-foo-ref }.
    .label = This is { -bar } in a string. It also has a variable { $var }.
    .title = This is { -my-foo-ref } in a string. Bar is { -bar }. It also has a variable { $var }.`,
            {
                'string-with-ref': {
                    string: 'This is { FTLREF_my_foo_ref }.',
                    developer_comment: 'This comment applies to attributes as well',
                    terms: {
                        'my-foo-ref': 'foo'
                    }
                },
                'string-with-ref.label': {
                    string: 'This is { FTLREF_bar } in a string. It also has a variable { var }.',
                    developer_comment: 'This comment applies to attributes as well',
                    terms: {
                        'bar': '42'
                    }
                },
                'string-with-ref.title': {
                    string: 'This is { FTLREF_my_foo_ref } in a string. Bar is { FTLREF_bar }. It also has a variable { var }.',
                    developer_comment: 'This comment applies to attributes as well',
                    terms: {
                        'bar': '42',
                        'my-foo-ref': 'foo'
                    }
                }
            }
        );
    });

    it('should convert a message with variables and references', () => {
        convert(
`-moo-boo = moo-boo
string-with-both = { $foo } is here, { $bar } is there is no { -moo-boo }`,
            { 'string-with-both': {
                string: '{ foo } is here, { bar } is there is no { FTLREF_moo_boo }',
                terms: {
                    'moo-boo': 'moo-boo'
                }
            } }
        );
    });

    it('should convert a message with plurals', () => {
        convert(
`-my-app = Doggo App
string-with-plurals =
    I have { $num ->
        [one] { $num } file
       *[other] { $num } files
    } on my { $drive } in { -my-app }.`,
            { 
                'string-with-plurals': {
                    string: 'I have {num, plural, one {{ num } file} other {{ num } files}} on my { drive } in { FTLREF_my_app }.',
                    terms: {
                        'my-app': 'Doggo App'
                    }
                }
            }
        );
    });
    it('should convert a message with plurals with number literals', () => {
        convert(
`string-with-plurals =
    { $num ->
        [0] sadly no dogs
        [1] a dog
        [2] a pair of doggos
       *[other] { $num } dogs
    }`,
            {
                'string-with-plurals': { string: '{num, plural, =0 {sadly no dogs} =1 {a dog} =2 {a pair of doggos} other {{ num } dogs}}' }
            }
        );
    });

    it('should convert a message with select', () => {
        convert(
`string-with-select =
    { $animal ->
        [dog] woof!
        [cow] moo
       *[other] meh
    }`,
            {
                'string-with-select': { string: '{animal, select, dog {woof!} cow {moo} other {meh}}' }
            }
        );
    });

    it('should convert a message with nested plurals and select, and a reference', () => {
        convert(
`-dog-name = Pixel
pets =
    I have { $pet ->
        [dog]
            { $num ->
                [0] no dogs
                [1] a dog named { -dog-name }
               *[other] many doggos
            }
       *[rat]
            { $num ->
                [0] no rats
                [1] a rat
               *[other] an infestation
            }
    }`,
            {
                'pets': {
                    string: 'I have {pet, select, dog {{num, plural, =0 {no dogs} =1 {a dog named { FTLREF_dog_name }} other {many doggos}}} rat {{num, plural, =0 {no rats} =1 {a rat} other {an infestation}}}}',
                    terms: {
                        'dog-name': 'Pixel'
                    }
                }
            }
        );
    });

    it('should include message-level comments, if prefixed with tx:', () => {
        convert(
`# tx: This comment is included
string-with-comment = This one has comment`,
            { 'string-with-comment': { string: 'This one has comment', developer_comment: 'This comment is included' } }
        );
    });

    it('should convert a message with escaped { and }', () => {
        convert(
            `opening-brace = This message features an opening curly brace: {"{"}.`,
            { 'opening-brace': { string: `This message features an opening curly brace: '{'.` } }
        );

        convert(
            `opening-brace = This message features two opening curly brace, first: {"{"}, second: {"{"}.`,
            { 'opening-brace': { string: `This message features two opening curly brace, first: '{', second: '{'.` } }
        );

        convert(
            `opening-brace = This message with a { $var } features an opening curly brace: {"{"}.`,
            { 'opening-brace': { string: `This message with a { var } features an opening curly brace: '{'.` } }
        );

        convert(
            `closing-brace = This message features a closing curly brace: {"}"}.`,
            { 'closing-brace': { string: `This message features a closing curly brace: '}'.` } }
        );
    });

    it('should convert a message with an empty variant value', () => {
        convert(
`empty-variant =
    This message has an empty variant value: { $var ->
        [empty] { "" }
       *[other] { $var }
    }`,
            { 'empty-variant': { string: `This message has an empty variant value: {var, select, empty {} other {{ var }}}` } }
        );
    });

    it('should convert a message with 4 levels of nesting + variable', () => {
        convert(
`-dog-name = Pixel
deeply-nested =
    I have { $num ->
        [0]
            no { $thing ->
                [pet]
                    { $pet ->
                        [dog] dogs :(
                       *[other] pets
                    }
               *[other] things
            }
        [1]
            { $thing ->
                [pet]
                    a pet. { $pet ->
                        [dog]
                            It's a dog. { $show_name ->
                                [true] His name is { -dog-name }!
                               *[false] { "" }
                            }
                       *[other] It's not a dog :(
                    }
               *[other] a thing. It's not a pet.
            }
       *[other]
            many { $thing ->
                [pet] pets
               *[other] things
            }
    }`,
            {
                'deeply-nested': {
                    string: "I have {num, plural, =0 {no {thing, select, pet {{pet, select, dog {dogs :(} other {pets}}} other {things}}} =1 {{thing, select, pet {a pet. {pet, select, dog {It's a dog. {show_name, select, true {His name is { FTLREF_dog_name }!} false {}}} other {It's not a dog :(}}} other {a thing. It's not a pet.}}} other {many {thing, select, pet {pets} other {things}}}}",
                    terms: {
                        'dog-name': 'Pixel'
                    }
                }
            }
        );
    });

});