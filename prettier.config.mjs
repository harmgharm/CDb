// @ts-check

/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 100,
  arrowParens: "always",
  endOfLine: "lf",
  proseWrap: "always",
  plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
