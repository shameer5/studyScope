# Baseline

This file records the repository baseline (branch + commit) for the working state used when running the golden-path tests and producing documentation updates.

- Branch: `main`
- Commit: `e99ad8b029ce972f08515ff26d593afe19b4681d`
- Recorded: 2026-02-03T00:00:00Z

Repro commands:

```bash
# show branch
git rev-parse --abbrev-ref HEAD
# show full commit
git rev-parse HEAD
# show commit details
git show --quiet --pretty=fuller e99ad8b029ce972f08515ff26d593afe19b4681d
```

Notes:
- This file is intended as a machine- and human-readable baseline marker. Update it when creating a release or a CI snapshot.
