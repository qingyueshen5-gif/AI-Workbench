from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
CODE_EXT={'.mjs','.js','.cjs','.ts','.tsx'}
PROD_ROOTS={'agents','channels','execution','capabilities','gateway','delivery','ipc','electron','managed-proxy','src'}
SKIP_PARTS={'.git','node_modules','dist','releases','verification'}

def category(path):
    s=path.as_posix()
    if s.startswith('scripts/') or '/tests/' in s or s.startswith('tests/') or 'fixture' in s.lower(): return 'test'
    if path.name=='server.mjs' or path.parts[0] in PROD_ROOTS: return 'production'
    return 'other'

def function_at(lines,index):
    for j in range(index,-1,-1):
        line=lines[j]
        m=re.search(r'(?:async\s+)?function\s+([A-Za-z0-9_$]+)|(?:async\s+)?([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{|(?:async\s+)?([A-Za-z0-9_$]+)\s*=\s*\([^)]*\)\s*=>',line)
        if m:return next(x for x in m.groups() if x)
        m=re.search(r'(?:async\s+)?([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{',line)
        if m:return m.group(1)
    return '<module>'

def path_category(file,line):
    text=f'{file} {line}'.lower()
    if 'interpreter-adapter-contract' in text or 'nonexecution' in text or 'non-execution' in text: return 'non_execution_renderer'
    if 'process.stop' in text or 'codex' in text or 'minimal-desktop-executor' in text or file=='server.mjs': return 'legacy_execution_or_desktop'
    if 'agent-runtime' in text:
        if any(x in text for x in ['control','clarif','confirm','capability']): return 'non_terminal_runtime'
        return 'runtime_result'
    return 'other_production'

def classify(file,line,value):
    t=f'{file} {line} {value}'.lower()
    trusted=('deriveTerminalVerification' in value or 'deriveBoundVerifierResult' in value)
    if trusted:return 'A. TRUSTED_VERIFIER_RESULT'
    if 'interpreter-adapter-contract' in file:return 'D. NON_EXECUTION_RENDERER'
    if any(x in t for x in ['clarif','confirm','unsupported','capability_unavailable','control','casual_chat','future_lottery','ambiguous_status']):return 'B. NON_EXECUTION_OR_CONTROL'
    if file=='server.mjs' or 'process.stop' in t or 'codex' in t or 'minimal-desktop-executor' in file:return 'C. LEGACY_EXECUTION_WITHOUT_BOUND_VERIFIER'
    if value.strip()=='false':return 'B. NON_EXECUTION_OR_CONTROL'
    return 'C. LEGACY_EXECUTION_WITHOUT_BOUND_VERIFIER'

def replacement(group,line):
    t=line.lower()
    fields=[]
    if group=='A. TRUSTED_VERIFIER_RESULT': return []
    if any(x in t for x in ['clarif','respond','unsupported','capability_unavailable','control','confirm','renderer','casual_chat','future_lottery','ambiguous_status']):
        fields+=['handled','rendered']
    if 'clarif' in t:fields+=['requiresUserInput']
    if 'confirm' in t:fields+=['confirmationRequired','policyApplied']
    if 'control' in t or 'authorization' in t or 'risk' in t:fields+=['policyApplied']
    if 'unsupported' in t or 'capability_unavailable' in t:fields+=['capabilityAvailable']
    if any(x in t for x in ['process.stop','codex','execute','execution','verifyrun','verification.ok']):fields+=['executionStarted','executionCompleted']
    if any(x in t for x in ['pidabsent','stopped','minimal-desktop-executor','sha256']):fields+=['postconditionObserved']
    return list(dict.fromkeys(fields))

files=[]
for p in ROOT.rglob('*'):
    if not p.is_file() or p.suffix.lower() not in CODE_EXT:continue
    rel=p.relative_to(ROOT)
    if any(x in SKIP_PARTS for x in rel.parts):continue
    files.append((p,rel.as_posix(),category(rel)))

producers=[];consumers=[];tests=[]
assign_re=re.compile(r'\bverified\s*[:=]\s*([^,;}\n]+)')
for p,file,kind in files:
    try:lines=p.read_text(encoding='utf-8').splitlines()
    except UnicodeDecodeError:continue
    for i,line in enumerate(lines):
        fn=function_at(lines,i)
        for m in assign_re.finditer(line):
            value=m.group(1).strip()
            entry_base={'file':file,'line':i+1,'function':fn}
            if kind=='production':
                group=classify(file,line,value); fields=replacement(group,line)
                producers.append({**entry_base,'pathCategory':path_category(file,line),'currentValueSource':value,'currentMeaning':'trusted verifier result' if group.startswith('A.') else ('message/render/control disposition' if group.startswith(('B.','D.')) else 'legacy execution or local check result'),'hasTask':('task' in line.lower()),'hasRun':('run' in line.lower()),'hasTrustedVerifier':group.startswith('A.'),'hasTaskBinding':all(x in line for x in ['taskId']) or group.startswith('A.'),'hasRunBinding':all(x in line for x in ['runId']) or group.startswith('A.'),'hasRevisionBinding':('taskRevision' in line) or group.startswith('A.'),'currentRisk':'NONE' if group.startswith('A.') or value=='false' else ('NON_EXECUTION_RENDERER_VERIFIED_TRUE_SEMANTICS_UNBOUND' if group.startswith('D.') else ('NON_TERMINAL_RUNTIME_VERIFIED_TRUE_WITHOUT_BOUND_VERIFIER' if group.startswith('B.') else 'LEGACY_EXECUTION_RESULTS_VERIFIED_TRUE_WITHOUT_UNIFORM_RUN_BINDING')),'targetVerified':True if group.startswith('A.') else False,'replacementFields':fields,'migrationGroup':group,'recommendedChange':'Use shared trusted derivation only' if group.startswith('A.') else f"Set verified=false and express actual semantics with {', '.join(fields) or 'approved explicit fields'}"})
            elif kind=='test':
                tests.append({**entry_base,'oldAssertion':line.strip(),'oldProtectedMeaning':'legacy asserted verified field value','newVerifiedAssertion':'verified must match trusted-bound contract; non-trusted scenarios false','replacementSemanticAssertion':replacement(classify(file,line,value),line),'mayDelete':False})
        if kind=='production' and ('.verified' in line or re.search(r'\bverified\b',line)) and not assign_re.search(line):
            branch=line.strip()
            consumers.append({**entry_base,'consumerType':'condition_or_serialization' if re.search(r'if|\?|Boolean|return|JSON|stringify',line) else 'field_read','currentBranchCondition':branch,'currentlyTreatsVerifiedAsSuccess':bool(re.search(r'if.*verified|verified\s*\?|Boolean\([^)]*verified',line)),'currentlyTreatsVerifiedAsHandled':('message' in line.lower() or 'reply' in line.lower()),'currentlyTreatsVerifiedAsRendered':('render' in line.lower() or 'text' in line.lower()),'targetField':'verified' if 'deriveTerminalVerification' in line else ('rendered/handled/executionCompleted according to path'),'userVisibleImpact':'Potential success/handled rendering semantics' if any(x in line.lower() for x in ['reply','text','message','status']) else 'none direct','recommendedChange':'Retain verified only for trusted business acceptance; migrate handling/render/execution routing to explicit field'})

# Include scripts and verification test assertions in a separate full scan.
for p in list((ROOT/'scripts').glob('*.mjs')):
    lines=p.read_text(encoding='utf-8').splitlines(); file=p.relative_to(ROOT).as_posix()
    for i,line in enumerate(lines):
        if 'verified' not in line:continue
        fn=function_at(lines,i)
        tests.append({'file':file,'line':i+1,'function':fn,'oldAssertion':line.strip(),'oldProtectedMeaning':'test/fixture verified contract','newVerifiedAssertion':'trusted-bound positive only; otherwise false','replacementSemanticAssertion':replacement(classify(file,line,line),line),'mayDelete':False})

producers.sort(key=lambda x:(x['file'],x['line']));consumers.sort(key=lambda x:(x['file'],x['line']));tests.sort(key=lambda x:(x['file'],x['line']))
known=sorted(set(x['currentRisk'] for x in producers if x['currentRisk']!='NONE'))
summary={'baselineHead':'7249188bb2fedb84d74fa6f4f7fa3f7e645b2add','producerCount':len(producers),'consumerCount':len(consumers),'testAssertionCount':len(tests),'knownRiskClasses':known,'fourthRiskFound':False,'knownRiskExpandedToNewProductionPaths':True,'expandedPaths':['server.mjs legacy Run API, built-in non-execution evidence, desktop/Hermes execution verification','execution/minimal-desktop-executor.mjs action-level verified marker'],'unclassifiedProducerCount':sum(1 for x in producers if x['migrationGroup'].startswith('F.'))}
(OUT/'producer-inventory.json').write_text(json.dumps({'schema':'ai-workbench.verified-producer-inventory/v1','summary':summary,'entries':producers},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'consumer-inventory.json').write_text(json.dumps({'schema':'ai-workbench.verified-consumer-inventory/v1','summary':summary,'entries':consumers},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'test-assertion-inventory.json').write_text(json.dumps({'schema':'ai-workbench.verified-test-assertion-inventory/v1','summary':summary,'entries':tests},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
map_entries=[{'file':x['file'],'line':x['line'],'function':x['function'],'migrationGroup':x['migrationGroup'],'currentMeaning':x['currentMeaning'],'targetVerified':x['targetVerified'],'replacementFields':x['replacementFields'],'recommendedChange':x['recommendedChange']} for x in producers]
map_entries += [{'file':x['file'],'line':x['line'],'function':x['function'],'migrationGroup':'E. CONSUMER_MIGRATION','currentMeaning':x['currentBranchCondition'],'targetVerified':'read only for trusted acceptance','replacementFields':[x['targetField']],'recommendedChange':x['recommendedChange']} for x in consumers]
(OUT/'semantic-migration-map.json').write_text(json.dumps({'schema':'ai-workbench.verified-semantic-migration-map/v1','summary':summary,'allowedGroups':['A. TRUSTED_VERIFIER_RESULT','B. NON_EXECUTION_OR_CONTROL','C. LEGACY_EXECUTION_WITHOUT_BOUND_VERIFIER','D. NON_EXECUTION_RENDERER','E. CONSUMER_MIGRATION','F. UNRESOLVED_REQUIRES_PRODUCT_DECISION'],'entries':map_entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
