# Contributing to Orbit

Thanks for looking at **Orbit**! 🙌 This is an actively evolving project and
**feedback is genuinely wanted** — whether you write code or not.

## The easiest way to help: tell me what you think

You don't need to open a pull request to contribute. The most valuable thing right now
is **your opinion**:

- 💬 **[Start a Discussion](https://github.com/Saathvik-Choudhary/Personal_Dashboard/discussions)** — ideas, questions, "I wish it did X", or first impressions.
- 💡 **[Open a Feedback issue](https://github.com/Saathvik-Choudhary/Personal_Dashboard/issues/new?template=feedback.md)** — a structured way to share a suggestion.
- 🐞 **[Report a bug](https://github.com/Saathvik-Choudhary/Personal_Dashboard/issues/new?template=bug_report.md)** — found something broken? Let me know.
- ⭐ **Star the repo** if you find it interesting — it helps others discover it.

## Contributing code

This is a pnpm + Turborepo monorepo. The high-leverage boundary is `packages/core` —
both the daemon and the Cloud Functions import it. Please protect that boundary.

1. Fork the repo and create a branch: `git checkout -b feature/your-idea`
2. `pnpm install` and make your change. Keep it focused and match the existing style.
3. Run the relevant workspace locally (see the README) and confirm it still builds.
4. Commit with a clear message and open a pull request describing **what** and **why**.

I review PRs as a solo maintainer, so small, well-scoped changes get merged fastest.

## Ground rules

- Be kind and constructive — see the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/).
- **Never** commit secrets or API keys. Confirm `git status` never lists `.env` before pushing.
- Not sure if something is welcome? Open a Discussion and ask.

Thank you for helping make Orbit better! 💙
