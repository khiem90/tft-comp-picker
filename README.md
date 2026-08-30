# TFT Comp Picker

A local web app for picking which TFT Set 18 Comp to play from what you currently hold in-game. Domain vocabulary lives in [CONTEXT.md](CONTEXT.md); decisions live in [docs/adr/](docs/adr/).

## Run it

```
npm install
npm start
```

One process serves both the API and the UI at http://localhost:3000.

## Data

Comps and Set data are plain JSON at [data/comps.json](data/comps.json) and [data/set-data.json](data/set-data.json). Edit them by hand whenever the meta moves or a scrape breaks; the server reads them fresh on every request.

## Tests

```
npm test
```

Tests exercise the server HTTP API only. See the Testing Decisions in [.scratch/comp-picker-mvp/spec.md](.scratch/comp-picker-mvp/spec.md).
