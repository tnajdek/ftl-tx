import globals from "globals";
import pluginJs from "@eslint/js";

export default [
	pluginJs.configs.recommended,
	{
		files: ["src/**/*.{js,mjs}"],
		languageOptions: {
			ecmaVersion: 14,
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.node,
			}
		},
		rules: {
			'no-console': 'off'
		}
	},
	{
		files: ["test/**/*.test.js"],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.mocha,
			},
		},
		rules: {
			'no-console': 'off'
		}
	}
];
