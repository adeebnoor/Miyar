"""Calibrate a similarity threshold from expert judgments (REQ-P1-06).

Input CSV columns:
  caseId      unique case identifier
  similarity  engine similarity for the top candidate, 0-1
  expertMatch 1 when the reconciled expert judgment accepts the top candidate, else 0
  expertA, expertB  optional independent judgments (1/0) before reconciliation; enables Cohen's kappa

Output: a JSON report with precision, recall, F1 and coverage across a threshold grid, the
recommended threshold (the lowest threshold reaching the target precision, else the best F1),
and a dataset fingerprint so the result can be reproduced. No numbers are typed by hand.

  python scripts/calibrate-thresholds.py judgments.csv --target-precision 0.9 --out report.json
"""
import argparse
import csv
import hashlib
import json
import sys
from datetime import datetime, timezone


def load(path):
    with open(path, newline='', encoding='utf-8-sig') as handle:
        rows = list(csv.DictReader(handle))
    seen, cases = set(), []
    for number, row in enumerate(rows, start=2):
        case = (row.get('caseId') or '').strip()
        if not case or case in seen:
            raise ValueError('Row %d: caseId must be present and unique' % number)
        seen.add(case)
        try:
            similarity = float(row['similarity'])
            match = int(row['expertMatch'])
        except (KeyError, ValueError):
            raise ValueError('Row %d: similarity must be a number and expertMatch 0 or 1' % number)
        if not 0 <= similarity <= 1 or match not in (0, 1):
            raise ValueError('Row %d: similarity must be 0-1 and expertMatch 0 or 1' % number)
        pair = None
        if (row.get('expertA') or '').strip() and (row.get('expertB') or '').strip():
            pair = (int(row['expertA']), int(row['expertB']))
        cases.append({'caseId': case, 'similarity': similarity, 'match': match, 'pair': pair})
    if len(cases) < 20:
        raise ValueError('Use at least 20 judged cases; the protocol asks for 100 or more')
    return cases


def kappa(pairs):
    if not pairs:
        return None
    n = len(pairs)
    observed = sum(a == b for a, b in pairs) / n
    pa, pb = sum(a for a, _ in pairs) / n, sum(b for _, b in pairs) / n
    expected = pa * pb + (1 - pa) * (1 - pb)
    return None if expected == 1 else round((observed - expected) / (1 - expected), 3)


def evaluate(cases, target_precision=0.9, start=0.5, stop=0.99, step=0.01):
    positives = sum(c['match'] for c in cases)
    grid = []
    # An integer grid avoids floating-point drift in the threshold values themselves.
    for k in range(int(round((stop - start) / step)) + 1):
        threshold = round(start + k * step, 4)
        accepted = [c for c in cases if round(c['similarity'], 6) >= threshold]
        tp = sum(c['match'] for c in accepted)
        precision = tp / len(accepted) if accepted else None
        recall = tp / positives if positives else None
        f1 = 2 * precision * recall / (precision + recall) if precision and recall else 0.0
        grid.append({'threshold': round(threshold, 2), 'accepted': len(accepted), 'truePositives': tp,
                     'precision': None if precision is None else round(precision, 4),
                     'recall': None if recall is None else round(recall, 4), 'f1': round(f1, 4),
                     'coverage': round(len(accepted) / len(cases), 4)})
    meeting = [g for g in grid if g['precision'] is not None and g['precision'] >= target_precision and g['accepted'] > 0]
    if meeting:
        chosen, basis = meeting[0], 'lowest threshold reaching target precision %.2f' % target_precision
    else:
        chosen, basis = max(grid, key=lambda g: g['f1']), 'target precision not reached; best F1 shown for review'
    return grid, chosen, basis, positives


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('csv')
    parser.add_argument('--target-precision', type=float, default=0.9)
    parser.add_argument('--out')
    args = parser.parse_args(argv)
    try:
        cases = load(args.csv)
    except (OSError, ValueError) as error:
        print('Calibration input rejected:', error, file=sys.stderr)
        return 2
    grid, chosen, basis, positives = evaluate(cases, args.target_precision)
    with open(args.csv, 'rb') as handle:
        fingerprint = hashlib.sha256(handle.read()).hexdigest()
    report = {'schema': 'miyar-threshold-calibration/1.0', 'generatedAt': datetime.now(timezone.utc).isoformat(),
              'datasetSha256': fingerprint, 'cases': len(cases), 'expertPositives': positives,
              'interRaterKappa': kappa([c['pair'] for c in cases if c['pair']]),
              'targetPrecision': args.target_precision, 'recommended': chosen, 'basis': basis, 'grid': grid,
              'notice': 'Adopt a threshold only after the owner and HR experts approve this report; record the approval date and approver.'}
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as handle:
            handle.write(text + '\n')
    print(json.dumps({'recommendedThreshold': chosen['threshold'], 'precision': chosen['precision'], 'recall': chosen['recall'], 'basis': basis}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
