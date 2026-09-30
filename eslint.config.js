import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // packages/web is linted by its own Next.js config (it needs the React Hooks rules).
    ignores: ["**/dist/**", "node_modules/**", "coverage/**", ".dstack/**", "**/.next/**", "**/build/**", "packages/web/**"]
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }]
    }
  }
);
