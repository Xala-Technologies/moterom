# Contributing

Day-to-day work lands on `dev`. `main` is production.

## Branches

Create a short-lived branch from `dev`:

- `feat/` new behaviour
- `fix/` a defect
- `chore/` tooling, docs, or repo hygiene

Open a pull request into `dev`. Squash-merge when checks pass, then delete the branch.

## Releases

Ship by opening a pull request from `dev` into `main`. Do not push directly to `main`.

Hotfixes that cannot wait for `dev` may target `main`; merge `main` back into `dev` immediately afterwards.

## Checks

Before review:

```sh
npm run check
npm run format:check
```

CI runs the same commands on pull requests and on pushes to `main` and `dev`.

Agents should follow [CLAUDE.md](CLAUDE.md) and the skills in `.claude/skills/`.
