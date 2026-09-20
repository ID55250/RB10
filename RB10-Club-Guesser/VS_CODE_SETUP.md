# RB10 Club guesser — VS Code setup

## Requirements

- Node.js 22.13 or newer
- Visual Studio Code

## Open and run

1. Extract this ZIP file.
2. Open the extracted `RB10-Club-Guesser` folder in VS Code.
3. Open **Terminal > New Terminal**.
4. Run:

```powershell
npm install
npm run build
npm start
```

5. Open `http://127.0.0.1:8787` in a browser.

For development mode, use `npm run dev`.

## Tests

```powershell
node --test work/engine.test.mjs work/data.test.mjs
```

The downloadable package excludes dependencies, build output, local databases,
Git history, deployment metadata, and temporary data. Install dependencies with
`npm install` after extraction.
