import { parse } from "@fluent/syntax";
import { checkForNonPlurals, extractReferences, defaults } from "./common.js";

function stringifyFunction(fnRef) {
	const needsSeparator = fnRef.arguments.positional.length && fnRef.arguments.named.length;
	return `${fnRef.id.name}(${fnRef.arguments.positional.map(pos => pos.id.name).join(', ')}${needsSeparator ? ', ' : ''}${fnRef.arguments.named.map(nm => nm.value.value == parseInt(nm.value.value) ? `${nm.name.name}: ${nm.value.value}` : `${nm.name.name}: "${nm.value.value}"`).join(', ')})`
}


function prefixPlaceable(placeable) {
	switch(placeable.type) {
		case 'VariableReference':
		case 'TermReference':
			return placeable.id.name;
		case 'FunctionReference':
			return stringifyFunction(placeable);
		default:
			return placeable.attribute ? `${placeable.id.name}.${placeable.attribute.name}` : placeable.id.name;
	}
}

function processElement(element, ftl, opts = {}) {
	if (element.type === 'Placeable' && element.expression.type === 'SelectExpression') {
		const ICUVariants = element.expression.variants.map(v => {
			switch (v.key.type) {
				case 'NumberLiteral':
					return `=${v.key.value} {${v.value.elements.map(e => processElement(e, ftl, opts)).join('')}}`;
				default:
				case 'Identifier':
					return `${ftl.slice(v.key.span.start, v.key.span.end)} {${v.value.elements.map(e => processElement(e, ftl, opts)).join('')}}`;
			}
		}).join(' ');

		if(!['FunctionReference', 'VariableReference'].includes(element.expression.selector.type)) {
			throw new Error(`Unsupported selector type: ${element.expression.selector.type} (${ftl.slice(element.expression.selector.span.start, element.expression.selector.span.end)})`);
		}

		const ICUSelector = prefixPlaceable(element.expression.selector);
		const selectType = checkForNonPlurals(element.expression.variants) ? 'select' : 'plural';
		return `{${ICUSelector}, ${selectType}, ${ICUVariants}}`;
	}
	if (element.type === 'Placeable' && ['VariableReference', 'TermReference', 'FunctionReference', 'MessageReference'].includes(element.expression.type)) {
		return `{ ${prefixPlaceable(element.expression)} }`;
	}
	if (element.type === 'Placeable' && element.expression.type === 'StringLiteral') {
		return element.expression.value.replaceAll(/({|})/g, `'$1'`);
	}
	if (element.type === 'Placeable' && element.expression.type === 'NumberLiteral') {
		return element.expression.value.replaceAll(/({|})/g, `$1`);
	}
	if (element.type === 'TextElement') {
		return element.value;
	}

	// console.warn(`Unknown element type: ${element.type}, ${element?.expression?.type}`);
	// return ftl.slice(element.span.start, element.span.end);
}

function checkForRefOnly(entry, ftl, opts) {
	if (!opts.skipRefOnly || entry.value.elements.length !== 1) {
		return false;
	}
	const ignoredTypes = ['MessageReference', 'VariableReference', 'TermReference'];
	const element = entry.value.elements[0];

	if (element.type === 'Placeable' && ignoredTypes.includes(element.expression.type)) {
		return true;
	}
	if (element.type === 'Placeable' && element.expression.type === 'SelectExpression') {
		return element.expression.variants.every(v => {
			return checkForRefOnly(v, ftl, opts);
		});
	}

	return false;
}

export function ftlToJSON(ftl, opts = {}) {
	const res = parse(ftl);
	const json = {};
	opts = { ...defaults, ...opts };
	const { commentPrefix } = opts;
	res.body.forEach((entry) => {
		if (!['Term', 'Message'].includes(entry.type)) {
			return;
		}
		if(opts.skipTerms && entry.type === 'Term') {
			return;
		}

		const { variables, terms, msgRefs } = extractReferences(entry);
		// Set.prototype.intersection requires Node 22
		const refsLength = variables.size + terms.size + msgRefs.size;
		const mergedLength = (new Set([...variables, ...terms, ...msgRefs])).size;

		if (refsLength !== mergedLength) {
			throw new Error(`Duplicate reference found! Names must be unique between different reference types in the "${entry.id.name}" message.`);
		}
		
		const key = entry.type === 'Term' ? `-${entry.id.name}` : entry.id.name;
		if (entry.value?.type === 'Pattern') {
			if (!checkForRefOnly(entry, ftl, opts)) {
				const string = entry.value.elements.map(e => processElement(e, ftl, opts)).join('');
				json[key] = {
					string,
					...(entry.comment?.content.startsWith(commentPrefix) ? { developer_comment: entry.comment.content.slice(3).trim() } : {})
				};
			}
		}
		if (entry.attributes.length) {
			entry.attributes.forEach((attr) => {
				if(!checkForRefOnly(attr, ftl, opts)) {
					const string = attr.value.elements.map(e => processElement(e, ftl, opts)).join('');
					json[`${key}.${attr.id.name}`] = { 
						string,
						...(entry.comment?.content.startsWith(commentPrefix) ? { developer_comment: entry.comment.content.slice(3).trim() } : {})
					};
				}
			});
		}
	});
	return json;
}