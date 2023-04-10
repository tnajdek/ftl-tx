export function checkForNonPlurals(ftlVariants) {
    const allowedPlurals = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const notLikePlural = ftlVariants.find(v => v.key.type !== 'NumberLiteral' && !allowedPlurals.includes(v.key.name));
    return notLikePlural;
}

export const defaults = {
    commentPrefix: 'tx:',
    nestLimit: 10,
    storeTermsInJSON: true,
    termPrefix: 'FTLREF_',
    terms: null,
    transformTerms: true,
}
