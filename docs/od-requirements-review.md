# Position creation requirements review — Miyar 4.3

Public review entry: https://adeebnoor.github.io/Miyar/?review=od

Reviewed against the supplied Position Creation Workflow and a legacy `miyar-demo-decision/2.1` mechanical-engineer lookup. Original attachments and customer identifiers are not published. The review distinguishes implemented capabilities from organization setup and independent validation still needed.

| Requirement | Implemented behavior | Evidence and boundary |
|---|---|---|
| Business input | Title, rationale, department, reporting line, duties, team, budget, decision authority and alternatives | Editable position form; Field and Seniority remain unrestricted text inputs. |
| Job analysis | Purpose, three or more responsibilities, scope, supervision, impact, internal/external stakeholders and RACI | Server completeness gate before submission; content remains versioned. |
| Consultative JD | Qualifications, experience, technical/behavioral competencies and certification needs | OD approval requires department representative, valid consultation date, consultation confirmation and role-based description confirmation. This records an accountable reviewer attestation, not independent verification that a meeting occurred. |
| Korn Ferry evaluation | Administrator-authorized external report recording; score, grade, report, assessor, date, rationale and knowledge/problem-solving/accountability evidence | Only Total Rewards at its review stage can record results. No proprietary scoring tables or Korn Ferry calculator are implemented. Organization authorization and actual specialist reports are required; licensing is not independently verified by Miyar. The default illustrative points remain explicitly separate. |
| Saudi occupation code | Versioned occupation directory, code and source page | Reference mapping requires OD review and is not a compliance determination. |
| Education code | Text-preserving codes including leading zeros | The legacy `71501` uniquely matches `071501` in the supplied education reference. Ambiguous/missing mappings remain blank with review notes. |
| Saudization and professional licensing | Requirement, source URL and verification date; separate certificate field | Invalid schemes and dates rejected. Recorded regulatory requirements cannot pass OD review without source/date and reviewer confirmation. No requirement is inferred from title or code. |
| Final JD and evaluation rationale | DOCX, XLSX and PDF include requirements, codes, department consultation and evaluation evidence; JSON retains structured provenance | Approved outputs are produced only for approved revisions; revision-bound evaluations are locked after review. Guest HTML/JSON remain unapproved drafts. |
| Institutional traceability | Separate reviewer roles, immutable audit/version records, budget/headcount approval and final authority | Automated API coverage includes tenant isolation, review gates and export content. A live customer demonstration still requires configured accounts and an approved framework. |

## Legacy decision conversion

The title lookup becomes a new unapproved draft; no responsibilities, approval or grade is inferred. Its original input fields and source decision reference are retained, with conversion notes. The earlier `domain: all` represented the previous “all fields” selector and does not become an invented functional field. Typed seniority is preserved exactly.

For the supplied case the reference is occupation `214401` (mechanical engineer), 2019 occupation reference page 35, and education `071501` (mechanical engineering), 2020 education reference page 436. These are reference locations, not a claim of current regulatory eligibility or qualification equivalence.

## Verification and live scope

- Local regression: 60 JavaScript tests and 27 API tests passed locally; one PostgreSQL-only concurrency check was skipped in the local SQLite environment, including synthetic legacy import, unsafe source/date rejection, new-field persistence, review deep link, specialist UI submission, complete approval and export evidence.
- GitHub release gate repeats the API suite against PostgreSQL 17, followed by the JavaScript suite before Pages publication. The release run is linked in repository Actions.
- The personal website links to the review entry from its Arabic and English Miyar cards; Miyar links back to the researcher profile.
- Guest design, reference, import, HTML/JSON, guided tour and pilot tools are public. Organization approvals and server exports need valid organization accounts.
- Public health reports deployed version and configured service capabilities. Reachability does not prove completion of a multi-user customer demonstration.
- Semantic embeddings remain disabled on the current free service. HRIS contracts exist, but actual external endpoints require organization setup and verified delivery.

The site is suitable for reviewing the prototype and scoping an institutional pilot. No customer traction, independent evaluation accuracy, verified Korn Ferry license, or production SLA is claimed.
