// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// NOTE: Base stylistic rules (commaDangle, braceStyle) are configured in
// nuxt.config.ts under `eslint.config.stylistic`. Edit them there, not here.
// This file only adds project-specific overrides on top of the Nuxt preset.

export default withNuxt({
  rules: {
    // Only quote object keys when syntax requires it (e.g. hyphenated keys)
    '@stylistic/quote-props': ['error', 'as-needed'],

    // Align Vue comma-dangle with stylistic preset
    'vue/comma-dangle': ['error', 'always-multiline'],

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
}, {
  // Relax strict rules for test files — tests legitimately use any/delete for mocking
  files: ['tests/**/*.ts', 'tests/**/*.test.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-dynamic-delete': 'off',
  },
})
