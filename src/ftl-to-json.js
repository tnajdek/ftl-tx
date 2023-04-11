import { parse } from "@fluent/syntax";
import { checkForNonPlurals, defaults } from "./common.js";

function processElement(element, ftl, usedTerms = [], opts = {}) {
	if (element.type === 'Placeable' && element.expression.type === 'SelectExpression') {
		const ICUVariants = element.expression.variants.map(v => {
			switch (v.key.type) {
				case 'NumberLiteral':
					return `=${v.key.value} {${v.value.elements.map(e => processElement(e, ftl, usedTerms, opts)).join('')}}`;
				default:
				case 'Identifier':
					return `${ftl.slice(v.key.span.start, v.key.span.end)} {${v.value.elements.map(e => processElement(e, ftl, usedTerms, opts)).join('')}}`;
			}
		}).join(' ');

		const selectType = checkForNonPlurals(element.expression.variants) ? 'select' : 'plural';
		return `{${element.expression.selector.id.name}, ${selectType}, ${ICUVariants}}`;
	}
	if (element.type === 'Placeable' && element.expression.type === 'VariableReference') {
		return `{ ${element.expression.id.name} }`;
	}
	if (element.type === 'Placeable' && element.expression.type === 'TermReference') {
		usedTerms.push(element.expression.id.name);
		return opts.transformTerms ?
			`{ ${opts.termPrefix}${element.expression.id.name.replaceAll('-', '_')} }` :
			`{ -${element.expression.id.name} }`;
	}
	if (element.type === 'Placeable' && element.expression.type === 'StringLiteral') {
		return element.expression.value.replaceAll(/({|})/g, `'$1'`);
	}

	return ftl.slice(element.span.start, element.span.end);
}

export function ftlToJSON(ftl, opts = {}) {
	const res = parse(ftl);
	const json = {};
	const terms = {};
	opts = { ...defaults, ...opts };
	const { commentPrefix, storeTermsInJSON } = opts;
	res.body.forEach((entry) => {
		if (entry?.type === 'Term') {
			terms[entry.id.name] = entry.value.elements.map(e => processElement(e, ftl, null, opts)).join('');
		} else if (entry?.type === 'Message') {
			if (entry.value?.type === 'Pattern') {
				const usedTerms = [];
				const string = entry.value.elements.map(e => processElement(e, ftl, usedTerms, opts)).join('');
				json[entry.id.name] = {
					string,
					...(entry.comment?.content.startsWith(commentPrefix) ? { developer_comment: entry.comment.content.slice(3).trim() } : {}),
					...(storeTermsInJSON && usedTerms.length ? { terms: Object.fromEntries(usedTerms.map(t => ([t, terms[t]]))) } : {})
				};
			}
			if (entry.attributes.length) {
				entry.attributes.forEach((attr) => {
					const usedTerms = [];
					const string = attr.value.elements.map(e => processElement(e, ftl, usedTerms, opts)).join('');
					json[`${entry.id.name}.${attr.id.name}`] = { 
						string,
						...(entry.comment?.content.startsWith(commentPrefix) ? { developer_comment: entry.comment.content.slice(3).trim() } : {}),
						...(storeTermsInJSON && usedTerms.length ? { terms: Object.fromEntries(usedTerms.map(t => ([t, terms[t]]))) } : {})
					};
				});
			}
		}
	});
	return json;
}

export function extractTerms(ftl) {
	const res = parse(ftl);
	const terms = {};
	res.body.forEach((entry) => {
		if (entry?.type === 'Term') {
			terms[entry.id.name] = entry.value.elements.map(e => processElement(e, ftl, null, { transformTerms: false })).join('');
		}
	});
	return terms;
}
