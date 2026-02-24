// @ts-check

/** @type {import("lint-staged").Config} */
const config = {
  // Format all supported files with Prettier
  "*.{ts,tsx,js,jsx,json,md,css,yml,yaml,mjs}": ["prettier --write"],

  // Lint and type-check TypeScript/JavaScript files
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix --max-warnings 0 --no-warn-ignored",
    () => "npm run typecheck",
  ],
};

export default config;
