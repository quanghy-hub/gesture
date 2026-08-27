const js = require('@eslint/js');
const globals = require('globals');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'offscreen/bergamot-translator-worker.js',
            'offscreen/vendor/transformers.min.js',
            'offscreen/vendor/transformers.global.js'
        ]
    },
    js.configs.recommended,
    eslintConfigPrettier,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.webextensions
            }
        },
        rules: {
            'no-unused-vars': ['warn', { vars: 'all', args: 'none' }],
            'no-console': 'off',
            semi: ['error', 'always'],
            quotes: ['error', 'single', { avoidEscape: true }]
        }
    },
    {
        // ort-shim.js là ES Module (re-export từ window.ort cho import map)
        files: ['offscreen/**/ort-shim.js'],
        languageOptions: { sourceType: 'module' }
    }
];
