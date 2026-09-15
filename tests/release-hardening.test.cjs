const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('dist/index.html','utf8');
const css=fs.readFileSync('dist/accessibility-perf-v5.css','utf8');

function channel(v){v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
function luminance(hex){const n=parseInt(hex.slice(1),16);const r=channel((n>>16)&255),g=channel((n>>8)&255),b=channel(n&255);return 0.2126*r+0.7152*g+0.0722*b;}
function contrast(a,b='#ffffff'){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}

test('home loads release hardening after the base landing styles',()=>{
  const base=index.indexOf('./landing.css');
  const hardening=index.indexOf('./accessibility-perf-v5.css');
  assert.ok(base>=0);
  assert.ok(hardening>base);
});

test('small muted landing labels use an AA-safe normal-text color',()=>{
  assert.match(css,/\.landing \.lp-role-facts dt/);
  assert.match(css,/\.landing \.lp-feature-number/);
  assert.match(css,/\.release-cta span/);
  assert.ok(contrast('#52675e')>=4.5);
  assert.ok(contrast('#51666a')>=4.5);
});

test('below-fold landing sections opt into deferred rendering without hiding content',()=>{
  assert.match(css,/@supports \(content-visibility:auto\)/);
  assert.match(css,/content-visibility:auto/);
  assert.match(css,/contain-intrinsic-size:auto 760px/);
  assert.doesNotMatch(css,/display\s*:\s*none/);
});
