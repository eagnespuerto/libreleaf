# Contributing to LibreLeaf

Thanks for helping. LibreLeaf is built for independent researchers, so
reports from people who aren't programmers are just as useful as code.

## Reporting a wrong word count

Use the **Wrong word count** issue form. Include the smallest piece of LaTeX
that counts wrongly, LibreLeaf's number, and the number you expected. If you
compared with TeXCount, say which version (`texcount -ver`).

Check [docs/texcount-comparison.md](docs/texcount-comparison.md#known-differences)
first: a few differences from TeXCount are deliberate.

Please don't paste a whole unpublished paper. Cut it down to the part that
shows the problem.

## Working on the code

You need Node.js 18 or newer. There are no dependencies to install.

```bash
npm test                                      # run the tests
node packages/texcount/texcount.js main.tex   # count a file
```

The website is `index.html`, served as-is by GitHub Pages. To try it locally,
serve the folder with any static server, for example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly as a file may
block the scripts it loads.

### Layout

- `packages/texcount/texcount.js`: the counter. It works in the browser and in
  Node, and is also the command-line tool.
- `packages/texcount/unzip.js`: reads .zip projects in the browser.
- `docs/`: the roadmap, product spec, design notes and brand kit.

### Changes

1. Make a branch from `main`.
2. Add or update a test in `packages/texcount/*.test.js` for any change to
   counting. If you change a counting rule, check it against real TeXCount and
   say so in the pull request.
3. Run `npm test`.
4. Open a pull request. CI runs the tests on Node.js 18, 22 and 24.

Keep the counter free of dependencies, so the website keeps working with no
build step.

## Writing style

The interface and docs use plain, short sentences in British-leaning English
("colour", "maths"). Avoid jargon where a plain word works.

## Code of conduct

Everyone taking part agrees to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your work is released under the
[AGPL-3.0](LICENSE).
