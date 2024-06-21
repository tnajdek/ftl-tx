export function checkForNonPlurals(ftlVariants) {
    const allowedPlurals = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const notLikePlural = ftlVariants.find(v => v.key.type !== 'NumberLiteral' && !allowedPlurals.includes(v.key.name));
    return notLikePlural;
}

function walkFTLTree(node, fn, ...args) {
    fn(node, ...args);

    switch (node.type) {
        case 'Message':
            (node.value?.elements ?? []).forEach(e => walkFTLTree(e, fn, args));
            node.attributes.forEach(a => walkFTLTree(a.value, fn, args));
            break;
        case 'SelectExpression':
            walkFTLTree(node.selector, fn, args);
            node.variants.forEach(v => walkFTLTree(v, fn, args));
            break;
        case 'Variant':
            walkFTLTree(node.key, fn, args);
            walkFTLTree(node.value, fn, args);
            break;
        case 'Placeable':
            walkFTLTree(node.expression, fn, args);
            break;
        case 'Pattern':
            node.elements.forEach(e => walkFTLTree(e, fn, args));
            break;
        case 'FunctionReference':
            node.arguments.positional.forEach(e => walkFTLTree(e, fn, args));
            node.arguments.named.forEach(e => walkFTLTree(e.value, fn, args));
            break;
    }
}

export function extractReferences(rootNode, variables, terms, msgRefs) {
    if (typeof variables === 'undefined') {
        variables = new Set();
    }
    if (typeof terms === 'undefined') {
        terms = new Set();
    }

    if (typeof msgRefs === 'undefined') {
        msgRefs = new Set();
    }

    walkFTLTree(rootNode, node => {
        switch (node.type) {
            case 'VariableReference':
                variables.add(node.id.name);
                break;
            case 'TermReference':
                terms.add(node.id.name);
                break;
            case 'MessageReference':
                msgRefs.add(node.attribute ? `${node.id.name}.${node.attribute.name}` : node.id.name);
                break;
        }
    });    

    return { variables, terms, msgRefs };
}

export function countSelectExpressions(rootNode) {
    let count = 0;
    walkFTLTree(rootNode, node => {
        if (node.type === 'SelectExpression') {
            count++;
        }
    });

    return count;
}

export const defaults = {
    commentPrefix: 'tx:',
    nestLimit: 10,
    skipRefOnly: false,
    skipTerms: false,
}
