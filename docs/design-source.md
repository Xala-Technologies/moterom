# Digilist design source

Source repository: `Xala-Technologies/digilist`

Reviewed commit: `16a8025d52cc69b917f9c255cc3ef5e1637bb0c7`

| Local file                                  | Digilist source                            |
| ------------------------------------------- | ------------------------------------------ |
| `src/design/digilist/platform-base.css`     | `packages/ds/themes/platform-base.css`     |
| `src/design/digilist/base.css`              | `packages/ds/themes/base.css`              |
| `src/design/digilist/common-extensions.css` | `packages/ds/themes/common-extensions.css` |
| `src/design/digilist/digilist-theme.css`    | `packages/ds/themes/digilist-theme.css`    |
| `src/design/digilist/input-overrides.css`   | `packages/ds/src/input-overrides.css`      |
| `src/design/digilist/touch-targets.css`     | `packages/ds/src/touch-targets.css`        |
| `public/digilist-logo.svg`                  | `apps/web/public/logo.svg`                 |

The logo is the existing Digilist brand asset. The customer's floor-plan image is excluded from source control and must be mounted separately with the owner's approval.

These theme files are intentionally vendored unchanged because `@digilist/ds` is a private workspace package, not assumed to be available from a public registry. Do not replace it with an unrelated visual system or edit copied tokens silently. Review upstream changes, refresh the complete set, and update this commit record together. If the organization publishes its private package, replace the vendored theme with that package through a separate reviewed change.

The installed Digdir CSS/React package version is recorded in `package-lock.json`. Brand typography is self-hosted Inter Variable. Customer pages use the brand header and constrained content area; administrative pages add a left sidebar and dense scheduling surfaces. Brand files are excluded from automatic formatting to preserve their source content.
