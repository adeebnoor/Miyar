"""Limited authored scope checks, independent of embedding similarity.

The JavaScript catalog is read as JSON, never executed. Its proposed reference
links are usable only when code, Arabic source title and page match this release.
These checks reduce unsupported suggestions; they do not certify task equivalence.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

from .domain import normalized


ROLE_CATALOG = Path(__file__).resolve().parent.parent / 'dist' / 'role-catalog.js'
HC_FIELD_ALIASES = {
    'workforce': ['تخطيط القوى العاملة', 'القوى العاملة', 'تخطيط القوى البشرية',
                 'تحليل المهارات', 'تحليل فجوات المهارات', 'workforce planning',
                 'manpower planning', 'skills analysis', 'skill analysis', 'skills gap analysis'],
}
# Only the explicitly domain-specific authored skills are constrained. Generic
# skills and direct dictionary evidence remain visible, with human review.
SKILL_FAMILIES = {
    'onet:2.B.3.e': {'it'},
    'onet:2.B.3.k': {'it', 'maintenance', 'operations'},
    'miyar:sql': {'it'},
    'miyar:python': {'it'},
    'miyar:ai': {'it'},
    'miyar:feasibility': {'projectDevelopment', 'investment', 'finance'},
    'miyar:financial-modelling': {'finance', 'investment', 'projectDevelopment'},
    'miyar:due-diligence': {'investment', 'projectDevelopment', 'legal'},
    'miyar:valuation': {'investment', 'finance', 'projectDevelopment'},
    'miyar:portfolio-risk': {'investment'},
    'miyar:audit-planning': {'internalAudit', 'governance'},
    'miyar:control-testing': {'internalAudit', 'governance', 'quality'},
    'miyar:audit-evidence': {'internalAudit', 'governance', 'quality'},
    'miyar:strategic-planning': {'strategy', 'pmo', 'hc', 'operations'},
    'miyar:project-governance': {'pmo', 'projectDevelopment', 'strategy'},
    'miyar:schedule-control': {'pmo', 'projectDevelopment', 'operations', 'maintenance'},
    'miyar:benefits-tracking': {'pmo', 'projectDevelopment', 'strategy'},
    'miyar:development-gates': {'projectDevelopment'},
}


@lru_cache(maxsize=1)
def read_role_catalog():
    source = ROLE_CATALOG.read_text(encoding='utf-8')
    marker = 'const catalog='
    if marker not in source:
        raise RuntimeError('Authored role scope catalog is unavailable')
    payload, _ = json.JSONDecoder().raw_decode(source.split(marker, 1)[1])
    if not isinstance(payload, dict) or not isinstance(payload.get('families'), list) or not isinstance(payload.get('roles'), list):
        raise RuntimeError('Authored role scope catalog is invalid')
    return payload


def normalize_phrase(text):
    words = normalized(text).split()
    return ' '.join(re.sub(r'^ال(?=.{3,})', '', re.sub(r'^(?:و|ب|ك)ال(?=.{3,})', 'ال',
                      re.sub(r'^لل(?=.{3,})', 'ال', word))) for word in words)


def positive_field(text):
    """Discard explicit exclusions, never use narrative or report recipients."""
    pattern = (r'\b(?:not responsible for|not|without|excluding|exclude|except|other than|no)\s+[^,;.!?\n]+'
               r'|\bnon[-\s]+[^,;.!?\n]+'
               r'|(?:دون|بدون|باستثناء|ليس|ليست|غير|لا)\s+[^،,;؛.\n]+')
    return re.sub(pattern, ' ', str(text or ''), flags=re.IGNORECASE)


def phrase_matches(text, terms):
    value = ' ' + normalize_phrase(text) + ' '
    result = []
    for term in terms:
        phrase = normalize_phrase(term)
        if not phrase:
            continue
        for match in re.finditer(re.escape(' ' + phrase + ' '), value):
            result.append((term, phrase, match.start(), match.end()))
        # Arabic conjunctions may attach without the definite article.
        if re.match(r'^[\u0600-\u06ff]', phrase):
            for match in re.finditer(re.escape(' و' + phrase + ' '), value):
                result.append((term, phrase, match.start(), match.end()))
    return result


def specialist_requested(seniority):
    terms = ['أخصائي', 'أخصائية', 'اختصاصي', 'اختصاصية', 'متخصص', 'متخصصة', 'فردي', 'مساهم فردي', 'محلل', 'محللة',
             'specialist', 'individual contributor', 'analyst', 'professional']
    value = positive_field(seniority)
    # Conflicting level statements require review rather than an assumed level.
    if phrase_matches(value, ['مدير', 'مديرة', 'رئيس', 'رئيسة', 'تنفيذي', 'تنفيذية', 'قيادي',
                              'قائد', 'قائدة', 'مشرف', 'مشرفة', 'manager', 'director', 'executive',
                              'chief', 'head', 'lead', 'supervisor']):
        return False
    return bool(phrase_matches(value, terms))


class OccupationScope:
    def __init__(self, field, seniority, nodes, flagged=(), catalog=None):
        catalog = read_role_catalog() if catalog is None else catalog
        positive = positive_field(field)
        matches = []
        for family in catalog['families']:
            terms = list(family['terms'])
            if family['id'] == 'hc':
                terms += [term for aliases in HC_FIELD_ALIASES.values() for term in aliases]
            matches += [(family['id'], *match) for match in phrase_matches(positive, terms)]
        # Only HR-qualified task phrases can provide extra HC field anchors.
        # Generic training/candidate/shared-services words are not HR evidence.
        hc_terms = next((family['terms'] for family in catalog['families'] if family['id'] == 'hc'), [])
        for role in catalog['roles']:
            if role.get('family') == 'hc':
                qualified = [term for term in role.get('taskKeywords', []) if phrase_matches(term, hc_terms)]
                matches += [('hc', *match) for match in phrase_matches(positive, qualified)]
        matches = [match for match in matches if not any(
            other[0] != match[0] and other[3] <= match[3] and other[4] >= match[4]
            and len(other[2]) > len(match[2]) for other in matches)]
        self.families = list(dict.fromkeys(match[0] for match in matches))
        self.matched_terms = list(dict.fromkeys(match[1] for match in matches))
        self.specialist_only = specialist_requested(seniority)
        self.intents = {}
        for family in self.families:
            intent_matches = []
            for role in catalog['roles']:
                if role.get('family') != family or role.get('intent') == 'general':
                    continue
                terms = list(role.get('taskKeywords', []))
                if family == 'hc':
                    terms += HC_FIELD_ALIASES.get(role.get('intent'), [])
                intent_matches += [(role['intent'], *match) for match in phrase_matches(positive, terms)]
            intent_matches = [match for match in intent_matches if not any(
                other[0] != match[0] and other[3] <= match[3] and other[4] >= match[4]
                and len(other[2]) > len(match[2]) for other in intent_matches)]
            matched_intents = {match[0] for match in intent_matches}
            if matched_intents:
                self.intents[family] = matched_intents
        self.references = {}
        for role in catalog['roles']:
            family = role.get('family')
            if family not in self.families:
                continue
            if self.specialist_only and role.get('level') in {'manager', 'executive'}:
                continue
            if family in self.intents and role.get('intent') not in self.intents[family] | {'general'}:
                continue
            code = role.get('ssco')
            source = nodes.get(code)
            if (not source or source.get('level') != 'occupation' or code in flagged
                    or source.get('titleAr') != role.get('referenceTitleAr')
                    or source.get('sourcePage') != role.get('sourcePage')
                    or source.get('parent') not in nodes):
                continue
            adjacent = role.get('mappingStatus') == 'adjacent-reference-for-review'
            reference = self.references.setdefault(code, {'families': [], 'mappingStatus':
                'adjacent-reference-for-review' if adjacent else 'source-title-reference-for-review'})
            if family not in reference['families']:
                reference['families'].append(family)
            if adjacent:
                reference['mappingStatus'] = 'adjacent-reference-for-review'

    def metadata(self, count):
        return {'status': 'scope-constrained-proposals' if self.families and count else 'insufficient-evidence',
                'families': self.families, 'matchedTerms': self.matched_terms,
                'coverage': 'authored-limited', 'candidateCount': count,
                'intents': [{'family': family, 'intent': intent} for family, intents in self.intents.items()
                            for intent in sorted(intents)],
                'requestedLevel': 'specialist' if self.specialist_only else None,
                'notice': ('Explicit field phrases constrain candidates to source-verified authored references; '
                           'cosine values and order remain unchanged. Coverage is limited and every link '
                           'requires human review; adjacent references are not exact occupation equivalence.'
                           if self.families and count else
                           'An explicit field was recognized, but no verified and eligible occupation reference '
                           'survived the source, level and candidate restrictions. No occupation mapping is '
                           'proposed; review the scope with a specialist.' if self.families else
                           'No supported explicit field phrase was found. No occupation mapping is proposed; '
                           'provide a specific field and review the limited skill suggestions with a specialist.')}

    def skill_evidence(self, skill_id, extracted_ids):
        if skill_id in extracted_ids:
            return 'dictionary-supported'
        families = SKILL_FAMILIES.get(skill_id)
        if families is None:
            return 'generic-dictionary-skill'
        if families.intersection(self.families):
            return 'explicit-field-family'
        return None
