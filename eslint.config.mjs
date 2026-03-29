// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // DISABLED: Pure formatting (use Prettier/IDE)
    '@stylistic/comma-dangle': 'off',
    '@stylistic/member-delimiter-style': 'off',
    '@stylistic/max-statements-per-line': 'off',
    '@stylistic/indent': 'off',
    '@stylistic/indent-binary-ops': 'off',
    '@stylistic/arrow-parens': 'off',
    '@stylistic/no-multi-spaces': 'off',
    '@stylistic/no-multiple-empty-lines': 'off',
    '@stylistic/brace-style': 'off',
    '@stylistic/quotes': 'off',
    '@stylistic/operator-linebreak': 'off',

    // Vue formatting
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/html-indent': 'off',
    'vue/comma-dangle': 'off',
    'vue/first-attribute-linebreak': 'off',
    'vue/block-tag-newline': 'off',

    // DISABLED: Too strict for AI-managed code
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-dynamic-delete': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
    'import/first': 'off',
    'nuxt/nuxt-config-keys-order': 'off',
  },
})
