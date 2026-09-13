# Historical HR product review — initial five-record version

**Historical checkpoint:** this review predates the expanded corpus and enterprise API. Its five-record coverage and missing enterprise features do not describe the current application. See the [4.2 product review](product-investor-review.md) and [architecture](enterprise-architecture.md) for current behavior.

Live demo: https://adeebnoor.github.io/Miyar/

## Product judgment / الرأي المهني

**العائد الذي ينبغي أن يقدمه معيار هو قرار أفضل بشأن المنصب، وليس مجرد صياغة وصف وظيفي.** ابدأ بالسؤال: هل نحتاج عددًا إضافيًا لمهنة موجودة، أم إعادة تصميم دور، أم اقتراح دور تنظيمي يحتاج مرجعًا؟ افحص المهام المشابهة والبدائل، ثم وثّق الغرض والمساءلة ومؤشرات النجاح وأدلة التقييم.

Miyar should differentiate through a reviewable position-design decision, including the need, alternatives, responsibilities, reference evidence and review state. A polished job description alone is insufficient differentiation.

## Public product comparison

| Area | Tafany.net public pages | Miyar after this review |
| --- | --- | --- |
| Breadth | Salary, Saudization, HR metrics and resource tools | Focused occupation lookup and OD position workflow |
| Job descriptions | An external GPT job-description generator is listed | Bilingual structured form output, not live AI generation |
| Competencies | Searchable library with categories and behavioral/proficiency information | Authored competency fields; no integrated competency database |
| Occupational coverage | A comprehensive coded occupation lookup was not established in this review | Five engineering records from the supplied project sample; insufficient for general HR search |
| Position decision | Account-only and external GPT workflows were not tested | Justification, request type, alternatives, outcomes, overlap guidance, local draft persistence and scope-sensitive review |

Sources reviewed: [Tafany public toolkit](https://tafany.net/), [AI tools](https://tafany.net/ai_tools), [competency library](https://tafany.net/competency_library). This is not an audit of Tafany.sa, paid services, underlying AI quality or regulatory accuracy. Miyar does not establish superiority across the broader HR market.

## Observed defects and corrections

| Live reproduction before the change | HR consequence | Correction |
| --- | --- | --- |
| Searching `مهندس مدني` was rejected as too short | A known occupation could not be found by its ordinary title | Direct title/occupation-code lookup; Arabic diacritics, female title aliases and Arabic/Persian digits supported |
| `تحسين الأداء وتوزيع الموارد ومتابعة العمل في الإدارة المالية` returned Industrial Engineer | Generic administrative words could assign an irrelevant engineering code | Require discipline-specific anchors plus two task groups; generic finance, web and IT maintenance counterexamples abstain |
| Catalog used a whole-query substring | Reordered title words or Arabic numeric codes failed | Token-based bilingual search; education and occupation identifiers are labeled separately |
| No saved position lifecycle | Completing the form did not provide a reusable organizational record | Explicit local save, internal MJR identifier, revision counter, open/update and searchable saved drafts |
| Changes to a reviewed JD left prior status intact | An old review appeared applicable to a changed role | Scope changes preserve entered evidence but invalidate the prior review/evaluation status |
| Position need had no explicit alternatives or measurement structure | A request could skip the question of whether hiring is necessary | Required request type, alternatives to hiring and outcome/target/timeframe/owner prompt |
| Print/download was the only whole-package presentation | Reviewers could not inspect the assembled package on the page | Accessible in-page report preview, alongside HTML/JSON export and printing |

## Current implementation boundaries

- Saved drafts stay in the current browser on the current device. They are not uploaded to GitHub or shared with an HR team. Clearing browser data removes them; JSON is the portable backup.
- An MJR ID identifies an organizational draft, never an official occupation. Additional headcount can legitimately share a title; duplicate guidance does not automatically reject it.
- Local revisions support editing and stale-tab conflict detection, not an immutable audit history. The previous revision is replaced on save.
- Import validates a whitelisted schema, size and field types; imported reviews require renewed review. It does not create or trust imported occupation codes.
- The classification engine is deterministic, limited to five records, and not an E5/Gemini model. Matching rules have no measured population-level accuracy or confidence percentage. Negated task text is referred for clarification.
- Field completion and quality prompts are advisory. No automated hiring approval, headcount calculation, licensed Korn Ferry scoring, salary recommendation or compliance determination is performed.
- The original documents remain outside the public deployment; this change publishes authored code, synthetic examples and derived form requirements only.

## Why these changes matter

[CIPD workforce planning](https://www.cipd.org/en/knowledge/factsheets/workforce-planning-factsheet/) describes aligning organizational demand with workforce supply and identifying gaps and solutions. Miyar now makes the request type, alternatives and intended outcomes visible in the position decision. This is a design interpretation of that principle, not CIPD certification.

The existing O*NET, ESCO, SAP and Korn Ferry comparison remains in the demo. These are independent references, not partnerships or claims of integration.

## Next institutional priorities

1. Replace the five-record sample with a licensed, current, versioned occupational source, verified Arabic/English aliases and reviewed classification crosswalks. Measure task-matching precision and abstention on held-out real cases before automating recommendations.
2. Connect the actual organization structure, workforce capacity and cost data so duplicate checks and business justifications cover the institution, not one browser.
3. Add authenticated reviewers, role-based permissions, effective dates, approval routing and durable version/audit history before relying on the system for formal decisions.

These require real source access and organizational decisions; the demo does not pretend to implement them.

## Validation recorded for this change

35 automated model and DOM integration tests passed locally. They cover Arabic/English title and code lookup, Arabic/Persian digits, negative cross-discipline cases, task ambiguity, the five original examples, review invalidation, valid dates, local save/reopen/update, stale-tab conflicts, corrupted storage, import validation, data transfer, unsaved-change protection, report escaping and language switching. GitHub Actions runs the same suite before publishing the static site.

These are regression checks on specified cases, not evidence of general occupational-classification accuracy.
