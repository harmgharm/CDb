// @ts-check

/** @type {import("lint-staged").Config} */
const config = {
  // Format all supported files with Prettier
  "*.{ts,tsx,js,jsx,json,md,css,yml,yaml,mjs}": ["prettier --write"],

  // Lint, type-check, and run the unit suite for TypeScript/JavaScript files
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix --max-warnings 0 --no-warn-ignored",
    () => "pnpm run typecheck",
    () => "pnpm test -- --run",
  ],
};

export default config;
