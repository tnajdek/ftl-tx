import {
	Attribute, CallArguments, Comment, FunctionReference, Identifier, Message, NumberLiteral, Pattern, Placeable, Resource,
	NamedArgument, SelectExpression, serialize, StringLiteral, Term, TermReference, TextElement, VariableReference, Variant
} from "@fluent/syntax";
import { checkForNonPlurals, defaults } from "./common.js";

function parseArgumentStrings(string) {
	if(string.trim().length === 0) {
		return { positional: [], named: [] };
	}
	const vars = string.split(',').map(v => v.trim());
	const positional = vars.filter(v => !v.includes(':')).map(v => v.trim());
	const named = vars
		.filter(v => v.includes(':'))
		.map(s => {
			let [k, v] = s.split(':');
			k = k.trim();
			v = v.trim();
			if (v.startsWith('"') && v.endsWith('"')) {
				v = v.slice(1, -1);
			}
			return [k, v];
		});
		
	return { positional, named };
}

function parseString(string, foundTerms = [], opts = {}) {
	const elements = [];
	const nestLimit = opts.nestLimit * 2; // each nesting level adds 2 brackets
	const pattern = new RegExp(`${'{(?:[^{}]|'.repeat(nestLimit)}{[^{}]*}${')*}'.repeat(nestLimit)}`, 'g');
	let start = 0;
	let match;
	
	while ((match = pattern.exec(string)) !== null) {
		const [bracketedContent,] = match;
		const selectorRegex = /^\{\s*(?<selector>\w+)(?<args>\((?:\$?\w+(?:,\s+)?)*(?:\w+:\s+(?:"\w*?"|\d+)(?:,\s+)?)*\))?\s*,\s*(?<type>plural|select)\s*,\s*(?<variants>(?:(?!^\{).)*)\}$/s;
		const functionRegex = /\{\s*(?<fn>\w+)(?<args>\((?:\$?\w+(?:,\s+)?)*(?:\w+:\s+(?:"\w*?"|\d+)(?:,\s+)?)*\))\s*\}/s;

		if (match.index > start) {
			elements.push(new TextElement(string.slice(start, match.index)));
		}
		start = pattern.lastIndex;

		if (selectorRegex.test(bracketedContent)) {
			const matches = bracketedContent.match(selectorRegex);
			const { selector, args, type: selectType, variants } = matches.groups;
			const isFunctionSelector = !!args;

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
			let ftlSelector;

			if(isFunctionSelector) {
				const { positional, named } = parseArgumentStrings(args.slice(1, -1));
				ftlSelector = new FunctionReference(
					new Identifier(selector),
					new CallArguments(
						positional.map(id => new VariableReference(new Identifier(id))),
						named.map(([name, value]) => new NamedArgument(new Identifier(name), new StringLiteral(value)))
					)
				);
			} else {
				ftlSelector = new VariableReference(new Identifier(selector));
			}

			elements.push(new Placeable(new SelectExpression(ftlSelector, ftlVariants)));
		} else if(functionRegex.test(bracketedContent)) {
			const { fn, args } = bracketedContent.match(functionRegex).groups;
			const { positional, named } = parseArgumentStrings(args.slice(1, -1));
			elements.push(
				new Placeable(
					new FunctionReference(
						new Identifier(fn),
						new CallArguments(
							positional.map(id => new VariableReference(new Identifier(id))),
							named.map(([name, value]) => new NamedArgument(new Identifier(name), value == parseInt(value) ? new NumberLiteral(value) : new StringLiteral(value)))
						)
					)
				)
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
		const providedTerms = Object.keys(opts.terms ?? {});
		foundTerms.forEach(term => {
			if (!providedTerms.includes(term)) {
				throw new Error(`Found term "${term}" in JSON, but it was not provided in the options`);
			}
		});
		Object.entries(opts.terms).forEach(([term, value]) => termsMap.set(term, value));
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