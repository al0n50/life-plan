## What & why
<!-- What changed, and why. -->

## How it was tested
<!-- Commands run; screens checked on web (and a device/simulator if native code changed). -->

## Preview
<!-- Vercel posts the preview URL on this PR. Paste it here and say what you checked on it. -->

## Self-review
- [ ] I read the whole diff line by line and can explain every change
- [ ] Nothing unrelated, generated or left over (debug code, commented-out code) slipped in

## Checklist
- [ ] `npm test`, `npm run typecheck`, `npm run lint` pass; web build (`npx expo export --platform web`) works
- [ ] Engine change? Tests added in `src/engine/__tests__`
- [ ] Saved-data shape changed? Store `version` bumped, `migrate` step + test added
- [ ] Expo/React Native packages added with `npx expo install`
- [ ] `CLAUDE.md` / README updated if architecture, commands or rules changed
- [ ] Checked the live demo after deploy
