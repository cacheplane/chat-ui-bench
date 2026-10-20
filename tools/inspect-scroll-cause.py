"""Offline selected retained scroll-cause byte/data inspection; never admission.

No archived code is executed, no ZIP is extracted, no subprocess/network/browser
is used. Byte/work limits are bounded; Python JSON allocation is not a hard heap
bound. Original provider receipt provenance remains a caller responsibility.
Synthetic archive tests do not replace the unchanged AIMock chat workload.
"""
import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import stat
import struct
import sys
import zipfile
import zlib

COMMIT='c169fd3543b29178a237ca6c9c9c34c678c04a2c'
TREE='108aad99100a82b46e222e3d7fabb34b8c4e5987'
RELEASE='hosted-copilot-react-scroll-cause-v3'
CONTRACT_ID='scroll-cause-retained-v3-c169fd35-v1'
CONTRACT_PATH=Path(__file__).resolve().parent/'contracts'/(CONTRACT_ID+'.json')
CONTRACT_SHA='cc18e8e863f7c0a50bc00b0c1b339d03d542f6779fcdd8a5f6935af606033a83'
MAX_BYTES=134217728
MAX_ARCHIVE=135266304
SHA=re.compile(r'[a-f0-9]{64}\Z')
SIGNALS={'SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV','SIGBUS','SIGILL','SIGQUIT','SIGHUP'}
AUTHORITY=dict(qualification=False,nativeGO=False,performance=False,scoring=False,ranking=False,fps='unavailable')
MAX_REPORT=1048576
REASON_CODES=frozenset({'INTEGRITY','UNSUPPORTED_PLATFORM','OUTPUT_LIMIT','INTERNAL'})
VERIFIED_COMMON=(
    'frozen-producer-contract', 'supplied-original-receipt-byte-joins',
    'whole-archive-byte-join', 'bounded-flat-role-zip-integrity',
)
VERIFIED_BRANCH={
    'forensic': ('forensic-manifest-reference-byte-joins',
                 'command-declaration-byte-joins', 'forensic-literal-outcomes'),
    'full': ('selected-manifest-byte-census', 'finite-absence-declarations',
             'selected-source-run-profile-build-worker-copy-joins',
             'postcapture-drain-data-laws', 'strict-command-outcome-relationship',
             'persisted-role-reference-byte-joins', 'literal-coverage-equality'),
}
UNAVAILABLE=(
    'hosted physical identity continuity',
    'original hosted namespace/inode revalidation',
    'provider receipt origin authentication (caller-supplied originals)',
    'independent hosted source/run/argv provenance beyond supplied provider and expected-context joins',
    'full publisher schema/writerClosure semantics',
    'browser/raw/client/case closure replay and child footer laws',
    'frontend nested ZIP asset inventory and renderer/HTML joins',
    'transform reverse proof and module/component/package pins',
    'anchor/scalar/ledger/coverage recomputation', 'native scenario admission',
)
PRODUCER_ASSERTIONS=(
    'supplied provider/helper originals do not authenticate remote origin',
    'download stderr digest and CLI unchanged state remain helper assertions',
    'original/copy/stage identity and namespace declarations are not hosted inode proof',
    'closure and compiler/runtime metadata outside verifiedChecks remain producer declarations',
)
class Refusal(ValueError):
    """Internal diagnostic detail; only a finite code reaches CLI output."""
    def __init__(self, detail, code='INTEGRITY'):
        super().__init__(detail)
        self.code=code if code in REASON_CODES else 'INTEGRITY'

def require_platform():
    need(sys.version_info>=(3,12) and os.name=='posix' and
         type(getattr(os,'O_NOFOLLOW',None)) is int and os.O_NOFOLLOW>0 and
         type(getattr(os,'O_NONBLOCK',None)) is int and os.O_NONBLOCK>0 and
         all(callable(getattr(os,name,None)) for name in ('open','read','close','fstat','lstat')),
         'Python 3.12+ POSIX no-follow/nonblocking input operations required', 'UNSUPPORTED_PLATFORM')

def base_report(status, **values):
    return dict(schemaVersion=1,kind='scroll-cause-retained-inspection',
                contractId=CONTRACT_ID,status=status,**values,
                diagnosticArtifactAdmission='not-established',**AUTHORITY)

def render_report(report):
    encoded=(json.dumps(report,indent=2,ensure_ascii=True,allow_nan=False)+'\n').encode('utf-8')
    need(len(encoded)<=MAX_REPORT,'formatted report cap','OUTPUT_LIMIT')
    return encoded
def need(ok,why,code='INTEGRITY'):
    if not ok: raise Refusal(why,code)
def sha(b): return hashlib.sha256(b).hexdigest()
def integer(v,minimum=0,maximum=9007199254740991): return type(v) is int and minimum<=v<=maximum
def exact(v,keys):
    need(type(v) is dict and set(v)==set(keys),'closed object keys');return v
def same(a,b):
    if type(a) in (int,float) and type(b) in (int,float): return a==b
    if type(a) is not type(b): return False
    if type(a) is dict: return a.keys()==b.keys() and all(same(a[k],b[k]) for k in a)
    if type(a) is list: return len(a)==len(b) and all(same(x,y) for x,y in zip(a,b))
    return a==b
def identity(s): return (s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def read_file(path,cap):
    require_platform()
    path=os.fspath(path);before=os.lstat(path)
    need(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and 0<=before.st_size<=cap,'local input type/link/cap')
    # A regular file may be exchanged for a FIFO after lstat. Nonblocking open
    # lets fstat reject that race without waiting for an attacker-owned writer.
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        need(identity(os.fstat(fd))==identity(before),'local input changed')
        pieces=[];count=0
        while True:
            b=os.read(fd,min(65536,cap+1-count))
            if not b: break
            pieces.append(b);count+=len(b);need(count<=cap,'local input grew')
        need(count==before.st_size and identity(os.fstat(fd))==identity(before) and identity(os.lstat(path))==identity(before),'local input changed')
        return b''.join(pieces)
    finally: os.close(fd)
def parse_json(raw):
    def pairs(rows):
        result={}
        for k,v in rows:
            need(k not in result,'duplicate JSON key');result[k]=v
        return result
    def number(s):
        need(len(s)<=128,'JSON numeric width');v=float(s) if any(c in s for c in '.eE') else int(s)
        need(type(v) is int and abs(v)<=9007199254740991 or type(v) is float and math.isfinite(v) and (not v.is_integer() or abs(v)<=9007199254740991),'JSON unsafe number')
        return v
    try:
        text=raw.decode('utf-8','strict')
        # Bound nesting before json.loads allocates a deeply recursive graph.
        depth=0;quoted=False;escape=False
        for c in text:
            if quoted:
                if escape: escape=False
                elif c=='\\': escape=True
                elif c=='"': quoted=False
            elif c=='"': quoted=True
            elif c in '[{': depth+=1;need(depth<=32,'JSON depth')
            elif c in ']}': depth-=1
        value=json.loads(text,object_pairs_hook=pairs,parse_int=number,parse_float=number,parse_constant=lambda _:(_ for _ in ()).throw(Refusal('JSON nonfinite')))
        work=[(value,1)];nodes=0
        while work:
            v,d=work.pop();nodes+=1;need(nodes<=262144 and d<=32,'JSON work/depth')
            if type(v) is str: need(len(v.encode('utf-16-le','surrogatepass'))//2<=65536,'JSON string cap')
            elif type(v) is list:
                need(len(v)<=8192,'JSON array cap');work.extend((x,d+1) for x in v)
            elif type(v) is dict:
                need(all(len(k.encode('utf-16-le','surrogatepass'))//2<=65536 for k in v),'JSON key cap');work.extend((x,d+1) for x in v.values())
        return value
    except Refusal: raise
    except (ValueError,UnicodeError,RecursionError) as e: raise Refusal('invalid bounded JSON') from e
def check_ref(v,name,files):
    exact(v,['path','bytes','sha256']);need(v['path']==name and name in files and integer(v['bytes']) and v['bytes']==len(files[name]) and v['sha256']==sha(files[name]),'literal reference mismatch')
def extra_fields(raw):
    cursor=0
    while cursor<len(raw):
        need(cursor+4<=len(raw),'ZIP extra header');kind,size=struct.unpack_from('<HH',raw,cursor);cursor+=4
        need(kind!=1 and cursor+size<=len(raw),'ZIP64/invalid extra');cursor+=size
def archive_members(raw,caps):
    need(len(raw)<=MAX_ARCHIVE and raw[:4]==b'PK\x03\x04','ZIP envelope/header')
    pos=raw.rfind(b'PK\x05\x06',max(0,len(raw)-65557));need(pos>=0 and pos+22<=len(raw),'ZIP EOCD')
    disk,cd_disk,n_disk,count,size,offset,comment=struct.unpack_from('<HHHHIIH',raw,pos+4)
    need(disk==cd_disk==0 and n_disk==count and 1<=count<=min(128,len(caps)) and count!=65535 and size<=262144 and offset+size==pos and pos+22+comment==len(raw),'ZIP directory bound/ZIP64/multidisk')
    # Do not let ZipFile allocate an inventory from a directory whose actual
    # record count exceeds the already bounded EOCD claim or source namespace.
    cursor=offset
    observed=0
    while cursor<pos:
        observed+=1
        need(observed<=count and cursor+46<=pos and raw[cursor:cursor+4]==b'PK\x01\x02',
             'ZIP central record/count bound')
        fields=struct.unpack_from('<I6H3I5H2I',raw,cursor)
        need(fields[13]==0,'ZIP central entry disk start')
        cursor+=46+sum(fields[10:13])
        need(cursor<=pos,'ZIP central record extent')
    need(cursor==pos and observed==count,'ZIP central record census')
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            infos=z.infolist();need(len(infos)==count,'ZIP directory count');seen=set();case=set();regions=[];total=0;files={}
            for info in infos:
                n=info.filename;need(n==info.orig_filename and n in caps and '/' not in n and '\\' not in n and '\x00' not in n and n not in seen and n.lower() not in case,'ZIP namespace/duplicate')
                seen.add(n);case.add(n.lower());mode=info.external_attr>>16
                need(not info.is_dir() and not (info.external_attr&0x10) and (stat.S_IFMT(mode) in (0,stat.S_IFREG)),'ZIP special mode')
                need(info.compress_type in (0,8) and not (info.flag_bits&~0x80e) and not (info.flag_bits&1) and info.extract_version<45 and info.file_size<=caps[n] and info.compress_size<=MAX_ARCHIVE,'ZIP type/flags/cap')
                extra_fields(info.extra);off=info.header_offset;need(0<=off<offset and off+30<=offset,'ZIP local offset')
                sig,ver,flags,method,tm,dt,crc,compressed,expanded,nlen,elen=struct.unpack_from('<IHHHHHIIIHH',raw,off)
                need(sig==0x04034b50 and ver<45 and flags==info.flag_bits and method==info.compress_type and nlen<=256 and elen<=4096,'ZIP local header')
                localname=raw[off+30:off+30+nlen];need(localname==n.encode('ascii'),'ZIP central/local name');extra_fields(raw[off+30+nlen:off+30+nlen+elen])
                if flags&8: need(crc in (0,info.CRC) and compressed in (0,info.compress_size) and expanded in (0,info.file_size),'ZIP local descriptor fields')
                else: need((crc,compressed,expanded)==(info.CRC,info.compress_size,info.file_size),'ZIP local/central sizes or CRC')
                end=off+30+nlen+elen+info.compress_size;need(end<=offset,'ZIP payload range')
                if flags&8:
                    if raw[end:end+4]==b'PK\x07\x08': end+=4
                    need(end+12<=offset and struct.unpack_from('<III',raw,end)==(info.CRC,info.compress_size,info.file_size),'ZIP data descriptor');end+=12
                regions.append((off,end));total+=info.file_size;need(total<=MAX_BYTES,'ZIP payload budget')
                chunks=[];actual=0
                with z.open(info) as member:
                    while True:
                        chunk=member.read(min(65536,caps[n]+1-actual))
                        if not chunk: break
                        chunks.append(chunk);actual+=len(chunk);need(actual<=caps[n],'ZIP decompressed cap')
                need(actual==info.file_size,'ZIP actual member length');files[n]=b''.join(chunks)
            regions.sort();cursor=0
            for start,end in regions: need(start==cursor and end>=start,'ZIP overlap/gap');cursor=end
            need(cursor==offset,'ZIP unowned bytes before directory');return files
    except Refusal: raise
    except (zipfile.BadZipFile,zlib.error,RuntimeError,ValueError,UnicodeError,struct.error,EOFError) as e: raise Refusal('invalid ZIP') from e
def command_closure(start,result,out,err,argv):
    exact(start,['argv','qualification','originalClosed','startedUtc'])
    exact(result,['argv','spawned','spawnError','exitObserved','exit','closeObserved','close','timedOut','terminationRequested','streams','streamsComplete','descendantClosure','qualification'])
    need(start['argv']==argv==result['argv'] and start['qualification'] is False and start['originalClosed'] is False and type(start['startedUtc']) is str and re.fullmatch(r'[\x20-\x7e]{1,32}',start['startedUtc']),'command owner')
    need(result['qualification'] is False and result['descendantClosure']=='unqualified' and result['spawned'] is True and result['spawnError'] is False and result['exitObserved'] is True and result['closeObserved'] is True and result['streamsComplete'] is True and type(result['timedOut']) is bool and type(result['terminationRequested']) is bool,'command open')
    exit=exact(result['exit'],['exitCode','signal']);close=exact(result['close'],['exitCode','signal']);need(same(exit,close) and ((integer(exit['exitCode'],0,255) and exit['signal'] is None) or (exit['exitCode'] is None and exit['signal'] in SIGNALS)),'command exit')
    streams=exact(result['streams'],['stdout','stderr'])
    for name,b in [('stdout',out),('stderr',err)]:
        s=exact(streams[name],['readableEOF','writerFinish','writerClose','writerError','overflow','seen','retained'])
        need(all(s[k] is True for k in ['readableEOF','writerFinish','writerClose']) and all(s[k] is False for k in ['writerError','overflow']) and integer(s['seen']) and integer(s['retained']) and s['seen']==s['retained']==len(b),'command stream open')
def drain_receipt(r):
    exact(r,['schemaVersion','eligibility','reason','original','waiter','outcome','requestedHostMs','targetHostMs','settledHostMs'])
    eligible=r['eligibility']=='eligible';reason=r['reason'];original=r['original'];waiter=r['waiter'];outcome=r['outcome'];start=r['requestedHostMs'];target=r['targetHostMs'];settled=r['settledHostMs']
    early=['no-measured-failure','continuation-not-started','capture-incomplete','pending-original','deadline']
    need(integer(r['schemaVersion'],1,1) and r['eligibility'] in ['eligible','ineligible'] and reason in early+['eligible','completion-attempted','cleanup-rejected','cleanup-timeout','admission-closed'] and original in ['not-started','pending','fulfilled','rejected'] and waiter in ['not-started','fulfilled','rejected','timed-out'] and outcome in ['ineligible','pending','fulfilled','rejected','timed-out'],'drain enum')
    need(all(v is None or type(v) in (int,float) and math.isfinite(v) and v>=0 for v in [start,target,settled]),'drain time')
    need(eligible==(reason=='eligible') and not (not eligible and original!='not-started'),'drain eligibility')
    need(not(outcome=='fulfilled' and (original!='fulfilled' or waiter!='fulfilled' or not eligible)) and not(outcome=='rejected' and (original!='rejected' or waiter!='rejected' or not eligible)) and not(outcome=='timed-out' and waiter!='timed-out') and not(outcome=='ineligible' and eligible),'drain outcome')
    need(not(original!='not-started' and (start is None or target is None)) and not(original in ['fulfilled','rejected'] and settled is None) and not(original in ['not-started','pending'] and settled is not None),'drain original timing')
    need((start is None)==(target is None) and not(start is not None and start>=target) and not(settled is not None and start is not None and settled<start),'drain timing order')
    need((waiter=='fulfilled')==(outcome=='fulfilled') and (waiter=='timed-out')==(outcome=='timed-out') and not(eligible and original=='not-started') and not(outcome=='pending' and waiter!='not-started'),'drain waiter')
    if not eligible:
        need((waiter=='rejected' and reason=='cleanup-rejected') or (waiter=='timed-out' and reason=='cleanup-timeout') or waiter=='not-started','drain ineligible waiter')
    need(not(reason=='cleanup-timeout' and (waiter!='timed-out' or outcome!='timed-out')) and not(reason=='cleanup-rejected' and (waiter!='rejected' or outcome!='ineligible')),'drain reason')
    need(not(reason in ['cleanup-timeout','cleanup-rejected'] and start is None) and not(reason in early and start is not None) and not(outcome=='fulfilled' and settled>=target),'drain reason time')
    need(original!='pending' and outcome not in ['pending','rejected','timed-out'],'drain unpublished')
def contract(path=None,contract_id=CONTRACT_ID):
    need(contract_id==CONTRACT_ID,'unsupported producer contract')
    b=read_file(path or CONTRACT_PATH,65536);need(sha(b)==CONTRACT_SHA,'frozen source contract digest')
    c=parse_json(b);need(c['commit']==COMMIT and c['tree']==TREE and c['release']==RELEASE and len(c['caps'])==31 and len(c['forensicRoles'])==8 and sum(c['caps'].values())==104468480 and c['reservation']==dict(bytes=130240512,files=41),'frozen source contract')
    return c
def load_envelope(parameters,archive,c):
    p=parse_json(read_file(parameters,1048576));exact(p,['expected','originalReceipts']);e=exact(p['expected'],['source','run','parentArgv','childArgv'])
    need(same(e['source'],dict(commitSha=c['commit'],treeSha=c['tree'],lockSha256=c['lockSha256'])),'actual merged source mismatch')
    run=exact(e['run'],['repository','runId','attempt','tag']);need(run['repository']=='cacheplane/chat-ui-bench' and type(run['runId']) is str and re.fullmatch(r'[1-9][0-9]{0,19}',run['runId']) and integer(run['attempt'],1,1) and run['tag']==RELEASE,'expected run')
    for key,action in [('parentArgv','parent'),('childArgv','child')]:
        a=e[key];need(type(a) is list and len(a)==4 and all(type(v) is str and len(v)<=4096 for v in a) and a[0].startswith('/') and a[1]=='--experimental-import-meta-resolve' and a[2].startswith('/') and a[2].endswith('/tools/hosted-copilot-scroll-cause.mjs') and a[3]==action and all('/../' not in v and '/./' not in v and '\x00' not in v for v in a),'expected exact command recipe')
    need(e['parentArgv'][:3]==e['childArgv'][:3],'common original checkout/node')
    rs=exact(p['originalReceipts'],['run','artifact','tag','dispatch','job','download','downloadIntent']);records={};pins={};total=0
    for role,r in rs.items():
        need(type(r) is dict and set(r) in ({'path','bytes','sha256'},{'path','bytes','sha256','select'}),'receipt reference keys');need(type(r['path']) is str and os.path.isabs(r['path']) and integer(r['bytes'],0,1048576) and type(r['sha256']) is str and SHA.fullmatch(r['sha256']),'original receipt parameter')
        b=read_file(r['path'],1048576);total+=len(b);need(total<=4194304 and len(b)==r['bytes'] and sha(b)==r['sha256'],'original receipt bytes');record=parse_json(b)
        selection=r.get('select',[]);need(type(selection) is list and len(selection)<=8,'bounded original envelope selection')
        for key in selection:
            need(type(key) is str and len(key)<=256 or integer(key,0,8191),'selection key type')
            need(type(record) is dict and type(key) is str and key in record or type(record) is list and integer(key,0,len(record)-1),'selection target')
            record=record[key]
        records[role]=record;pins[role]=r
    r=records['run'];a=records['artifact'];tag=records['tag'];dispatch=records['dispatch'];d=records['download'];job=records['job']
    need(str(r['id'])==run['runId'] and integer(r['id'],1) and integer(r['run_attempt'],1,1) and r['head_sha']==COMMIT and r['head_branch']==RELEASE and r['event']=='workflow_dispatch' and r['path']=='.github/workflows/hosted-copilot-scroll-cause.yml' and r['repository']['full_name']==run['repository'],'provider run binding')
    need(tag['ref']=='refs/tags/'+RELEASE and tag['object']['type']=='commit' and tag['object']['sha']==COMMIT,'provider tag binding')
    need(integer(a['id'],1) and a['expired'] is False and str(a['workflow_run']['id'])==run['runId'] and a['workflow_run']['head_sha']==COMMIT and integer(a['size_in_bytes'],1,MAX_ARCHIVE) and a['size_in_bytes']==len(archive) and a['digest']=='sha256:'+sha(archive),'provider artifact binding/digest')
    # Original capture-helper records, not fabricated normalized provider data.
    for intent in [dispatch,records['downloadIntent']]:
        need(type(intent) is dict and type(intent['argv']) is list and 1<=len(intent['argv'])<=16 and all(type(x) is str and len(x)<=4096 for x in intent['argv']) and intent['argv'][0].startswith('/') and type(intent['cwd']) is str and os.path.isabs(intent['cwd']) and type(intent['ghSha256']) is str and SHA.fullmatch(intent['ghSha256']) and type(intent['startedAt']) is str and len(intent['startedAt'])<=128 and integer(intent['deadlineSeconds'],1,3600) and intent['descendants']=='unqualified','original helper intent')
    gh=dispatch['argv'][0]
    need(dispatch['argv']==[gh,'workflow','run','hosted-copilot-scroll-cause.yml','--repo','cacheplane/chat-ui-bench','--ref',RELEASE,'-f','candidate_sha='+COMMIT],'original dispatch argv binding')
    endpoint='repos/cacheplane/chat-ui-bench/actions/artifacts/'+str(a['id'])+'/zip';intent=records['downloadIntent']
    need(intent['argv']==[gh,'api',endpoint] and same(d['argv'],intent['argv']) and intent['ghSha256']==dispatch['ghSha256'],'original download argv/CLI binding')
    need(integer(d['exitCode'],0,0) and d['directChildWaitReturned'] is True and d['timedOut'] is False and d['ghUnchanged'] is True and type(d['finishedAt']) is str and len(d['finishedAt'])<=128,'original download closure')
    need(integer(d['stdout']['bytes'],1,MAX_ARCHIVE) and d['stdout']['bytes']==len(archive) and d['stdout']['sha256']==sha(archive) and d['stdout']['withinPostCaptureCap'] is True,'original download stdout archive binding')
    need(integer(d['stderr']['bytes'],0,1048576) and type(d['stderr']['sha256']) is str and SHA.fullmatch(d['stderr']['sha256']) and d['stderr']['withinPostCaptureCap'] is True and (d['stderr']['bytes']!=0 or d['stderr']['sha256']==sha(b'')),'original download stderr assertion')
    names={'full':'copilot-scroll-cause-','forensic':'copilot-scroll-cause-command-forensics-'};branches=[k for k,v in names.items() if a['name']==v+run['runId']+'-1'];need(len(branches)==1,'artifact name');branch=branches[0]
    need(integer(job['run_id'],1) and same(job['run_id'],r['id']) and job['head_sha']==COMMIT and job['name']=='diagnostic' and type(job['steps']) is list and len(job['steps'])<=128 and all(type(step) is dict for step in job['steps']),'provider job binding')
    required={'full':['Admit only closed diagnostic originals after outer run returned','Reauthenticate manifest and original namespace immediately before upload','Retain separately named unqualified diagnostic originals'],'forensic':['Admit closed command originals independently after diagnostic refusal','Reauthenticate only admitted command forensic copies','Retain separately named unqualified command originals']}[branch]
    for name in required:
        steps=[s for s in job['steps'] if s.get('name')==name];need(len(steps)==1 and steps[0].get('conclusion')=='success','provider upload gate unavailable/failed')
    return e,records,pins,branch
def validate_commands(files,e):
    outcomes={}
    for name,argv in [('parent',e['parentArgv']),('application',e['childArgv'])]:
        r=parse_json(files[name+'-result.json']);command_closure(parse_json(files[name+'-started.json']),r,files[name+'.stdout'],files[name+'.stderr'],argv);outcomes[name]={k:r[k] for k in ['exit','close','timedOut','terminationRequested']}
    return outcomes
def tuples(v,count): need(type(v) is list and len(v)==count and all(type(x) is str and re.fullmatch(r'[0-9]+',x) and len(x)<=32 for x in v),'hosted identity tuple shape')
def forensic(files,e,c):
    need(set(files)==set(c['forensicRoles'])|{'forensic-manifest.json'},'exact forensic namespace')
    m=parse_json(files['forensic-manifest.json']);exact(m,['schemaVersion','kind','source','run','profile','parentArgv','childArgv','files','originalNamespace','stageIdentity','outcomes','reservation','diagnosticArtifactAdmission','browserClosure','rawTraceClosure','descendants','qualification','nativeGO','performance','fps'])
    need(integer(m['schemaVersion'],1,1) and m['kind']=='unqualified-scroll-cause-command-forensics' and same(m['source'],e['source']) and same(m['run'],e['run']) and m['parentArgv']==e['parentArgv'] and m['childArgv']==e['childArgv'] and same(m['profile'],dict(release=RELEASE,scope='closed-parent-application-commands-only')) and same(m['reservation'],c['reservation']),'forensic context/profile/reservation')
    need(all(m[k] is False for k in ['qualification','nativeGO','performance']) and m['fps']=='unavailable' and m['diagnosticArtifactAdmission']=='not-established' and m['browserClosure']=='unestablished' and m['rawTraceClosure']=='unestablished' and m['descendants']=='unqualified','forensic authority')
    need(type(m['files']) is list and len(m['files'])==8,'forensic refs');seen=[]
    for r in m['files']:
        exact(r,['path','bytes','sha256','originalIdentity','copyIdentity']);name=r['path'];need(name in c['forensicRoles'] and name not in seen,'forensic ref role/duplicate');seen.append(name)
        check_ref({k:r[k] for k in ['path','bytes','sha256']},name,files);tuples(r['originalIdentity'],7);tuples(r['copyIdentity'],7)
        for claimed in [r['originalIdentity'],r['copyIdentity']]:
            need(stat.S_ISREG(int(claimed[2])) and claimed[3]=='1' and int(claimed[4])==r['bytes'],'contradictory hosted file identity assertion')
        need(r['originalIdentity'][:2]!=r['copyIdentity'][:2],'independent copy identity assertion')
    need(seen==c['forensicRoles'],'forensic role order');tuples(m['stageIdentity'],3)
    ns=exact(m['originalNamespace'],['entries','sha256','coverage']);need(integer(ns['entries'],8,31) and type(ns['sha256']) is str and SHA.fullmatch(ns['sha256']) and ns['coverage']=='metadata-only; unselected roles not admitted','original namespace assertion')
    outcomes=validate_commands(files,e);need(same(m['outcomes'],outcomes),'forensic literal outcomes');return outcomes
def full(files,e,c):
    # Deliberately partial data-only replay. Never invoke physical hosted publisher.
    need(set(files)<=set(c['caps']) and set(c['caps'])-set(c['optional'])<=set(files),'full namespace/mandatory')
    m=parse_json(files['diagnostic-manifest.json']);exact(m,['schemaVersion','kind','source','run','profileRef','trackerProfileRef','buildRef','strictResultRef','ledgerRef','exportRef','files','absent','bytesBeforeManifest','writerClosure','coverage','qualification','nativeGO','performance','fps'])
    need(integer(m['schemaVersion'],1,1) and m['kind']=='unqualified-scroll-cause-manifest' and same(m['source'],e['source']) and same(m['run'],e['run']) and all(m[k] is False for k in ['qualification','nativeGO','performance']) and m['fps']=='unavailable','full manifest authority/context')
    need(type(m['files']) is list and len(m['files'])==len(files)-1,'full manifest count');names=[]
    for r in m['files']:
        need(type(r) is dict and type(r.get('path')) is str and r['path']!='diagnostic-manifest.json' and r['path'] not in names,'manifest ref duplicate/self');check_ref(r,r['path'],files);names.append(r['path'])
    need(set(names)==set(files)-{'diagnostic-manifest.json'} and integer(m['bytesBeforeManifest']) and m['bytesBeforeManifest']==sum(len(files[n]) for n in names),'full manifest byte census')
    missing=set(c['caps'])-set(files);need(type(m['absent']) is list and len(m['absent'])==len(missing),'absence count');absent=set()
    for r in m['absent']:
        exact(r,['path','reason']);need(r['path'] in missing and r['path'] not in absent and c['optional'].get(r['path'])==r['reason'],'finite absence');absent.add(r['path'])
    need(absent==missing,'complete absence')
    for key,name in [('profileRef','diagnostic-profile.json'),('trackerProfileRef','tracker-a-profile.json'),('buildRef','diagnostic-build.json'),('strictResultRef','diagnostic-strict-result.json'),('exportRef','scroll-cause-export.json')]: check_ref(m[key],name,files)
    if 'scroll-cause-ledger.json' in files: check_ref(m['ledgerRef'],'scroll-cause-ledger.json',files)
    else: need(m['ledgerRef'] is None,'absent ledger ref')
    parsed={n:parse_json(b) for n,b in files.items() if n.endswith('.json') and n!='tracker-a-case-2-trace.json'}
    for name in ['diagnostic-source.json','diagnostic-build.json','diagnostic-profile.json','tracker-a-profile.json']:
        row=parsed[name];need(same(row['source'],e['source']) and same(row['run'],e['run']) and row['qualification'] is False,'full role source/run')
    build=parsed['diagnostic-build.json'];recipe=parsed['diagnostic-profile.json'];tracker=parsed['tracker-a-profile.json']
    profile=dict(schemaVersion=1,mode='unscored-postcapture-natural-drain',caseNumber=2,position='after-capture-cleanup-before-owner-close',deadline='original-overall-deadline',completion='existing-public-validation-once',scoring=False)
    need(same(recipe['postCaptureDrain'],profile) and same(tracker['postCaptureDrain'],profile),'unscored postcapture profile')
    check_ref(tracker['recipeRef'],'diagnostic-profile.json',files);check_ref(tracker['buildRef'],'diagnostic-build.json',files)
    need(build['profilePath']=='diagnostic-profile.json' and build['profileSha256']==sha(files['diagnostic-profile.json']),'build recipe')
    worker=build['worker'];need(type(worker['launchPath']) is str and worker['launchPath'].endswith('/apps/copilotkit/artifacts/scroll-cause/'+e['run']['runId']+'-1/worker.mjs') and integer(worker['bytes']) and worker['bytes']==len(files['diagnostic-worker.mjs']) and worker['sha256']==sha(files['diagnostic-worker.mjs']),'retained worker copy bytes')
    strict=parsed['diagnostic-strict-result.json'];drain_receipt(strict['postCaptureDrain']);s=exact(strict['strict'],['status','hasPrimary','firstFailure','cleanupFailureCount'])
    need(s['status'] in ['complete','incomplete'] and type(s['hasPrimary']) is bool and integer(s['cleanupFailureCount']) and all(strict[k] is False for k in ['qualification','nativeGO','performance']) and strict['fps']=='unavailable','strict shape/authority')
    outcomes=validate_commands(files,e);expected=0 if s['status']=='complete' and s['hasPrimary'] is False else 2
    need(all(r['exit']==dict(exitCode=expected,signal=None) and r['timedOut'] is False and r['terminationRequested'] is False for r in outcomes.values()),'full command infrastructure outcome')
    # Authenticate every persisted role ref without evaluating payload code.
    work=[(v,1) for v in parsed.values()];visited=0
    while work:
        v,d=work.pop();visited+=1;need(visited<=262144 and d<=32,'reference walk bound')
        if type(v) is list: work.extend((x,d+1) for x in v)
        elif type(v) is dict:
            for k,x in v.items():
                if (k.endswith('Ref') or k=='ref') and type(x) is dict and 'sha256' in x: check_ref(x,x.get('path'),files)
                else: work.append((x,d+1))
    need(same(m['coverage'],strict['attributionCoverage']),'coverage literal join')
    return outcomes
def audit(zip_path,parameters,contract_path=None,contract_id=CONTRACT_ID):
    try:
        require_platform()
        c=contract(contract_path,contract_id);archive=read_file(zip_path,MAX_ARCHIVE);e,records,pins,branch=load_envelope(parameters,archive,c)
        caps=c['caps'] if branch=='full' else {**{n:c['caps'][n] for n in c['forensicRoles']},'forensic-manifest.json':16384}
        files=archive_members(archive,caps);outcomes=forensic(files,e,c) if branch=='forensic' else full(files,e,c)
        report=base_report('selected-retained-byte-data-joins-verified',branch=branch,
            source=e['source'],run=e['run'],archive=dict(bytes=len(archive),sha256=sha(archive)),
            originalReceiptPins=pins,
            receiptSelectionNotice='Any select path is a derived view into the hashed original bytes, not a newly authenticated original receipt.',
            files=[dict(path=n,bytes=len(b),sha256=sha(b)) for n,b in files.items()],outcomes=outcomes,
            verifiedChecks=list(VERIFIED_COMMON+VERIFIED_BRANCH[branch]),
            producerAssertions=list(PRODUCER_ASSERTIONS),unavailable=list(UNAVAILABLE),
            sourceContractSha256=CONTRACT_SHA)
        render_report(report)
        return report
    except Refusal: raise
    except (KeyError,TypeError,ValueError,IndexError,OverflowError,OSError) as ex: raise Refusal('missing/invalid required input: '+type(ex).__name__) from ex
def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip',required=True,help='original retained provider ZIP')
    parser.add_argument('--parameters',required=True,help='expected context and original receipt references')
    parser.add_argument('--contract',choices=[CONTRACT_ID],default=CONTRACT_ID,
                        help='immutable historical producer contract ID')
    args=parser.parse_args(argv)
    try:
        report=audit(os.path.abspath(args.zip),os.path.abspath(args.parameters),contract_id=args.contract)
        encoded=render_report(report)
        code=0
    except Refusal as error:
        reason=error.code if type(error) is Refusal else 'INTEGRITY'
        encoded=render_report(base_report('refused',reasonCode=reason))
        code=2
    except Exception:
        # Never invoke a foreign exception formatter or disclose arbitrary messages.
        encoded=render_report(base_report('refused',reasonCode='INTERNAL'))
        code=1
    sys.stdout.write(encoded.decode('utf-8'))
    return code
if __name__=='__main__': sys.exit(main())
