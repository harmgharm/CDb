import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import importXPlugin from "eslint-plugin-import-x";
import noOnlyTests from "eslint-plugin-no-only-tests";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import testingLibrary from "eslint-plugin-testing-library";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Next.js recommended configs
  ...nextVitals,
  ...nextTs,

  // TypeScript strict type-checked
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // SonarJS recommended
  sonarjs.configs.recommended,

  // Unicorn recommended
  unicorn.configs["flat/recommended"],

  // Prettier — disables conflicting formatting rules (must be last preset)
  prettierConfig,

  // Global ignores
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),

  // Disable type-checked rules for root config files
  {
    files: ["**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "sonarjs/deprecation": "off",
      "sonarjs/no-hardcoded-passwords": "off",
    },
  },

  // TypeScript parser options for type-checked rules
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.mjs",
            "postcss.config.mjs",
            "prettier.config.mjs",
            "lint-staged.config.mjs",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Custom rules
  {
    plugins: {
      "import-x": importXPlugin,
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
      "no-only-tests": noOnlyTests,
    },
    rules: {
      // TypeScript — strict
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: true,
          allowNumber: true,
          allowNullableObject: true,
        },
      ],

      // Import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Import rules
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "import-x/no-duplicates": "error",
      "import-x/no-unresolved": "off",
      "import-x/no-named-as-default": "warn",
      "import-x/no-named-as-default-member": "warn",

      // Unused imports
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Prevent .only in tests
      "no-only-tests/no-only-tests": "error",

      // Unicorn adjustments
      "unicorn/prevent-abbreviations": [
        "error",
        {
          replacements: {
            props: false,
            ref: false,
            params: false,
            args: false,
            env: false,
            fn: false,
            db: false,
            ctx: false,
            req: false,
            res: false,
            err: false,
            utils: false,
          },
        },
      ],
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            kebabCase: true,
            pascalCase: true,
          },
        },
      ],
      "unicorn/no-null": "off",
      "unicorn/prefer-top-level-await": "off",

      // General
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "prefer-arrow-callback": "error",

      // Code quality — warnings, not blockers
      "max-params": ["warn", 3],
      "max-lines": [
        "warn",
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },

  // Vitest — test file rules
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/expect-expect": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/no-focused-tests": "error",
      "vitest/no-identical-title": "error",
      "vitest/prefer-to-be": "warn",
      "vitest/prefer-to-have-length": "warn",
      "vitest/valid-expect": "error",
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
  },

  // Testing Library — React test file rules
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    ...testingLibrary.configs["flat/react"],
    rules: {
      ...testingLibrary.configs["flat/react"].rules,
      "testing-library/await-async-queries": "error",
      "testing-library/await-async-utils": "error",
      "testing-library/no-await-sync-queries": "error",
      "testing-library/no-debugging-utils": "warn",
      "testing-library/prefer-screen-queries": "warn",
      "testing-library/prefer-user-event": "warn",
    },
  },

  // Relaxed rules for test files
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "sonarjs/cognitive-complexity": ["error", 30],
      "sonarjs/no-hardcoded-passwords": "off",
      "unicorn/no-nested-ternary": "off",
      "unicorn/no-useless-undefined": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/prevent-abbreviations": "off",
      "max-lines": ["warn", 1000],
    },
  },
]);
