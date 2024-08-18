import {
	Attribute, CallArguments, Comment, FunctionReference, Identifier, Message, MessageReference, NumberLiteral, Pattern, Placeable,
	Resource, NamedArgument, SelectExpression, serialize, StringLiteral, TermReference, TextElement, VariableReference, Variant, parse
} from "@fluent/syntax";
import { checkForNonPlurals, countSelectExpressions, extractReferences, defaults } from "./common.js";

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

function guessReferenceType(JSONPlaceable, baseFTLMsg) {
	const { variables, terms, msgRefs } = extractReferences(baseFTLMsg)

	if (variables.has(JSONPlaceable)) {
		return new VariableReference(new Identifier(JSONPlaceable));
	} else if (terms.has(JSONPlaceable)) {
		return new TermReference(new Identifier(JSONPlaceable));
	} else if (msgRefs.has(JSONPlaceable)) {
		return new MessageReference(new Identifier(JSONPlaceable));
	} else {
		throw new Error(`Could not determine type of "${JSONPlaceable}" in message named "${baseFTLMsg.id.name}"`);
	}
}

function parseString(string, baseFTLMsg, opts = {}) {
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
					const textNoBrackets = text.slice(1, -1).trim();

					return new Variant(
					typeof selector === 'number' ? new NumberLiteral(selector) : new Identifier(selector),
						textNoBrackets.length ? new Pattern(parseString(textNoBrackets, baseFTLMsg, opts)) : new Pattern([new Placeable(new StringLiteral(''))])
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
						positional.map(id => guessReferenceType(id, baseFTLMsg)),
						named.map(([name, value]) => new NamedArgument(new Identifier(name), new StringLiteral(value)))
					)
				);
			} else {
				ftlSelector = guessReferenceType(selector, baseFTLMsg);
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
							positional.map(id => guessReferenceType(id, baseFTLMsg)),
							named.map(([name, value]) => new NamedArgument(new Identifier(name), value == parseInt(value) ? new NumberLiteral(value) : new StringLiteral(value)))
						)
					)
				)
			);
		} else {
			const varName = bracketedContent.trim().slice(1, -1).trim();
			elements.push(new Placeable(guessReferenceType(varName, baseFTLMsg)));
		}
	}

	if (start < string.length) {
		elements.push(new TextElement(string.slice(start).replaceAll(/'?({|})'?/g, '{"$1"}')));
	}

	return elements;
}

export function JSONToFtl(json, baseFTL, opts = {}) {
	if (!baseFTL || typeof(baseFTL) !== 'string') {
		throw new Error('As of 0.11.0 Second argument to JSONToFTL must be string containing base FTL file.');
	}
	baseFTL = parse(baseFTL);

	const ftl = new Resource([]);
	opts = { ...defaults, ...opts };
	for (const key in json) {
		const attr = key.match(/\.([^.]+)$/)?.[1];
		const msgName = attr ? key.slice(0, -attr.length - 1) : key;
		const msgID = new Identifier(msgName);
		const attrID = attr && new Identifier(attr);
		const isTermDefinition = msgName.startsWith('-');
		const baseFTLMsg = baseFTL.body.find((entry) => entry?.id?.name === msgName || (isTermDefinition && entry?.id?.name === msgName.slice(1)));
		
		if (!baseFTLMsg) {
			console.warn(`The following message was found in JSON but not in the base FTL and will be skipped: "${key}"`);
			continue
		}

		// JSON only represents part of the message, either root or an attribute. We need to extract the corresponding part from the base FTL message.
		const baseFTLRootOrAttr = attr ? baseFTLMsg.attributes.find(n => n.id.name === attr) : baseFTLMsg;

		if (!baseFTLRootOrAttr) {
			console.warn(`The following message and attribute were found in JSON but not in the base FTL and will be skipped: "${key}"`);
			continue
		}

		const elements = parseString(json[key]?.string.trim(), baseFTLMsg, opts);
		const pattern = new Pattern(elements);

		if (countSelectExpressions(pattern) !== countSelectExpressions(baseFTLRootOrAttr)) {
			throw new Error(`Different number of select/plural expressions in "${key}" message.`);
		}

		const patternRefs = extractReferences(pattern);
		const baseRefs = extractReferences(baseFTLRootOrAttr.value);

		const lookup = { variables: 'variable', terms: 'term', msgRefs: 'message reference', fnRefs: 'function reference'};
		Object.entries(lookup).forEach(([refType, descriptive]) => {
			baseRefs[refType].forEach(ref => {
				if (!patternRefs[refType].has(ref)) {
					throw new Error(`Missing ${descriptive} "${ref}" not found in processed JSON for "${key}" message.`);
				}
			});
		});

		const parsedFTLRefCount = Object.values(patternRefs).reduce((totalSize, set) => totalSize += set.size, 0);
		const baseFTLRefCount = Object.values(baseRefs).reduce((totalSize, set) => totalSize += set.size, 0);

		if (parsedFTLRefCount !== baseFTLRefCount) {
			throw new Error(`Different number of references in "${key}" message.`);
		}

		const comment = json[key]?.developer_comment ? new Comment(`tx: ${json[key].developer_comment}`) : null;
		if(attr) {
			ftl.body.find(m => m.id.name === msgName)?.attributes.push(new Attribute(attrID, pattern)) || ftl.body.push(new Message(msgID, null, [new Attribute(attrID, pattern)], comment));
		} else {
			ftl.body.push(new Message(msgID, pattern, [], comment));
		}
	}

	return serialize(ftl);
}