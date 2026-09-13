"""Versioned decision gates. Similarity is a tunable signal, never calibrated confidence."""
import math
from .domain import digest
POLICY_VERSION='miyar-gates/1.0'
DEFAULT_POLICY={'similarityThreshold':0.75,'minimumMargin':0.03,'version':1,'calibration':'unvalidated-pilot-default','rules':{}}

def route(candidates,catalog,approved_codes,policy=None,context=None,fallback_candidates=None):
    policy=policy or DEFAULT_POLICY;context=context or {};threshold=policy.get('similarityThreshold',.75);margin=policy.get('minimumMargin',.03)
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<=v<=1 for v in [threshold,margin]):raise ValueError('Threshold and margin must be finite values between 0 and 1')
    ordered=sorted(candidates,key=lambda c:(-c['cosineSimilarity'],c['code']));top=ordered[0] if ordered else None
    score=top['cosineSimilarity'] if top else -1;gap=score-ordered[1]['cosineSimilarity'] if len(ordered)>1 else 0
    code=top['code'] if top else None;node=catalog.roles.get(code);rule=policy.get('rules',{}).get(code,{})
    checks=[{'id':'R01','name':'Code exists in selected edition','pass':bool(node)},{'id':'R02','name':'Parent unit exists in source','pass':bool(node and node.get('parent') in catalog.nodes)},{'id':'R03','name':'Organization education requirement','pass':not rule.get('minimumEducationLevel') or (str(context.get('educationLevel','')).isdigit() and int(context['educationLevel'])>=int(rule['minimumEducationLevel']))},{'id':'R04','name':'Organization license evidence','pass':not rule.get('licenseRequired') or context.get('licenseVerifiedByOD') is True}]
    statistical=score>=threshold and gap>=margin;rules_ok=all(x['pass'] for x in checks)
    eligible=statistical and rules_ok
    # This is an intersection with a separately approved library. A taxonomy record alone is not pre-approved.
    fallback=[c for c in sorted(fallback_candidates if fallback_candidates is not None else ordered,key=lambda c:(-c['cosineSimilarity'],c['code'])) if c['code'] in approved_codes and c['code'] in catalog.roles and c['code'] not in catalog.flagged]
    # Each fallback must independently pass its organization policy. No unsafe candidate survives through fallback.
    def allowed(c):
        r=policy.get('rules',{}).get(c['code'],{});minimum=r.get('minimumEducationLevel')
        return (not minimum or (str(context.get('educationLevel','')).isdigit() and int(context['educationLevel'])>=int(minimum))) and (not r.get('licenseRequired') or context.get('licenseVerifiedByOD') is True)
    fallback=[c for c in fallback if allowed(c)]
    selected=top if eligible else next(iter(fallback),None)
    parent=node.get('parent') if node else None
    if parent not in catalog.nodes:parent=None
    return {'policyVersion':POLICY_VERSION,'organizationPolicyVersion':policy.get('version',1),'threshold':threshold,'minimumMargin':margin,'observedMargin':round(gap,5),'calibration':policy.get('calibration','unvalidated'),'statisticalGatePassed':statistical,'rules':checks,'route':'candidate_for_review' if eligible else 'approved_library_fallback' if selected else 'provisional_required','selected':selected,'fallbackReason':None if eligible else ('below_similarity_or_margin_threshold' if not statistical else 'deterministic_rule_failure'),'provisionalParent':parent,'parentRelease':catalog.occupations['id'],'humanApprovalRequired':True,'nationalCodeReleaseAllowed':False,'notice':'Passing these internal rules does not establish current national compliance. A provisional internal identifier never becomes an official SSCO code through local approval.'}
