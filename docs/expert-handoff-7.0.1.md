# Miyar 7.0.1 — expert handoff

**Site:** https://adeebnoor.github.io/Miyar/?v=7.0.1#home · **Status page:** https://adeebnoor.github.io/Miyar/trust.html#status · **Item register:** https://adeebnoor.github.io/Miyar/expert-v7.html

Release 7 answers the fifteen items in the expert report (V7-01 … V7-15). Before handoff, every screen was walked again in Arabic and English on desktop and mobile. 7.0.1 fixes what that walk found; nothing in the decision logic changed.

## What 7.0.1 changed

| Found | Fix |
|---|---|
| One saved position was listed under three different labels: `Title · LOCAL-uuid · v1` in Job evaluation, `Title · v1` in Compensation, and both at once in Manpower planning | One label everywhere: `Title · v1 · e025cba9` (short reference). Manpower no longer lists the same draft twice. |
| Guided tour step 2 told users to press "Load HC example" and "Generate OD package", which sit inside the collapsed optional package | Step 2 now follows the visible path: Load example → Apply suggestions to available fields → Save local draft. |
| Step numbers on the home page were 4.34:1 contrast (AA needs 4.5:1) | 5.8:1. Zero contrast failures remain across the audited routes. |
| README still said 6.1.1 and "four-stage workflow" | 7.0.1 and the five-stage workflow (budget owner → OD → Total Rewards → Finance → Final Authority). |

## 15-minute test path (no account needed)

1. **Home → Start the guided tour.** Five steps; demo data loads automatically.
2. **Find the right role.** Pick "Operations efficiency" and run the reference analysis. Expect an occupation with its SSCO code, education code and rationale. Then try a goal that is not a role (for example nurse retention) and expect a work-design question, not a position.
3. **New position request.** Load example → Apply suggestions → check "Core fields completed 15 / 15" → Save local draft. Open "KPIs & deliverables": an incomplete KPI row blocks "Save and open request" but not the local draft.
4. **Job evaluation.** Choose the saved position (one entry, `Software engineer · v1 · …`). Use position information to draft evidence, set the eight factors, enter two evaluator references and the second evaluator's ratings, then **Record committee evaluation**. Repeating the same evidence across more than two factors is rejected.
5. **Compensation.** Select the same position: the banner shows the recorded grade. Load the example band (24,000–36,000) and calculate. Expect compa-ratio, quartile, bring-to-minimum cost and the Saudi employer-cost breakdown with sources and effective dates.
6. **Manpower planning.** Select the same position (listed once) and pull its employer cost; load the HC example and calculate. Expect the bridge (backfill vs growth), five options, sensitivity and the hiring-lead-time effect.
7. **Switch language** on any screen: the form keeps its values and the sidebar keeps the same services.

## Still outside this release

- Acceptance of V7-02, V7-06 and V7-15 depends on the expert's hidden set (100 goals, 500 titles). Authored regressions are not that set.
- Institutional approvals, committee identities and exports need an organization account on the server; the public site records committee data locally and marks it unverified.
- The occupation reference is the supplied 2019 edition until the newer edition is licensed.

---

## ملخص بالعربية

الموقع: https://adeebnoor.github.io/Miyar/?v=7.0.1#home

الإصدار 7 يجيب عن بنود الخبير الخمسة عشر. قبل التسليم أُعيد فحص كل الشاشات بالعربية والإنجليزية على الحاسب والجوال، و7.0.1 يصحح ما ظهر: المنصب المحفوظ يظهر بتسمية واحدة في التقييم والتخطيط والتعويضات بلا تكرار؛ الجولة الموجهة تتبع مسار تصميم المنصب الظاهر (مثال توضيحي ← تطبيق المقترحات ← حفظ المسودة)؛ تباين أرقام الخطوات مطابق لمعيار AA؛ وتحديث README. منطق القرار لم يتغير.

مسار الاختبار في 15 دقيقة: الجولة الموجهة من الرئيسية ← ترشيح الدور ← طلب منصب (مثال توضيحي، تطبيق المقترحات، حفظ المسودة) ← التقييم الوظيفي مع مقيّمين اثنين وتسجيل تقييم اللجنة ← التعويضات بالمنصب نفسه ← تخطيط القوى العاملة بالمنصب نفسه ← تبديل اللغة.
