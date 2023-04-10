import { Attribute, Comment, Identifier, Message, NumberLiteral, Pattern, Placeable, Resource,
	SelectExpression, serialize, StringLiteral, Term, TermReference, TextElement, VariableReference, Variant
} from "@fluent/syntax";
import { checkForNonPlurals, defaults } from "./common.js";


function parseString(string, foundTerms = [], opts = {}) {
	const elements = [];
	const nestLimit = opts.nestLimit * 2; // each nesting level adds 2 brackets
	const pattern = new RegExp(`${'{(?:[^{}]|'.repeat(nestLimit)}{[^{}]*}${')*}'.repeat(nestLimit)}`, 'g');
	let start = 0;
	let match;
	
	while ((match = pattern.exec(string)) !== null) {
		const [bracketedContent,] = match;
		const pluralRegex = /^\{\s*(\w+)\s*,\s*(plural|select)\s*,\s*((?:(?!^\{).)*)\}$/s;

		if (match.index > start) {
			elements.push(new TextElement(string.slice(start, match.index)));
		}
		start = pattern.lastIndex;

		if (pluralRegex.test(bracketedContent)) {
			const [, variable, selectType, variants] = bracketedContent.match(pluralRegex);
			const variantRegex = new RegExp(`(\\w+)\\s+(${'{(?:[^{}]|'.repeat(nestLimit)}{[^{}]*}${')*}'.repeat(nestLimit)})`, 'gm');
			let match;
			let lastSelector = null;
			const matchedVariants = {};
			while ((match = variantRegex.exec(variants)) !== null) {
				let [, selector, text] = match;
				matchedVariants[selector] = text;
				lastSelector = selector;
			}
			const ftlVariants = Object.entries(matchedVariants).map(
				([selector, text]) => {
					if (selectType === 'plural' && selector == parseInt(selector, 10)) {
						selector = parseInt(selector, 10);
					}
					const textNoBrackets = text.slice(1, -1);

					return new Variant(
					typeof selector === 'number' ? new NumberLiteral(selector) : new Identifier(selector),
						textNoBrackets.length ? new Pattern(parseString(textNoBrackets, foundTerms, opts)) : new Pattern([new Placeable(new StringLiteral(''))])
				)}
			);

			if (selectType === 'plural') {
				const notLikePlural = checkForNonPlurals(ftlVariants);
				if (notLikePlural) {
					throw new Error(`Invalid plural variant: ${notLikePlural.key.name} in ${string}`);
				}
			}

			const defaultVariant = ftlVariants.find(v => v.key.name === 'other') ?? ftlVariants.find(v => v.key.name === lastSelector) ?? ftlVariants[0];
			defaultVariant.default = true;

			elements.push(new Placeable(
				new SelectExpression(
					new VariableReference(new Identifier(variable)),
					ftlVariants
				))
			);
		} else {
			const varName = bracketedContent.trim().slice(1, -1).trim();

			if (varName.startsWith(opts.termPrefix) || (!opts.transformTerms && varName.startsWith('-'))) {
				const id = opts.transformTerms ?
					varName.slice(opts.termPrefix.length).replaceAll('_', '-') :
					varName.slice(1);
				elements.push(new Placeable(new TermReference(new Identifier(id))));
				foundTerms.add(id);
			} else {
				const id = new Identifier(varName.startsWith('$') ? varName.slice(1) : varName);
				elements.push(new Placeable(new VariableReference(id)));
			}
		}	
		
	}

	if (start < string.length) {
		elements.push(new TextElement(string.slice(start).replaceAll(/'?({|})'?/g, '{"$1"}')));
	}

	return elements;
}

export function JSONToFtl(json, opts = {}) {
	const ftl = new Resource([]);
	const termsMap = new Map();
	const foundTerms = new Set();
	opts = { ...defaults, ...opts };
	for (const key in json) {
		const attr = key.match(/\.([^.]+)$/)?.[1];
		const msgName = attr ? key.slice(0, -attr.length - 1) : key;
		const msgID = new Identifier(msgName);
		const attrID = attr && new Identifier(attr);
		const elements = parseString(json[key]?.string, foundTerms, opts);
		const pattern = new Pattern(elements);
		const comment = json[key]?.developer_comment ? new Comment(`tx: ${json[key].developer_comment}`) : null;
		const JSONTerms = json[key]?.terms;
		if (opts.storeTermsInJSON && JSONTerms) {
			Object.entries(JSONTerms).map(([term, value]) => termsMap.set(term, value));
		}
		if(attr) {
			ftl.body.find(m => m.id.name === msgName)?.attributes.push(new Attribute(attrID, pattern)) || ftl.body.push(new Message(msgID, null, [new Attribute(attrID, pattern)], comment));
		} else {
			ftl.body.push(new Message(msgID, pattern, [], comment));
		}
	}

	if (!opts.storeTermsInJSON) {
		if (foundTerms.size && opts.terms && Object.keys(opts.terms).length && foundTerms.size === Object.keys(opts.terms).length) {
			Object.entries(opts.terms)
				.forEach(([term, value]) => termsMap.set(term, value));
		} else if (!opts.terms || foundTerms.size !== Object.keys(opts.terms).length) {
			throw new Error(`Found ${foundTerms.size} term(s) in JSON, but ${((opts.terms && Object.keys(opts.terms).length)) || 'no'} terms were provided in the options`);
		}
	}

	const termKeys = [...termsMap.keys()];
	termKeys.sort().reverse(); // since we're unshifting at the begining of the .ftl we need to start from the end, hence reverse()
	for (const term of termKeys) {
		const termID = new Identifier(term);
		const termElements = parseString(termsMap.get(term), [], opts);
		const termPattern = new Pattern(termElements);
		ftl.body.unshift(new Term(termID, termPattern))
	}

	return serialize(ftl);
}