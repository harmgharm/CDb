# Contributing to CinemaDatabase

Thanks for your interest in CDb! This started as a hobby project for a group of friends, but it's
open source under [MIT](./LICENSE) and contributions of any size are welcome — bug reports,
features, docs, or your own fork. Have a look around, and don't hesitate to open an issue or PR.

## Code of Conduct

This project adheres to the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating, you
agree to uphold its terms. Report unacceptable behavior to `harmingsmc@gmail.com`.

## Ways to Contribute

- **Report a bug** — open a [GitHub Issue](../../issues) with reproduction steps
- **Suggest a feature** — open an issue to discuss before building, so we can align on scope
- **Submit a pull request** — fixes, features, refactors, or documentation
- **Fork it** — build your own version; that's encouraged too

## Reporting Bugs

Before opening an issue, please search existing issues to avoid duplicates. A good bug report
includes:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, browser, Node version)
- Screenshots or console output if it's a UI or runtime issue

## Suggesting Features

For anything beyond a small tweak, open an issue first to talk through the idea. This isn't
gatekeeping — it's just easier than discovering scope disagreements after the PR is written.
Describe the problem you're trying to solve, not just the solution you have in mind.

## Development Setup

See the [README](./README.md#getting-started) for prerequisites, environment variables, and the full
setup flow (Neon, TMDB, and Ably all offer free tiers). For code style, naming, lint patterns, and
database conventions, see [CLAUDE.md](./CLAUDE.md).

## Pull Request Process

1. **Fork** the repo and create a branch off `main`:
   - `feature/<short-description>` for new functionality
   - `fix/<short-description>` for bug fixes
   - `chore/<short-description>` for tooling, deps, docs
2. **Make your changes** following the conventions in [CLAUDE.md](./CLAUDE.md).
3. **Verify locally** before opening the PR:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org) (see below).
5. **Open the PR** against `main` with:
   - A clear title and description
   - A link to the related issue (if any)
   - Screenshots or recordings for UI changes
6. **Respond to review feedback.** Squash or amend as needed; CI must pass before merge.

Pre-commit hooks (Husky + lint-staged) will run ESLint, Prettier, and typecheck on staged files
automatically — please don't bypass them with `--no-verify`.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org). The common prefixes:

| Prefix      | Use for                                     |
| ----------- | ------------------------------------------- |
| `feat:`     | A new feature                               |
| `fix:`      | A bug fix                                   |
| `chore:`    | Tooling, deps, build, config                |
| `docs:`     | Documentation only                          |
| `test:`     | Adding or updating tests                    |
| `refactor:` | Code change that's neither a feat nor a fix |

Examples:

```
feat: add cast headshots on detail page
fix: unauthenticated homepage overflow on mobile
chore: bump next to 16.0.4
```

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE) that covers this project.
