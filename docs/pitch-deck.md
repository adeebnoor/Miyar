# Miyar bilingual pitch

Public viewer: `pitch.html?lang=ar` or `pitch.html?lang=en`.
Append `#6` (for example) to share a particular slide. Switching language keeps
the same slide. The landing navigation links to the current interface language.

The deck follows the supplied Uber pitch template’s 1601 × 1000 canvas,
navy/teal/white palette, large headings, short content and photographic sections.
Miyar has 18 slides in each language, with original Miyar copy and no Uber branding.

`dist/pitch/content.json` is the bilingual narrative and readable web transcript.
`dist/pitch/Miyar-Pitch-AR.pptx` and `Miyar-Pitch-EN.pptx` contain native editable
text and a native position-record table. Their PDF counterparts retain searchable
text and a working link to the platform. JPEG previews are rendered from these
PDFs, ensuring the browser presentation matches the downloadable deck.

The boardroom background was generated for this deck; it does not depict a
customer or partnership. Source attribution and assumptions are in slide notes.
Customer segments, pricing model, partnerships and pilot scope are explicitly
proposed. No customer adoption, revenue, proprietary evaluation calculation,
automatic compliance guarantee or activated generative model is claimed.

## Regeneration

The authoring scripts use the supplied Codex primary presentation runtime:

1. `scripts/build_pitch.mjs` builds candidates with `@oai/artifact-tool`.
2. `scripts/finalize_pitch.mjs` declares Arabic paragraph direction, validates
   slide dimensions, fonts, table editability and package import, then writes
   separate final PPTX files. Set `RUNTIME_NODE_MODULES` to
   `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. Use `MIYAR_PITCH_REVISION=-v3` (or another
   unused suffix) when revising existing output, then promote reviewed files to
   the canonical download filenames.
3. Convert final PPTXs to PDF with LibreOffice. Artifact Tool preview rendering
   does not preserve Arabic word order in this runtime; use the PDF previews.
4. Run `scripts/render_pitch.py` with the primary Python runtime. Review every
   resulting slide before publishing. Run `npm test` to check viewer flows.

Validation covers Arabic direction, complete slide rendering, selectable PDF
text, links, native PPTX content and viewer navigation. PowerPoint desktop and
Google Slides are not separately certified by these checks.
