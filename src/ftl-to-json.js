import { parse } from "@fluent/syntax";
import { checkForNonPlurals, defaults } from "./common.js";


function prefixPlaceable(placeable, ftl) {
	switch(placeable.type) {
		case 'VariableReference':
			return `$${placeable.id.name}`;
		case 'TermReference':
			return `-${placeable.id.name}`;
		case 'FunctionReference':
			return ftl.slice(placeable.span.start, placeable.span.end);
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

		const ICUSelector = prefixPlaceable(element.expression.selector, ftl);
		const selectType = checkForNonPlurals(element.expression.variants) ? 'select' : 'plural';
		return `{${ICUSelector}, ${selectType}, ${ICUVariants}}`;
	}
	if (element.type === 'Placeable' && ['VariableReference', 'TermReference', 'FunctionReference', 'MessageReference'].includes(element.expression.type)) {
		return `{ ${prefixPlaceable(element.expression, ftl)} }`;
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
	const element = entry.value.elements[0];
	if (element.type === 'Placeable' && element.expression.type === 'MessageReference') {
		return true;
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