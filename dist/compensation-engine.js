(function(root){
'use strict';
const round=(n,d=2)=>Number(Number(n).toFixed(d));
function num(v,name,{min=0,max=1e12,blank=false}={}){const missing=v===null||v===undefined||String(v).trim()==='';if(blank&&missing)return null;const n=missing||!['string','number'].includes(typeof v)?NaN:Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(name+' must be a valid number');return n;}
const positive=(v,name,blank=false)=>num(v,name,{min:.01,max:1e9,blank});
const currencyCodes=new Set(typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):['SAR','AED','BHD','KWD','OMR','QAR','USD','EUR','GBP','EGP','JOD','INR','PKR']);
const spreadReference={narrowBelow:20,wideAbove:75},compaZones=[[.8,'well-below'],[.95,'below'],[1.05,'at'],[1.2,'above'],[Infinity,'well-above']];
function diagnostics(minimum,midpoint,maximum){const spread=(maximum-minimum)/minimum*100,centre=(minimum+maximum)/2,offset=(midpoint-centre)/centre*100;return {rangeSpreadPercent:round(spread,1),spreadAssessment:spread<20?'narrow':spread>75?'wide':'common',midpointOffsetPercent:round(offset,1),midpointCentred:Math.abs(offset)<=2,reference:{...spreadReference,status:'illustrative-review-triggers-not-a-market-standard'}};}
function quartile(current,minimum,maximum){if(current===null)return null;if(current<minimum)return 'below-minimum';if(current>maximum)return 'above-maximum';const p=(current-minimum)/(maximum-minimum);return p<.25?'Q1':p<.5?'Q2':p<.75?'Q3':'Q4';}
const saudiSources=[{id:'gosi-new',url:'https://awareness.gosi.gov.sa/businessJourney.html',checkedOn:'2026-10-05'},{id:'gosi-existing',url:'https://www.gosi.gov.sa/GOSIOnline/FAQ_Employer',checkedOn:'2026-10-05'},{id:'eos',url:'https://www.hrsd.gov.sa/en/knowledge-centre/articles/317-0',checkedOn:'2026-10-05'}];
// Annualization holds the selected month's rates and wages constant; it is not a future-year forecast.
function saudiCost(salary,period,raw={}){
 if(raw.applicabilityConfirmed!==true)throw Error('Confirm GOSI registration regime and wage components against the employee record');
 const asOf=String(raw.asOf||''),date=new Date(asOf+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==asOf||asOf<'2024-07-03'||asOf>'2027-06-30')throw Error('Choose a valid GOSI calculation date from 2024-07-03 through 2027-06-30; later dates need a source review');
 const regime=raw.regime;if(!['saudi-existing','saudi-new','non-saudi'].includes(regime))throw Error('Choose a verified GOSI regime; GCC extension and special cases require specialist calculation');
 if(typeof raw.sanedEligible!=='boolean'&&regime!=='non-saudi')throw Error('Confirm SANED applicability from the employee record');
 const monthlyBasic=period==='monthly'?salary:salary/12,housingMonthly=num(raw.housingMonthly,'Monthly cash housing'),otherMonthly=num(raw.otherMonthly,'Other monthly cash'),contributoryExtra=num(raw.contributoryExtraMonthly,'Additional GOSI contributory monthly pay'),medicalAnnual=num(raw.medicalAnnual,'Annual medical cost'),serviceYears=num(raw.serviceYears,'Completed service years',{max:60});
 // Cash housing only; in-kind housing and commissions require reviewed inclusion in contributoryExtraMonthly.
 const contributoryWage=Math.min(45000,monthlyBasic+housingMonthly+contributoryExtra);
 const pensionRate=regime==='non-saudi'?0:regime==='saudi-existing'?9:asOf>='2026-07-01'?10:asOf>='2025-07-01'?9.5:9;
 const sanedRate=regime==='non-saudi'||!raw.sanedEligible?0:.75,occupationalRate=2,rate=pensionRate+sanedRate+occupationalRate;
 const monthlyCash=monthlyBasic+housingMonthly+otherMonthly;
 const enteredEos=num(raw.eosWageMonthly,'EOS monthly wage',{min:.01,blank:true}),eosWage=enteredEos===null?monthlyCash:enteredEos;
 const earnedMonths=y=>Math.min(y,5)*.5+Math.max(0,y-5);
 const eosServiceAccrual=eosWage*(earnedMonths(serviceYears+1)-earnedMonths(serviceYears));
 const gosiAnnual=contributoryWage*rate/100*12,annualGuaranteedCash=monthlyCash*12;
 return {mode:'saudi',asOf,regime,monthlyBasic:round(monthlyBasic),housingMonthly,otherMonthly,contributoryExtraMonthly:contributoryExtra,contributoryWage:round(contributoryWage),ceiling:45000,pensionRate,sanedRate,occupationalRate,employerRatePercent:rate,annualGosi:round(gosiAnnual),medicalAnnual,serviceYears,eosWageMonthly:round(eosWage),annualEosServiceAccrual:round(eosServiceAccrual),annualGuaranteedCash:round(annualGuaranteedCash),annualEmployerCost:round(annualGuaranteedCash+gosiAnnual+medicalAnnual+eosServiceAccrual),sources:saudiSources,notice:'Private-sector planning for confirmed standard registration only. Cash housing plus reviewed contributory additions, capped at SAR 45,000. Annualized at selected-date rates; no employee deductions added. EOS is one further year of service at unchanged wage, not termination entitlement or an IAS 19 actuarial liability. Excludes exceptional coverage and unentered costs.'};
}
function evaluate(raw){
 if(String(raw.rosterCsv||'').trim())return evaluateRoster({...raw,rosterCsv:'',incumbents:parseRoster(raw.rosterCsv)});
 if(Array.isArray(raw.incumbents)&&raw.incumbents.length)return evaluateRoster(raw);
 const currency=String(raw.currency||'SAR').trim().toUpperCase();if(!currencyCodes.has(currency)||['XXX','XTS'].includes(currency))throw Error('Currency must be a recognized currency code');
 const minimum=positive(raw.bandMin,'Band minimum'),midpoint=positive(raw.bandMid,'Band midpoint'),maximum=positive(raw.bandMax,'Band maximum');if(!(minimum<midpoint&&midpoint<maximum))throw Error('Salary band must satisfy minimum < midpoint < maximum');
 const source=String(raw.bandSource||'').trim();if(source.length<5)throw Error('Provide the organization salary-band source or rationale');
 const period=raw.period||'monthly';if(!['monthly','annual'].includes(period))throw Error('Choose monthly or annual salary');
 const periods=period==='monthly'?12:1,payBasis=raw.payBasis||'basic';if(!['basic','total'].includes(payBasis))throw Error('Choose basic or total cash pay');
 const headcount=num(raw.headcount,'Headcount',{min:1,max:10000});if(!Number.isInteger(headcount))throw Error('Headcount must be a whole number');
 const current=positive(raw.currentSalary,'Current / reference salary',true),oncost=num(raw.oncostPercent,'Employer on-cost',{min:0,max:200})/100;
 const enteredAllowances=num(raw.allowancesPercent,'Fixed allowances',{min:0,max:200,blank:true}),allowances=payBasis==='total'||enteredAllowances===null?0:enteredAllowances/100;
 const warnings=[];
 // These are unit-check triggers, never salary market benchmarks or statutory floors.
 if(period==='annual'&&currency==='SAR'&&midpoint<120000)warnings.push('annual-period-check');
 if(maximum/minimum>10||headcount>1000)warnings.push('scale-check');
 if(warnings.length&&raw.unitsConfirmed!==true)throw Error('Verify salary period and scale, then confirm the units; these are data-entry checks, not market benchmarks');
 const targetCompa=num(raw.targetCompaPercent??100,'Target compa-ratio',{min:1,max:300})/100,target=midpoint*targetCompa;
 if(target<minimum||target>maximum)throw Error('Target from approved midpoint must fall within the entered salary band');
 const progression=raw.progressionEnabled===true,policy=String(raw.progressionPolicy||'').trim(),evidence=String(raw.progressionEvidence||'').trim();
 if(progression&&(raw.progressionApproved!==true||policy.length<10||evidence.length<10))throw Error('Optional progression requires an approved policy reference and individual performance or experience evidence');
 const baseline=current===null?target:Math.max(current,minimum),recommended=current===null?target:progression?Math.max(baseline,target):baseline;
 const adjust=current===null?null:recommended-current,toMinimum=current===null?null:Math.max(0,minimum-current),optionalProgression=current===null?null:recommended-baseline;
 const detailed=raw.employerCosts?.mode==='saudi';if(detailed&&(currency!=='SAR'||payBasis!=='basic'||oncost!==0||allowances!==0))throw Error('Saudi breakdown requires SAR basic pay and zero generic allowance/on-cost percentages to prevent double counting');
 const cost=salary=>detailed?saudiCost(salary,period,raw.employerCosts):{mode:'percentage',annualGuaranteedCash:salary*periods*(1+allowances),annualEmployerCost:salary*periods*(1+allowances)*(1+oncost)};
 const proposedCost=cost(recommended),currentCost=current===null?null:cost(current),minimumCost=current===null?null:cost(baseline);
 const compa=current===null?null:current/midpoint,penetration=(target-minimum)/(maximum-minimum),currentPen=current===null?null:(current-minimum)/(maximum-minimum);
 const payAction=current===null?'new-position':current>maximum?'red-circle':current<minimum?'below-band':optionalProgression>0?'increase':'hold';
 return {schema:'miyar-compensation-scenario/1.0',calculationVersion:'6.3.0',status:'organization-band-scenario-not-market-benchmark',createdAt:new Date().toISOString(),input:{payBasis,role:String(raw.role||'').trim().slice(0,300),grade:String(raw.grade||'').trim().slice(0,100),headcount,bandMin:minimum,bandMid:midpoint,bandMax:maximum,currency,period,bandSource:source.slice(0,1000),targetCompaPercent:round(targetCompa*100,2),targetPenetrationPercent:round(penetration*100,2),currentSalary:current,oncostPercent:round(oncost*100,2),allowancesPercent:enteredAllowances,allowancesApplied:allowances>0,progressionEnabled:progression,progressionApproved:raw.progressionApproved===true,progressionPolicy:policy,progressionEvidence:evidence,unitsConfirmed:raw.unitsConfirmed===true,employerCosts:detailed?{...raw.employerCosts}:null},result:{targetSalary:round(target),recommendedSalary:round(recommended),payAction,bandStatus:current===null?'unknown':current>maximum?'above-maximum':current<minimum?'below-minimum':'within-band',compaRatio:compa===null?null:round(compa,3),compaZone:compa===null?null:compaZones.find(([limit])=>compa<limit)[1],currentQuartile:quartile(current,minimum,maximum),currentRangePenetrationPercent:currentPen===null?null:round(currentPen*100,1),adjustmentPerFte:adjust===null?null:round(adjust),adjustmentPercent:adjust===null?null:round(adjust/current*100,1),minimumAdjustmentPerFte:toMinimum===null?null:round(toMinimum),optionalProgressionPerFte:optionalProgression===null?null:round(optionalProgression),annualMinimumAdjustmentCost:current===null?null:round((minimumCost.annualEmployerCost-currentCost.annualEmployerCost)*headcount),annualOptionalProgressionCost:current===null?null:round((proposedCost.annualEmployerCost-minimumCost.annualEmployerCost)*headcount),annualBasePayroll:round(recommended*periods*headcount),annualGuaranteedCash:round(proposedCost.annualGuaranteedCash*headcount),annualEmployerCost:round(proposedCost.annualEmployerCost*headcount),annualBaseAdjustmentCost:adjust===null?null:round(adjust*periods*headcount),annualAdjustmentCost:current===null?null:round((proposedCost.annualEmployerCost-currentCost.annualEmployerCost)*headcount)},employerBreakdown:{...proposedCost,perPerson:true},review:{warnings,unitsConfirmed:raw.unitsConfirmed===true,scope:headcount>1?'homogeneous-cohort-assumption':'individual'},bandDiagnostics:diagnostics(minimum,midpoint,maximum),referencePoints:{minimum,midpoint,maximum,p25:round(minimum+.25*(maximum-minimum)),p50:round(minimum+.5*(maximum-minimum)),p75:round(minimum+.75*(maximum-minimum)),q1:round(minimum+.25*(maximum-minimum)),q3:round(minimum+.75*(maximum-minimum))},calculationNotice:'Within-band pay is held unless individual progression is explicitly justified under an approved policy. Below-band correction is an organization-policy proposal, not an assertion of statutory minimum pay. No automatic reductions. New-position midpoint is a budgeting assumption, not an approved offer. Compa-ratio is position, not performance. Range quartiles are not market percentiles.',notice:'Uses only the organization-provided salary band. This is not a live market benchmark, pay-equity conclusion or compensation approval.'};
}
function evaluateRoster(raw){
 if(raw.incumbents.length>500)throw Error('Roster limit is 500 people');
 const ids=new Set(),incumbents=raw.incumbents.map(row=>{
  const id=String(row.id||'').trim();if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||ids.has(id))throw Error('Use unique pseudonymous roster IDs (letters, digits, dash or underscore)');ids.add(id);
  if(row.currentSalary===null||row.currentSalary===undefined||String(row.currentSalary).trim()==='')throw Error('Each incumbent needs an actual salary; blank is not zero');
  const employerCosts=raw.employerCosts?.mode==='saudi'?{...raw.employerCosts,...row.employerCosts}:null;
  const v=evaluate({...raw,incumbents:undefined,headcount:1,currentSalary:row.currentSalary,progressionEnabled:raw.progressionEnabled===true&&row.progressionEligible===true,progressionEvidence:row.progressionEvidence||'',employerCosts});
  return {id,input:v.input,result:v.result,employerBreakdown:v.employerBreakdown};
 });
 const first=evaluate({...raw,incumbents:undefined,headcount:1,currentSalary:incumbents[0].input.currentSalary,progressionEnabled:false,employerCosts:incumbents[0].input.employerCosts});
 const sums=['annualMinimumAdjustmentCost','annualOptionalProgressionCost','annualBasePayroll','annualGuaranteedCash','annualEmployerCost','annualBaseAdjustmentCost','annualAdjustmentCost'];
 first.input={...first.input,headcount:incumbents.length,currentSalary:null,progressionEnabled:raw.progressionEnabled===true,incumbents:raw.incumbents,progressionEvidence:'',employerCosts:raw.employerCosts||null};
 for(const k of sums)first.result[k]=round(incumbents.reduce((sum,x)=>sum+x.result[k],0));
 for(const k of ['recommendedSalary','compaRatio','compaZone','currentQuartile','currentRangePenetrationPercent','adjustmentPerFte','adjustmentPercent','minimumAdjustmentPerFte','optionalProgressionPerFte'])first.result[k]=null;
 first.result.payAction='roster-review';first.result.bandStatus='individual-results';first.incumbents=incumbents;first.employerBreakdown=null;first.review.scope='actual-incumbent-roster';
 return first;
}
// Strict, small CSV contract: fixed columns avoid silently dropping employee attributes.
const rosterColumns=['id','currentSalary','progressionEligible','progressionEvidence','regime','housingMonthly','otherMonthly','contributoryExtraMonthly','medicalAnnual','serviceYears','sanedEligible','eosWageMonthly'];
function parseRoster(text){
 if(String(text).length>250000)throw Error('Roster CSV exceeds 250 KB');
 const lines=String(text).replace(/^\uFEFF/,'').trim().split(/\r?\n/),headers=lines.shift().split(',').map(x=>x.trim());
 if(!headers.includes('id')||!headers.includes('currentSalary')||headers.some(x=>!rosterColumns.includes(x))||new Set(headers).size!==headers.length)throw Error('Use the roster CSV template headers; names, email and national IDs are not needed');
 if(lines.length<1||lines.length>500)throw Error('Roster needs 1–500 rows');
 return lines.map((line,index)=>{const cells=line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)?.map(x=>x.replace(/^,/, '').replace(/^"|"$/g,'').replace(/""/g,'"').trim())||[];if(cells.length!==headers.length)throw Error('Invalid roster CSV row '+(index+2));const v=Object.fromEntries(headers.map((h,i)=>[h,cells[i]])),bool=k=>{if(!['','true','false'].includes(v[k]??''))throw Error('Use true or false in '+k+' at row '+(index+2));return v[k]==='true';};const row={id:v.id,currentSalary:v.currentSalary,progressionEligible:bool('progressionEligible'),progressionEvidence:v.progressionEvidence||''};if(v.regime)row.employerCosts={regime:v.regime,housingMonthly:v.housingMonthly,otherMonthly:v.otherMonthly,contributoryExtraMonthly:v.contributoryExtraMonthly,medicalAnnual:v.medicalAnnual,serviceYears:v.serviceYears,sanedEligible:bool('sanedEligible'),eosWageMonthly:v.eosWageMonthly};return row;});
}
const example={role:'Human Capital Projects & Operations Manager',grade:'G11 · Manager',headcount:1,currency:'SAR',period:'monthly',bandSource:'Illustrative organization band — replace with the approved Total Rewards source before use',bandMin:24000,bandMid:30000,bandMax:36000,targetCompaPercent:100,currentSalary:'',oncostPercent:15,allowancesPercent:'',progressionEnabled:false};
 root.MiyarCompensation={evaluate,example,spreadReference,saudiCost,parseRoster,rosterColumns};if(typeof module!=='undefined')module.exports=root.MiyarCompensation;
})(typeof window!=='undefined'?window:globalThis);
