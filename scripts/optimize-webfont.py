"""Remove legacy screen hinting while retaining all webfont characters/shaping.

Usage: python scripts/optimize-webfont.py INPUT.woff2 OUTPUT.woff2
Requires fonttools[woff]. The original full font remains in assets/arabic.ttf.
This optional maintenance step is not part of the release build.
"""
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

font = TTFont(sys.argv[1])
characters = set(font.getBestCmap())
options = subset.Options()
options.hinting = False
options.layout_features = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=characters)
subsetter.subset(font)
font.flavor = "woff2"
font.save(sys.argv[2])
result = TTFont(sys.argv[2])
assert set(result.getBestCmap()) == characters
assert all(table in result for table in ("GDEF", "GPOS", "GSUB"))
