export function checkForNonPlurals(ftlVariants) {
    const allowedPlurals = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const notLikePlural = ftlVariants.find(v => v.key.type !== 'NumberLiteral' && !allowedPlurals.includes(v.key.name));
    return notLikePlural;
}

export function extractReferences(element, variables, terms, msgRefs) {
    if (typeof variables === 'undefined') {
        variables = new Set();
    }
    if (typeof terms === 'undefined') {
        terms = new Set();
    }

    if (typeof msgRefs === 'undefined') {
        msgRefs = new Set();
    }

    switch (element.type) {
        case 'Message':
            (element.value?.elements ?? []).forEach(e => extractReferences(e, variables, terms, msgRefs));
            element.attributes.forEach(a => extractReferences(a.value, variables, terms, msgRefs));
            break;
        case 'SelectExpression':
            extractReferences(element.selector, variables, terms, msgRefs);
            element.variants.forEach(v => extractReferences(v, variables, terms, msgRefs));
            break;
        case 'Variant':
            extractReferences(element.key, variables, terms, msgRefs);
            extractReferences(element.value, variables, terms, msgRefs);
            break;
        case 'Placeable':
            extractReferences(element.expression, variables, terms, msgRefs);
            break;
        case 'Pattern':
            element.elements.forEach(e => extractReferences(e, variables, terms, msgRefs));
            break;
        case 'FunctionReference':
            element.arguments.positional.forEach(e => extractReferences(e, variables, terms, msgRefs));
            element.arguments.named.forEach(e => extractReferences(e.value, variables, terms, msgRefs));
            break;
        case 'VariableReference':
            variables.add(element.id.name);
            break;
        case 'TermReference':
            terms.add(element.id.name);
            break;
        case 'MessageReference':
            msgRefs.add(element.attribute ? `${element.id.name}.${element.attribute.name}` : element.id.name);
            break;
    }

    return { variables, terms, msgRefs };
}

export const defaults = {
    commentPrefix: 'tx:',
    nestLimit: 10,
    skipRefOnly: false,
    skipTerms: false,
}
