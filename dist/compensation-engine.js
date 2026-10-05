(function(root){
'use strict';
const round=(n,d=2)=>Number(Number(n).toFixed(d));
const numericFields={'Band minimum':'min','Band midpoint':'mid','Band maximum':'max','Headcount':'headcount','Current / reference salary':'current','Employer on-cost':'oncost','Fixed allowances':'allowances','Target compa-ratio':'target','Monthly cash housing':'housing','Other monthly cash':'othercash','Additional GOSI contributory monthly pay':'contributory','Annual medical cost':'medical','Completed service years':'service','EOS monthly wage':'eos'};
function invalid(message,field,code='COMPENSATION_INPUT'){const error=Error(message);error.field=field;error.code=code;return error;}
function num(v,name,{min=0,max=1e12,blank=false,zeroWhenBlank=false}={}){const missing=v===null||v===undefined||String(v).trim()==='';if(blank&&missing)return null;if(zeroWhenBlank&&missing)return 0;const n=missing||!['string','number'].includes(typeof v)?NaN:Number(v);if(Number.isFinite(n)&&min>0&&n<=0)throw invalid(name+' must be greater than zero',numericFields[name],'POSITIVE_NUMBER');if(!Number.isFinite(n)||n<min||n>max)throw invalid(name+' must be a valid number',numericFields[name]);return n;}
const positive=(v,name,blank=false)=>num(v,name,{min:.01,max:1e9,blank});
const currencyCodes=new Set(typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):['SAR','AED','BHD','KWD','OMR','QAR','USD','EUR','GBP','EGP','JOD','INR','PKR']);
const spreadReference={narrowBelow:20,wideAbove:75},compaZones=[[.8,'well-below'],[.95,'below'],[1.05,'at'],[1.2,'above'],[Infinity,'well-above']];
function diagnostics(minimum,midpoint,maximum){const spread=(maximum-minimum)/minimum*100,centre=(minimum+maximum)/2,offset=(midpoint-centre)/centre*100;return {rangeSpreadPercent:round(spread,1),spreadAssessment:spread<20?'narrow':spread>75?'wide':'common',midpointOffsetPercent:round(offset,1),midpointCentred:Math.abs(offset)<=2,reference:{...spreadReference,status:'illustrative-review-triggers-not-a-market-standard'}};}
function quartile(current,minimum,maximum){if(current===null)return null;if(current<minimum)return 'below-minimum';if(current>maximum)return 'above-maximum';const p=(current-minimum)/(maximum-minimum);return p<=.25?'Q1':p<=.5?'Q2':p<=.75?'Q3':'Q4';}
const saudiSources=[{id:'gosi-new',url:'https://awareness.gosi.gov.sa/businessJourney.html',checkedOn:'2026-10-05'},{id:'gosi-saned',url:'https://www.gosi.gov.sa/GOSIOnline/News',checkedOn:'2026-10-05',effectiveFrom:'2022-01-01'},{id:'gosi-existing',url:'https://www.gosi.gov.sa/GOSIOnline/FAQ_Employer',checkedOn:'2026-10-05'},{id:'eos',url:'https://www.hrsd.gov.sa/en/knowledge-centre/articles/317-0',checkedOn:'2026-10-05'}];
// GOSI separates the new system's eligibility date (3 July 2024) from rate
// changes (1 July). The bounded planning horizon is not an expiry of the law.
const saudiRatePolicy={checkedOn:'2026-10-05',systemEffectiveDate:'2024-07-03',supportedThrough:'2028-12-31',newPensionStages:[{effectiveFrom:'2024-07-03',rate:9},{effectiveFrom:'2025-07-01',rate:9.5},{effectiveFrom:'2026-07-01',rate:10},{effectiveFrom:'2027-07-01',rate:10.5},{effectiveFrom:'2028-07-01',rate:11}]};
// Annualization holds the selected month's rates and wages constant; it is not a future-year forecast.
function saudiCost(salary,period,raw={}){
 salary=Number(salary);if(!Number.isFinite(salary)||salary<=0)throw Error('Salary must be a positive finite number');if(!['monthly','annual'].includes(period))throw Error('Choose monthly or annual salary');
 if(raw.applicabilityConfirmed!==true)throw invalid('Confirm GOSI registration regime and wage components against the employee record','applicability');
 const asOf=String(raw.asOf||''),date=new Date(asOf+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==asOf||asOf<saudiRatePolicy.systemEffectiveDate||asOf>saudiRatePolicy.supportedThrough)throw invalid('Choose a valid GOSI calculation date from '+saudiRatePolicy.systemEffectiveDate+' through '+saudiRatePolicy.supportedThrough+'; later dates need a source review','asof');
 const regime=raw.regime;if(!['saudi-existing','saudi-new','non-saudi'].includes(regime))throw invalid('Choose a verified GOSI regime; GCC extension and special cases require specialist calculation','regime');
 if(typeof raw.sanedEligible!=='boolean'&&regime!=='non-saudi')throw invalid('Confirm SANED applicability from the employee record','saned');
 const monthlyBasic=period==='monthly'?salary:salary/12,housingMonthly=num(raw.housingMonthly,'Monthly cash housing',{zeroWhenBlank:true}),otherMonthly=num(raw.otherMonthly,'Other monthly cash',{zeroWhenBlank:true}),contributoryExtra=num(raw.contributoryExtraMonthly,'Additional GOSI contributory monthly pay',{zeroWhenBlank:true}),medicalAnnual=num(raw.medicalAnnual,'Annual medical cost',{zeroWhenBlank:true}),serviceYears=num(raw.serviceYears,'Completed service years',{max:60});
 // Cash housing only; in-kind housing and commissions require reviewed inclusion in contributoryExtraMonthly.
 const contributoryWage=Math.min(45000,monthlyBasic+housingMonthly+contributoryExtra);
 const pensionStage=saudiRatePolicy.newPensionStages.filter(x=>asOf>=x.effectiveFrom).at(-1);const pensionRate=regime==='non-saudi'?0:regime==='saudi-existing'?9:pensionStage.rate;
 const sanedRate=regime==='non-saudi'||!raw.sanedEligible?0:.75,occupationalRate=2,rate=pensionRate+sanedRate+occupationalRate;
 const monthlyCash=monthlyBasic+housingMonthly+otherMonthly;
 const enteredEos=num(raw.eosWageMonthly,'EOS monthly wage',{min:.01,blank:true}),eosWage=enteredEos===null?monthlyCash:enteredEos;
 const earnedMonths=y=>Math.min(y,5)*.5+Math.max(0,y-5);
 const eosServiceAccrual=eosWage*(earnedMonths(serviceYears+1)-earnedMonths(serviceYears));
 const gosiAnnual=contributoryWage*rate/100*12,annualGuaranteedCash=monthlyCash*12;
 const source=saudiSources.find(x=>x.id===(regime==='saudi-new'?'gosi-new':'gosi-existing'));
 // Legacy branches do not invent a legal start date absent from the cited source.
 const gosiComponents=[{id:'pension',rate:pensionRate,effectiveFrom:regime==='saudi-new'?pensionStage.effectiveFrom:null},{id:'saned',rate:sanedRate,effectiveFrom:regime==='saudi-new'?'2024-07-03':'2022-01-01'},{id:'occupational',rate:occupationalRate,effectiveFrom:regime==='saudi-new'?'2024-07-03':null}].map(x=>({...x,monthlyBase:round(contributoryWage),monthlyAmount:round(contributoryWage*x.rate/100),annualAmount:round(contributoryWage*x.rate/100*12),appliedAsOf:asOf,source:x.id==='saned'?saudiSources.find(s=>s.id===(regime==='saudi-new'?'gosi-new':'gosi-saned')):source,sourceEffectiveDateKnown:x.effectiveFrom!==null}));
 return {mode:'saudi',asOf,regime,monthlyBasic:round(monthlyBasic),housingMonthly,otherMonthly,contributoryExtraMonthly:contributoryExtra,contributoryWage:round(contributoryWage),ceiling:45000,pensionRate,sanedRate,occupationalRate,employerRatePercent:rate,gosiComponents,annualGosi:round(gosiAnnual),medicalAnnual,serviceYears,eosWageMonthly:round(eosWage),annualEosServiceAccrual:round(eosServiceAccrual),annualGuaranteedCash:round(annualGuaranteedCash),annualEmployerCost:round(annualGuaranteedCash+gosiAnnual+medicalAnnual+eosServiceAccrual),rateReview:{checkedOn:saudiRatePolicy.checkedOn,systemEffectiveDate:saudiRatePolicy.systemEffectiveDate,supportedThrough:saudiRatePolicy.supportedThrough},sources:saudiSources,notice:'Private-sector planning for confirmed standard registration only. Cash housing plus reviewed contributory additions, capped at SAR 45,000. Annualized at selected-date rates, not a blended calendar-year budget; no employee deductions added. Reviewed calculation-date horizon ends '+saudiRatePolicy.supportedThrough+'; this is not a legal expiry. EOS is one further year of service at unchanged wage, not termination entitlement or an IAS 19 actuarial liability. Excludes exceptional coverage and unentered costs.'};
}
function evaluate(raw){
 if(String(raw.rosterCsv||'').trim())return evaluateRoster({...raw,rosterCsv:'',incumbents:parseRoster(raw.rosterCsv,raw.rosterIdPolicy)});
 if(Array.isArray(raw.incumbents)&&raw.incumbents.length)return evaluateRoster(raw);
 const positionId=String(raw.positionId||'').trim().slice(0,100),revision=positionId?num(raw.revision,'Position revision',{min:1,max:1000000}):null;if(positionId&&(!Number.isInteger(revision)||!String(raw.grade||'').trim()))throw invalid('A linked compensation scenario needs the position revision and evaluated grade','grade');
 const currency=String(raw.currency??'').trim().toUpperCase();if(!currency)throw invalid('Currency is required; enter a recognized currency code','currency');if(!currencyCodes.has(currency)||['XXX','XTS'].includes(currency))throw invalid('Currency must be a recognized currency code','currency');
 const minimum=positive(raw.bandMin,'Band minimum'),midpoint=positive(raw.bandMid,'Band midpoint'),maximum=positive(raw.bandMax,'Band maximum');if(!(minimum<midpoint&&midpoint<maximum))throw invalid('Salary band must satisfy minimum < midpoint < maximum','mid');
 const source=String(raw.bandSource||'').trim();if(source.length<5)throw invalid('Provide the organization salary-band source or rationale','source');
 const period=raw.period||'monthly';if(!['monthly','annual'].includes(period))throw Error('Choose monthly or annual salary');
 const periods=period==='monthly'?12:1,payBasis=raw.payBasis||'basic';if(!['basic','total'].includes(payBasis))throw Error('Choose basic or total cash pay');
 const headcount=num(raw.headcount,'Headcount',{min:1,max:10000});if(!Number.isInteger(headcount))throw invalid('Headcount must be a whole number','headcount');
 const current=positive(raw.currentSalary,'Current / reference salary',true),oncost=num(raw.oncostPercent,'Employer on-cost',{min:0,max:200})/100;
 const enteredAllowances=num(raw.allowancesPercent,'Fixed allowances',{min:0,max:200,blank:true}),allowances=payBasis==='total'||enteredAllowances===null?0:enteredAllowances/100;
 const warnings=[];
 // These are unit-check triggers, never salary market benchmarks or statutory floors.
 if(period==='annual'&&currency==='SAR'&&midpoint<120000)warnings.push('annual-period-check');
 if(maximum/minimum>10||headcount>1000)warnings.push('scale-check');
 if(warnings.length&&raw.unitsConfirmed!==true)throw invalid('Verify salary period and scale, then confirm the units; these are data-entry checks, not market benchmarks','units');
 const targetCompa=num(raw.targetCompaPercent??100,'Target compa-ratio',{min:1,max:300})/100,target=midpoint*targetCompa;
 if(target<minimum||target>maximum)throw invalid('Target from approved midpoint must fall within the entered salary band','target');
 const progression=raw.progressionEnabled===true,policy=String(raw.progressionPolicy||'').trim(),evidence=String(raw.progressionEvidence||'').trim();
 if(progression&&(raw.progressionApproved!==true||policy.length<10||evidence.length<10))throw invalid('Optional progression requires an approved policy reference and individual performance or experience evidence',raw.progressionApproved!==true?'approved':policy.length<10?'policy':'evidence');
 const baseline=current===null?target:Math.max(current,minimum),recommended=current===null?target:progression?Math.max(baseline,target):baseline;
 const adjust=current===null?null:recommended-current,toMinimum=current===null?null:Math.max(0,minimum-current),optionalProgression=current===null?null:recommended-baseline;
 const detailed=raw.employerCosts?.mode==='saudi';if(detailed&&(currency!=='SAR'||payBasis!=='basic'||oncost!==0||allowances!==0))throw invalid('Saudi breakdown requires SAR basic pay and zero generic allowance/on-cost percentages to prevent double counting',currency!=='SAR'?'currency':payBasis!=='basic'?'basis':oncost!==0?'oncost':'allowances');
 const cost=salary=>detailed?saudiCost(salary,period,raw.employerCosts):{mode:'percentage',annualGuaranteedCash:salary*periods*(1+allowances),annualEmployerCost:salary*periods*(1+allowances)*(1+oncost)};
 const proposedCost=cost(recommended),currentCost=current===null?null:cost(current),minimumCost=current===null?null:cost(baseline);
 const compa=current===null?null:current/midpoint,penetration=(target-minimum)/(maximum-minimum),currentPen=current===null?null:(current-minimum)/(maximum-minimum);
 const payAction=current===null?'new-position':current>maximum?'red-circle':current<minimum?'below-band':optionalProgression>0?'increase':'hold';
 return {schema:'miyar-compensation-scenario/1.0',calculationVersion:'6.3.0',status:'organization-band-scenario-not-market-benchmark',createdAt:new Date().toISOString(),input:{payBasis,positionId,revision,bandBinding:positionId&&raw.bandBinding?.positionId===positionId&&Number(raw.bandBinding.revision)===revision?{positionId,revision,grade:String(raw.bandBinding.grade||''),source:String(raw.bandBinding.source||'').slice(0,1000),midpointBasis:String(raw.bandBinding.midpointBasis||''),salaryMin:Number(raw.bandBinding.salaryMin),salaryMax:Number(raw.bandBinding.salaryMax)}:null,jobFamily:String(raw.jobFamily||'').slice(0,100),role:String(raw.role||'').trim().slice(0,300),grade:String(raw.grade||'').trim().slice(0,100),headcount,bandMin:minimum,bandMid:midpoint,bandMax:maximum,currency,period,bandSource:source.slice(0,1000),targetCompaPercent:round(targetCompa*100,2),targetPenetrationPercent:round(penetration*100,2),currentSalary:current,oncostPercent:round(oncost*100,2),allowancesPercent:enteredAllowances,allowancesApplied:allowances>0,progressionEnabled:progression,progressionApproved:raw.progressionApproved===true,progressionPolicy:policy,progressionEvidence:evidence,unitsConfirmed:raw.unitsConfirmed===true,employerCosts:detailed?{...raw.employerCosts}:null},result:{targetSalary:round(target),recommendedSalary:round(recommended),payAction,bandStatus:current===null?'unknown':current>maximum?'above-maximum':current<minimum?'below-minimum':'within-band',compaRatio:compa===null?null:round(compa,3),compaZone:compa===null?null:compaZones.find(([limit])=>compa<limit)[1],currentQuartile:quartile(current,minimum,maximum),currentRangePenetrationPercent:currentPen===null?null:round(currentPen*100,1),adjustmentPerFte:adjust===null?null:round(adjust),adjustmentPercent:adjust===null?null:round(adjust/current*100,1),minimumAdjustmentPerFte:toMinimum===null?null:round(toMinimum),optionalProgressionPerFte:optionalProgression===null?null:round(optionalProgression),annualMinimumAdjustmentCost:current===null?null:round((minimumCost.annualEmployerCost-currentCost.annualEmployerCost)*headcount),annualOptionalProgressionCost:current===null?null:round((proposedCost.annualEmployerCost-minimumCost.annualEmployerCost)*headcount),annualBasePayroll:round(recommended*periods*headcount),annualGuaranteedCash:round(proposedCost.annualGuaranteedCash*headcount),annualEmployerCost:round(proposedCost.annualEmployerCost*headcount),annualBaseAdjustmentCost:adjust===null?null:round(adjust*periods*headcount),annualAdjustmentCost:current===null?null:round((proposedCost.annualEmployerCost-currentCost.annualEmployerCost)*headcount)},employerBreakdown:{...proposedCost,perPerson:true},review:{warnings,unitsConfirmed:raw.unitsConfirmed===true,scope:headcount>1?'homogeneous-cohort-assumption':'individual'},bandDiagnostics:diagnostics(minimum,midpoint,maximum),referencePoints:{minimum,midpoint,maximum,p25:round(minimum+.25*(maximum-minimum)),p50:round(minimum+.5*(maximum-minimum)),p75:round(minimum+.75*(maximum-minimum)),q1:round(minimum+.25*(maximum-minimum)),q3:round(minimum+.75*(maximum-minimum))},calculationNotice:'Within-band pay is held unless individual progression is explicitly justified under an approved policy. Below-band correction is an organization-policy proposal, not an assertion of statutory minimum pay. No automatic reductions. New-position midpoint is a budgeting assumption, not an approved offer. Compa-ratio is position, not performance. Range quartiles are not market percentiles.',notice:'Uses only the organization-provided salary band. This is not a live market benchmark, pay-equity conclusion or compensation approval.'};
}
// Pattern screening is a minimization guard, not full name recognition or a
// claim of anonymization. Never reflect the rejected value in an error.
function privacyText(value){return String(value??'').normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g,'').replace(/[\u0660-\u0669\u06F0-\u06F9]/g,c=>String(c.charCodeAt(0)-(c<='\u0669'?0x660:0x6f0)));}
const givenNames=new Set(('mohammed muhammad mohammad mohammed ahmed ahmad mahmoud abdullah abdallah abdulrahman abdulaziz ibrahim faisal fares faris khalid khaled salman sultan omar omer yousef yusuf amir sami samer majed naif meshal turki nasser salem hassan hussein ali adeeb fatima fatimah aisha aishah maryam mariam noura nora sara sarah reem huda maha hind john jane james mary robert david michael william joseph charles elizabeth jennifer linda patricia محمد احمد أحمد محمود عبدالله عبدالرحمن عبدالعزيز ابراهيم إبراهيم فيصل فارس خالد سلمان سلطان عمر يوسف امير أمير سامي سامر ماجد نايف مشعل تركي ناصر سالم حسين علي أديب اديب فاطمة عائشة مريم نورة سارة ريم هدى مها هند').split(' '));
function privacyPattern(value,{identifier=false}={}){
 const text=privacyText(value).trim();
 if(identifier&&/^5\d{8}$/.test(text))return 'mobile';
 if(identifier&&(/^[A-Z]{1,2}\d{7,8}$/i.test(text)||/PASSPORT/i.test(text)))return 'passport';
 const jobWords=new Set('pos position senior junior accountant analyst grade dept department finance hr role manager officer specialist assistant clerk coordinator supervisor director executive engineer technician staff employee emp'.split(' '));
 const functionalId=identifier&&text.split(/[_ -]+/).every(w=>jobWords.has(w.toLowerCase()));
 if(/[12]\d{9}/.test(text)||/(?:^|\D)[12]\d{2}[ -]\d{3}[ -]\d{4}(?:\D|$)/.test(text))return 'national-id-or-iqama';
 // Separate mobile groups are common; do not join every number in narrative
 // evidence, which would turn dates, scores or durations into false ID hits.
 if(/(?:0[ \t().-]*5|966[ \t().-]*5)(?:[ \t().-]*\d){8}/.test(text))return 'mobile';
 if(/[^\s<>@]+@[^\s<>@]+\.[\p{L}\d-]{2,}/u.test(text))return 'email';
 if(identifier&&!functionalId&&/^[\p{L}\p{M}]+(?:[_ -][\p{L}\p{M}]+)+$/u.test(text.trim()))return 'name-like-identifier';
 const words=text.replace(/[\u064B-\u065F\u0670]/g,'').match(/[\p{L}]+/gu)||[];
 if(words.some(word=>givenNames.has(word.toLowerCase())))return identifier?'name-like-identifier':'personal-name';
 return null;
}
function privacyError(row,pattern,csv=false){const error=Error('Roster'+(csv?' CSV':'')+' row '+row+': '+pattern+' pattern is not allowed; use pseudonymous IDs and de-identified evidence');error.code='ROSTER_PRIVACY';error.row=row;error.pattern=pattern;return error;}
function screenRosterValue(value,row,{identifier=false,csv=false}={}){
 if(typeof value==='string'||identifier){const pattern=privacyPattern(value,{identifier});if(pattern)throw privacyError(row,pattern,csv);}
 else if(value&&typeof value==='object')for(const [key,entry] of Object.entries(value)){const keyPattern=privacyPattern(key);if(keyPattern)throw privacyError(row,keyPattern,csv);screenRosterValue(entry,row,{csv});}
}
function idPolicy(raw){
 if(raw===null||raw===undefined)return null;
 if(typeof raw!=='object'||Array.isArray(raw)||!/^([A-Za-z]{1,12})[-_]?$/.test(String(raw.prefix||''))||!Number.isInteger(raw.digits)||raw.digits<1||raw.digits>12||Object.keys(raw).some(k=>!['prefix','digits'].includes(k)))throw Error('Organization pseudonym policy needs a letters-only prefix, optional dash/underscore, and 1–12 digits');
 return {prefix:String(raw.prefix),digits:raw.digits};
}
const employerCostColumns=['mode','applicabilityConfirmed','regime','asOf','sanedEligible','housingMonthly','otherMonthly','contributoryExtraMonthly','medicalAnnual','serviceYears','eosWageMonthly'];
const cleanCosts=value=>value&&typeof value==='object'?Object.fromEntries(employerCostColumns.filter(k=>Object.prototype.hasOwnProperty.call(value,k)).map(k=>[k,value[k]])):null;
function validatedId(value,row,policy,csv=false){
 screenRosterValue(value,row,{identifier:true,csv});const id=privacyText(value).trim();
 if(!/^[A-Za-z0-9_-]{1,40}$/.test(id))throw Error('Roster'+(csv?' CSV':'')+' row '+row+': use pseudonymous IDs with letters, digits, dash or underscore');
 if(policy&&(id.slice(0,policy.prefix.length)!==policy.prefix||!new RegExp('^\\d{'+policy.digits+'}$').test(id.slice(policy.prefix.length))))throw Error('Roster'+(csv?' CSV':'')+' row '+row+': ID does not match the configured organization pseudonym format');
 return id;
}
function evaluateRoster(raw){
 if(raw.incumbents.length>500)throw Error('Roster limit is 500 people');
 const policy=idPolicy(raw.rosterIdPolicy),ids=new Set(),cleanRows=[],globalCosts=cleanCosts(raw.employerCosts);
 for(const key of ['role','grade','bandSource','progressionPolicy','progressionEvidence','employerCosts'])screenRosterValue(raw[key],1);
 const incumbents=raw.incumbents.map((row,index)=>{
  const rowNumber=index+1;screenRosterValue(row,rowNumber);const id=validatedId(row.id||'',rowNumber,policy),idKey=id.toUpperCase();if(ids.has(idKey))throw Error('Roster row '+rowNumber+': use unique pseudonymous roster IDs');ids.add(idKey);
  if(Object.keys(row).some(k=>!['id','currentSalary','progressionEligible','progressionEvidence','employerCosts','grade','managerId','managerSalary','bandMin','bandMid','bandMax','bandSource'].includes(k)))throw Error('Roster row '+rowNumber+': unsupported roster column; use the roster template');
  if(row.employerCosts&&Object.keys(row.employerCosts).some(k=>!employerCostColumns.includes(k)))throw Error('Roster row '+rowNumber+': unsupported employer-cost column');
  if(row.currentSalary===null||row.currentSalary===undefined||String(row.currentSalary).trim()==='')throw Error('Each incumbent needs an actual salary; blank is not zero');
  const employerCosts=globalCosts?.mode==='saudi'?{...globalCosts,...cleanCosts(row.employerCosts)}:null;
  const managerId=String(row.managerId||'').trim()?validatedId(row.managerId,rowNumber,policy):null,managerSalary=positive(row.managerSalary,'Manager salary',true);
  if(managerId&&managerId.toUpperCase()===idKey)throw Error('Roster row '+rowNumber+': an incumbent cannot be their own manager');
  const ownBand=['bandMin','bandMid','bandMax'].some(k=>row[k]!==undefined&&String(row[k]).trim()!=='');
  if(ownBand&&(['bandMin','bandMid','bandMax','bandSource'].some(k=>row[k]===undefined||!String(row[k]).trim())))throw Error('Roster row '+rowNumber+': individual grade bands need minimum, midpoint, maximum and source');
  const band=ownBand?{bandMin:row.bandMin,bandMid:row.bandMid,bandMax:row.bandMax,bandSource:row.bandSource}:{};
  const v=evaluate({...raw,...band,grade:String(row.grade||raw.grade||'').trim(),incumbents:undefined,headcount:1,currentSalary:row.currentSalary,progressionEnabled:raw.progressionEnabled===true&&row.progressionEligible===true,progressionEvidence:row.progressionEvidence||'',employerCosts});
  const cleanRow={id,currentSalary:v.input.currentSalary,progressionEligible:row.progressionEligible===true,progressionEvidence:v.input.progressionEvidence,grade:v.input.grade,managerId,managerSalary,...(ownBand?{bandMin:v.input.bandMin,bandMid:v.input.bandMid,bandMax:v.input.bandMax,bandSource:v.input.bandSource}:{})};if(row.employerCosts)cleanRow.employerCosts=cleanCosts(row.employerCosts);cleanRows.push(cleanRow);
  return {id,managerId,managerSalary,input:v.input,result:v.result,employerBreakdown:v.employerBreakdown};
 });
 const first=evaluate({...raw,incumbents:undefined,headcount:1,currentSalary:incumbents[0].input.currentSalary,progressionEnabled:false,employerCosts:incumbents[0].input.employerCosts});
 const sums=['annualMinimumAdjustmentCost','annualOptionalProgressionCost','annualBasePayroll','annualGuaranteedCash','annualEmployerCost','annualBaseAdjustmentCost','annualAdjustmentCost'];
 first.input={...first.input,headcount:incumbents.length,currentSalary:null,progressionEnabled:raw.progressionEnabled===true,incumbents:cleanRows,progressionEvidence:'',employerCosts:globalCosts,rosterIdPolicy:policy};
 for(const k of sums)first.result[k]=round(incumbents.reduce((sum,x)=>sum+x.result[k],0));
 for(const k of ['recommendedSalary','compaRatio','compaZone','currentQuartile','currentRangePenetrationPercent','adjustmentPerFte','adjustmentPercent','minimumAdjustmentPerFte','optionalProgressionPerFte'])first.result[k]=null;
 first.result.payAction='roster-review';first.result.bandStatus='individual-results';first.incumbents=incumbents;first.employerBreakdown=null;first.review.scope='actual-incumbent-roster';first.rosterDiagnostics=rosterDiagnostics(incumbents);
 return first;
}
function rosterDiagnostics(incumbents){
 const compressionThreshold=.9,byId=new Map(incumbents.map(x=>[x.id.toUpperCase(),x])),compression=[],unresolvedManagers=[],groups=new Map();
 for(const person of incumbents){
  const grade=person.input.grade||'unspecified';if(!groups.has(grade))groups.set(grade,[]);groups.get(grade).push(person);
  const manager=person.managerId?byId.get(person.managerId.toUpperCase()):null,managerSalary=manager?.input.currentSalary??person.managerSalary;
  if(person.managerId&&!manager&&!managerSalary){unresolvedManagers.push({id:person.id,managerId:person.managerId});continue;}
  if(managerSalary){const ratio=person.input.currentSalary/managerSalary;if(ratio>=compressionThreshold)compression.push({id:person.id,managerId:person.managerId,employeeSalary:person.input.currentSalary,managerSalary,ratio:round(ratio,3),status:ratio>=1?'salary-inversion':'salary-compression'});}
 }
 const byGrade=[...groups].map(([grade,rows])=>{const ratios=rows.map(x=>x.input.currentSalary/x.input.bandMid),mean=ratios.reduce((a,b)=>a+b,0)/ratios.length,std=Math.sqrt(ratios.reduce((sum,x)=>sum+(x-mean)**2,0)/ratios.length);return {grade,count:rows.length,meanCompaRatio:round(mean,3),minCompaRatio:round(Math.min(...ratios),3),maxCompaRatio:round(Math.max(...ratios),3),standardDeviation:round(std,3),coefficientOfVariationPercent:round(std/mean*100,1),outOfBand:rows.filter(x=>x.result.bandStatus!=='within-band').map(x=>({id:x.id,status:x.result.bandStatus,salary:x.input.currentSalary,minimum:x.input.bandMin,maximum:x.input.bandMax})),dispersionReview:rows.length>1&&std/mean>=.15};});
 return {compressionThresholdPercent:90,dispersionThresholdPercent:15,compression,unresolvedManagers,byGrade,notice:'Review triggers only. Salary proximity and within-grade dispersion do not establish discrimination or entitlement; compare scope, experience and approved pay policies.'};
}
// Strict, small CSV contract: fixed columns avoid silently dropping employee attributes.
const rosterColumns=['id','currentSalary','grade','managerId','managerSalary','bandMin','bandMid','bandMax','bandSource','progressionEligible','progressionEvidence','regime','housingMonthly','otherMonthly','contributoryExtraMonthly','medicalAnnual','serviceYears','sanedEligible','eosWageMonthly'];
const rosterNumericColumns=new Set(['currentSalary','managerSalary','bandMin','bandMid','bandMax','housingMonthly','otherMonthly','contributoryExtraMonthly','medicalAnnual','serviceYears','eosWageMonthly']);
const rosterNumber=value=>privacyText(value).replace(/[,٬]/g,'').replace(/٫/g,'.');
function parseRoster(text,rawPolicy){
 if(String(text).length>250000)throw Error('Roster CSV exceeds 250 KB');
 const policy=idPolicy(rawPolicy);
 const lines=String(text).replace(/^\uFEFF/,'').trim().split(/\r?\n/),headerLine=lines.shift(),delimiter=headerLine.includes(';')?';':',';
 function cellsOf(line){const cells=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='\"'){if(quoted&&line[i+1]==='\"'){value+='\"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){cells.push(value.trim());value='';}else value+=c;}if(quoted)throw Error('Unclosed CSV quote');cells.push(value.trim());return cells;}
 const headers=cellsOf(headerLine).map(x=>rosterColumns.find(c=>c.toLowerCase()===x.toLowerCase())||x);
 if(!headers.includes('id')||!headers.includes('currentSalary')||headers.some(x=>!rosterColumns.includes(x))||new Set(headers).size!==headers.length)throw Error('Use the roster CSV template headers; names, email and national IDs are not needed');
 if(lines.length<1||lines.length>500)throw Error('Roster needs 1–500 rows');
 return lines.map((line,index)=>{
  const rowNumber=index+2,cells=cellsOf(line);if(cells.length!==headers.length)throw Error('Invalid roster CSV row '+rowNumber);
  const v=Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));
  // Screen the original cells before normalizing numeric fields for arithmetic.
  for(const h of headers)screenRosterValue(v[h],rowNumber,{identifier:h==='id'||h==='managerId',csv:true});
  v.id=validatedId(v.id,rowNumber,policy,true);
  for(const h of headers)if(rosterNumericColumns.has(h))v[h]=rosterNumber(v[h]);
  const bool=k=>{if(!['','true','false'].includes(v[k]??''))throw Error('Use true or false in '+k+' at row '+rowNumber);return v[k]==='true';};
  const row={id:v.id,currentSalary:v.currentSalary,progressionEligible:bool('progressionEligible'),progressionEvidence:v.progressionEvidence||''};for(const h of ['grade','managerId','managerSalary','bandMin','bandMid','bandMax','bandSource'])if(v[h]!==undefined&&v[h]!=='')row[h]=h==='managerId'?validatedId(v[h],rowNumber,policy,true):v[h];
  // Only entered columns override the verified scenario defaults; missing CSV
  // components must not become undefined or silently discard provided costs.
  const costHeaders=headers.filter(h=>employerCostColumns.includes(h)&&(h!=='regime'||v[h]!==''));
  if(costHeaders.length)row.employerCosts=Object.fromEntries(costHeaders.map(h=>[h,h==='sanedEligible'?bool(h):v[h]]));
  return row;
 });
}
const exampleAr={role:'مدير مشاريع وعمليات رأس المال البشري',grade:'G11 · مدير',bandSource:'نطاق توضيحي للجهة — استبدله بمصدر إدارة التعويضات المعتمد'};
const example={role:'Human Capital Projects & Operations Manager',grade:'G11 · Manager',headcount:1,currency:'SAR',period:'monthly',bandSource:'Illustrative organization band — replace with the approved Total Rewards source before use',bandMin:24000,bandMid:30000,bandMax:36000,targetCompaPercent:100,currentSalary:'',oncostPercent:15,allowancesPercent:'',progressionEnabled:false};
 root.MiyarCompensation={evaluate,example,exampleAr,spreadReference,saudiCost,parseRoster,rosterColumns,saudiRatePolicy,privacyPattern,rosterDiagnostics};if(typeof module!=='undefined')module.exports=root.MiyarCompensation;
})(typeof window!=='undefined'?window:globalThis);
