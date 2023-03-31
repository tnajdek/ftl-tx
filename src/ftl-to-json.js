import { parse } from "@fluent/syntax";
import { checkForNonPlurals } from "./common.js";

function processElement(element, ftl) {
    if (element.type === 'Placeable' && element.expression.type === 'SelectExpression') {
		const ICUVariants = element.expression.variants.map(v => {
			switch (v.key.type) {
				case 'NumberLiteral':
					return `=${v.key.value} {${v.value.elements.map(e => processElement(e, ftl)).join('')}}`;
				default:
				case 'Identifier':
					return `${ftl.slice(v.key.span.start, v.key.span.end)} {${v.value.elements.map(e => processElement(e, ftl)).join('')}}`;
			}
		}).join(' ');

		const selectType = checkForNonPlurals(element.expression.variants) ? 'select' : 'plural';
		return `{${element.expression.selector.id.name}, ${selectType}, ${ICUVariants}}`;
    }
	if (element.type === 'Placeable' && element.expression.type === 'VariableReference') {
		return `{ ${element.expression.id.name} }`;
	}
	if (element.type === 'Placeable' && element.expression.type === 'TermReference') {
		return `{ FTLREF_${element.expression.id.name.replaceAll('-', '_')} }`;
	}
    return ftl.slice(element.span.start, element.span.end);
}

export function ftlToJSON(ftl) {    
    const res = parse(ftl);
    const json = {};
    res.body.forEach((entry) => {
        if (entry?.type === 'Message') {
            if (entry.value?.type === 'Pattern') {
                ftl.slice()
                json[entry.id.name] = {
                    string: entry.value.elements.map(e => processElement(e, ftl)).join(''),
                    ...(entry.comment?.content.startsWith('tx:') ? { developer_comment: entry.comment.content.slice(3).trim() } : {})
                };
            }
            if (entry.attributes.length) {
                entry.attributes.forEach((attr) => {
                    json[`${entry.id.name}.${attr.id.name}`] = { string: attr.value.elements.map(e => processElement(e, ftl)).join('') };
                });
            }
        }
    });
    return json;
}