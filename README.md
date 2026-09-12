# Mi’yār | معيار

An Arabic, responsive demonstration of the Miyar workforce-intelligence concept: start from a strategic objective, identify an occupational reference, explain the recommendation, and record a review step.

The interface includes four views, five engineering occupations from the supplied project workbook, four ready-to-use scenarios, a five-screen presentation mode, a temporary session log, and downloadable JSON decision cards.

## Use the demo

Open `dist/index.html` directly in a modern browser. Application files and the Arabic font are local, so the downloaded site also works without a network connection. No API keys or installation are required.

For the meeting, use **وضع العرض** in the top bar. Navigate with the buttons or left/right arrow keys. Escape closes presentation mode. Select **جرّب معيار** on the final screen to return to the interactive application.

Suggested demonstration:

1. Select **كفاءة التشغيل** and explain the strategic objective.
2. Run **حلّل الاحتياج** and inspect the Industrial Engineer role, its codes and task evidence.
3. Add a constraint. The previous result becomes stale until reanalysis.
4. Record an acknowledgement and download the decision card.
5. Select **دور خارج العينة** to demonstrate referral without an invented code.

## Scope and evidence

This is a **deterministic presentation demo**, not a deployment of the original E5/Gemini Python application. It uses bilingual term groups over five supplied records. It abstains when evidence is insufficient, leading results tie, the selected domain is outside the sample, or task evidence conflicts with the selected domain. A recommendation needs at least two task groups; this is a demonstration rule, not a calibrated confidence threshold.

Codes and English role titles come from the supplied `data.xlsx`. Arabic translations, task-group dictionaries, explanations and scenarios were prepared for the interface. Mappings have not been independently validated against a current official classification release. The interface does not claim accuracy, savings, compliance certification, production model connectivity, enterprise integration, or a permanent audit ledger. Constraints are retained for human review, not certified as satisfied.

The session log is cleared on refresh. The review control records a demonstration acknowledgement, not professional or regulatory approval. Exported cards include these limitations. No entered information is sent to an AI provider.

This source includes the demonstration UI and sample data only. Original credentials, private correspondence, invention-disclosure files, national identifiers and contact details are not distributed.

## Files

- `dist/index.html`: accessible Arabic page structure.
- `dist/styles.css`: responsive layout and presentation styles.
- `dist/data.js`: five source records and demonstration vocabulary.
- `dist/engine.js`: isolated matching and export logic.
- `dist/app.js`: navigation, forms, presentation and temporary log.
- `dist/assets/`: local font, OFL license and favicon.
- `tests/engine.test.cjs`: behavioral checks with Node's built-in test runner.

## Verify

```sh
node --test tests/engine.test.cjs
node --check dist/app.js
```

The static `dist/` directory can be served by a static web host. No build is required.

Project contributors: Professor Adeeb Noor and Ahmad Raza Khan.

IBM Plex Sans Arabic is distributed under the included SIL Open Font License. No open-source license is asserted for the underlying Miyar invention or original research implementation.
