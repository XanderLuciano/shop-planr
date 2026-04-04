// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Trailing commas on multiline — cleaner diffs
    'comma-dangle': ['error', 'always-multiline'],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],

    // No dead code — keeps AI context clean
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // Signal intent — const when not reassigned
    'prefer-const': 'warn',

    // Nuxt file-based routing makes single-word page names fine
    'vue/multi-word-component-names': 'off',

    // --- Future rules (uncomment when ready) ---
    // 'no-console': 'warn',
    // '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    // '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
  },
})
