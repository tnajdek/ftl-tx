import { serialize, Attribute, Comment, Identifier, Message, Pattern, Placeable, Resource, SelectExpression, TermReference, TextElement, VariableReference, Variant } from "@fluent/syntax";


function parseString(string) {
	const elements = [];
	const pattern = /{(?:[^{}]|{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})*}/g;
	let start = 0;
	let match;
	
	while ((match = pattern.exec(string)) !== null) {
		const [bracketedContent,] = match;
		const pluralRegex = /^\{(\w+),\s*plural,\s*((?:(?!^\{).)*)\}$/s;

		if (match.index > start) {
			elements.push(new TextElement(string.slice(start, match.index)));
		}
		start = pattern.lastIndex;

		if (pluralRegex.test(bracketedContent)) {
			const [, variable, variants] = bracketedContent.match(pluralRegex);
			const variantRegex = /(\w+)\s+({(?:[^{}]|{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})*})/gm;
			let match;
			const matchedVariants = {};
			while ((match = variantRegex.exec(variants)) !== null) {
				const [, selector, text] = match;
				matchedVariants[selector] = text;
			}
			const ftlVariants = Object.entries(matchedVariants).map(
				([selector, text]) => new Variant(
					new Identifier(selector), new Pattern(parseString(text.slice(1, -1)))
				)
			);

			const defaultVariant = ftlVariants.find(v => v.key.name === 'other') ?? ftlVariants[ftlVariants.length - 1];
			defaultVariant.default = true;

			elements.push(new Placeable(
				new SelectExpression(
					new VariableReference(new Identifier(variable)),
					ftlVariants
				))
			);
		} else {
			const varName = bracketedContent.trim().slice(1, -1).trim();
			if (varName.startsWith('FTLREF_')) {
				elements.push(new Placeable(new TermReference(new Identifier(varName.slice(7).replaceAll('_', '-')))));
			} else {
				const id = new Identifier(varName.startsWith('$') ? varName.slice(1) : varName);
				elements.push(new Placeable(new VariableReference(id)));
			}
		}	
		
	}

	if (start < string.length) {
		elements.push(new TextElement(string.slice(start)));
	}

	return elements;
}

export function JSONToFtl(json) {
	const ftl = new Resource([]);
	for (const key in json) {
		const attr = key.match(/\.([^.]+)$/)?.[1];
		const msgName = attr ? key.slice(0, -attr.length - 1) : key;
		const msgID = new Identifier(msgName);
		const attrID = attr && new Identifier(attr);
		const elements = parseString(json[key]?.string);
		const pattern = new Pattern(elements);
		const comment = json[key]?.developer_comment ? new Comment(`tx: ${json[key].developer_comment}`) : null;
		if(attr) {
			ftl.body.find(m => m.id.name === msgName)?.attributes.push(new Attribute(attrID, pattern)) || ftl.body.push(new Message(msgID, null, [new Attribute(attrID, pattern)], comment));
		} else {
			ftl.body.push(new Message(msgID, pattern, [], comment));
		}
	}
	return serialize(ftl);
}