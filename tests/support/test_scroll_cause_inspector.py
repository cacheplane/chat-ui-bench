"""Synthetic archive/receipt tests, never an application workload or provider evidence.

Producer argv and worker path strings are inert supplied fixture metadata; no
hosted path is created, opened, imported or used as a physical-worker alias.
"""
import copy, hashlib, importlib.util, io, json, pathlib, struct, tempfile, unittest, zipfile
import contextlib
import os
import subprocess
import sys
from unittest.mock import patch
HERE = pathlib.Path(__file__).resolve().parents[2]
TOOL = HERE/'tools/inspect-scroll-cause.py'
CONTRACT = HERE/'tools/contracts/scroll-cause-retained-v3-c169fd35-v1.json'
spec = importlib.util.spec_from_file_location('auditor', TOOL)
A = None
if spec and pathlib.Path(spec.origin).exists():
    A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
C = json.loads(CONTRACT.read_text()) if CONTRACT.exists() else {}
def raw(v): return (json.dumps(v,separators=(',',':'))+'\n').encode()
def digest(b): return hashlib.sha256(b).hexdigest()
def zipbytes(rows):
    f=io.BytesIO()
    with zipfile.ZipFile(f,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,data in rows: z.writestr(name,data)
    return f.getvalue()
def command(argv,out=b'',err=b'',exit=2):
    stream=lambda b:dict(readableEOF=True,writerFinish=True,writerClose=True,writerError=False,overflow=False,seen=len(b),retained=len(b))
    ending=dict(exitCode=exit,signal=None)
    return dict(argv=argv,qualification=False,originalClosed=False,startedUtc='2026-10-20T00:00:00.000Z'),dict(argv=argv,spawned=True,spawnError=False,exitObserved=True,exit=ending,closeObserved=True,close=ending,timedOut=False,terminationRequested=False,streams=dict(stdout=stream(out),stderr=stream(err)),streamsComplete=True,descendantClosure='unqualified',qualification=False)
def fixture():
    source=dict(commitSha=C['commit'],treeSha=C['tree'],lockSha256=C['lockSha256'])
    run=dict(repository='cacheplane/chat-ui-bench',runId='12345',attempt=1,tag=C['release'])
    base=['/opt/node/bin/node','--experimental-import-meta-resolve','/home/runner/work/chat-ui-bench/chat-ui-bench/tools/hosted-copilot-scroll-cause.mjs']
    expected=dict(source=source,run=run,parentArgv=base+['parent'],childArgv=base+['child'])
    files={};outcomes={}
    for name,argv in [('parent',expected['parentArgv']),('application',expected['childArgv'])]:
        out=(name+' literal stdout\n').encode();err=b'';s,r=command(argv,out,err)
        files[name+'-started.json']=raw(s);files[name+'-result.json']=raw(r);files[name+'.stdout']=out;files[name+'.stderr']=err
        outcomes[name]={k:r[k] for k in ['exit','close','timedOut','terminationRequested']}
    refs=[dict(path=p,bytes=len(files[p]),sha256=digest(files[p]),originalIdentity=['1',str(100+i),'33152','1',str(len(files[p])),'123','123'],copyIdentity=['1',str(200+i),'33152','1',str(len(files[p])),'123','123']) for i,p in enumerate(C['forensicRoles'])]
    m=dict(schemaVersion=1,kind='unqualified-scroll-cause-command-forensics',source=source,run=run,profile=dict(release=C['release'],scope='closed-parent-application-commands-only'),parentArgv=expected['parentArgv'],childArgv=expected['childArgv'],files=refs,originalNamespace=dict(entries=8,sha256='a'*64,coverage='metadata-only; unselected roles not admitted'),stageIdentity=['1','2','16832'],outcomes=outcomes,reservation=C['reservation'],diagnosticArtifactAdmission='not-established',browserClosure='unestablished',rawTraceClosure='unestablished',descendants='unqualified',qualification=False,nativeGO=False,performance=False,fps='unavailable')
    files['forensic-manifest.json']=raw(m)
    return expected,files,m
def full_fixture():
    e,commands,_=fixture();files={k:v for k,v in commands.items() if k!='forensic-manifest.json'}
    source=e['source'];run=e['run']
    for n in set(C['caps'])-set(C['optional'])-set(files)-{'diagnostic-manifest.json'}:
        files[n]=raw(dict(source=source,run=run,qualification=False)) if n.endswith('.json') else b'inert synthetic bytes, never executed'
    ref=lambda n:dict(path=n,bytes=len(files[n]),sha256=digest(files[n]))
    profile=dict(schemaVersion=1,mode='unscored-postcapture-natural-drain',caseNumber=2,position='after-capture-cleanup-before-owner-close',deadline='original-overall-deadline',completion='existing-public-validation-once',scoring=False)
    files['diagnostic-profile.json']=raw(dict(source=source,run=run,qualification=False,postCaptureDrain=profile))
    files['diagnostic-build.json']=raw(dict(source=source,run=run,qualification=False,profilePath='diagnostic-profile.json',profileSha256=digest(files['diagnostic-profile.json']),worker=dict(launchPath='/home/runner/work/chat-ui-bench/chat-ui-bench/apps/copilotkit/artifacts/scroll-cause/12345-1/worker.mjs',bytes=len(files['diagnostic-worker.mjs']),sha256=digest(files['diagnostic-worker.mjs']))))
    files['tracker-a-profile.json']=raw(dict(source=source,run=run,qualification=False,postCaptureDrain=profile,recipeRef=ref('diagnostic-profile.json'),buildRef=ref('diagnostic-build.json')))
    drain=dict(schemaVersion=1,eligibility='ineligible',reason='no-measured-failure',original='not-started',waiter='not-started',outcome='ineligible',requestedHostMs=None,targetHostMs=None,settledHostMs=None)
    files['diagnostic-strict-result.json']=raw(dict(strict=dict(status='incomplete',hasPrimary=True,firstFailure=None,cleanupFailureCount=0),postCaptureDrain=drain,qualification=False,nativeGO=False,performance=False,fps='unavailable',attributionCoverage=dict(availability='unavailable')))
    files['scroll-cause-export.json']=b'{}\n'
    m=dict(schemaVersion=1,kind='unqualified-scroll-cause-manifest',source=source,run=run,profileRef=ref('diagnostic-profile.json'),trackerProfileRef=ref('tracker-a-profile.json'),buildRef=ref('diagnostic-build.json'),strictResultRef=ref('diagnostic-strict-result.json'),ledgerRef=None,exportRef=ref('scroll-cause-export.json'),files=[ref(n) for n in files],absent=[dict(path=n,reason=C['optional'][n]) for n in C['caps'] if n not in files and n!='diagnostic-manifest.json'],bytesBeforeManifest=sum(map(len,files.values())),writerClosure={},coverage=dict(availability='unavailable'),qualification=False,nativeGO=False,performance=False,fps='unavailable')
    files['diagnostic-manifest.json']=raw(m);return e,files,m

class AuditTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(A,'data-only auditor implementation is missing')
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
    def envelope(self, archive, expected, branch='forensic'):
        name=('copilot-scroll-cause-command-forensics-' if branch=='forensic' else 'copilot-scroll-cause-')+'12345-1'
        gh='/opt/gh/bin/gh';downloadArgv=[gh,'api','repos/cacheplane/chat-ui-bench/actions/artifacts/77/zip']
        intent=lambda argv:dict(argv=argv,cwd=str(self.root),ghSha256='a'*64,startedAt='2026-10-20T00:00:00.000Z',deadlineSeconds=180,descendants='unqualified')
        metadata={
          'run':dict(id=12345,run_attempt=1,head_sha=C['commit'],head_branch=C['release'],event='workflow_dispatch',path='.github/workflows/hosted-copilot-scroll-cause.yml',repository=dict(full_name='cacheplane/chat-ui-bench')),
          'artifact':dict(id=77,name=name,size_in_bytes=len(archive),digest='sha256:'+digest(archive),expired=False,workflow_run=dict(id=12345,head_sha=C['commit'])),
          'tag':dict(ref='refs/tags/'+C['release'],object=dict(type='commit',sha=C['commit'])),
          'dispatch':intent([gh,'workflow','run','hosted-copilot-scroll-cause.yml','--repo','cacheplane/chat-ui-bench','--ref',C['release'],'-f','candidate_sha='+C['commit']]),
          'job':dict(run_id=12345,head_sha=C['commit'],name='diagnostic',steps=[dict(name=n,conclusion='success') for n in (['Admit closed command originals independently after diagnostic refusal','Reauthenticate only admitted command forensic copies','Retain separately named unqualified command originals'] if branch=='forensic' else ['Admit only closed diagnostic originals after outer run returned','Reauthenticate manifest and original namespace immediately before upload','Retain separately named unqualified diagnostic originals'])]),
          'download':dict(argv=downloadArgv,exitCode=0,directChildWaitReturned=True,timedOut=False,finishedAt='2026-10-20T00:01:00.000Z',ghUnchanged=True,stdout=dict(bytes=len(archive),sha256=digest(archive),withinPostCaptureCap=True),stderr=dict(bytes=0,sha256=digest(b''),withinPostCaptureCap=True)),
          'downloadIntent':intent(downloadArgv)}
        receipts={}
        for role,value in metadata.items():
            b=raw(value);p=self.root/(role+'.json');p.write_bytes(b);receipts[role]=dict(path=str(p),bytes=len(b),sha256=digest(b))
        p=self.root/'parameters.json';p.write_bytes(raw(dict(expected=expected,originalReceipts=receipts)))
        z=self.root/'original.zip';z.write_bytes(archive);return z,p
    def audit(self, files=None, expected=None):
        e,f,_=fixture();z,p=self.envelope(zipbytes(list((files or f).items())),expected or e)
        return A.audit(z,p,CONTRACT)
    def test_exact_forensic_originals_are_byte_joined_without_payload_admission(self):
        r=self.audit();self.assertEqual(r['branch'],'forensic');self.assertEqual(len(r['files']),9)
        self.assertFalse(r['qualification']);self.assertEqual(r['diagnosticArtifactAdmission'],'not-established')
        self.assertIn('hosted physical identity continuity',r['unavailable'])
    def test_missing_provider_parameters_refuse(self):
        z=self.root/'x.zip';z.write_bytes(b'PK');p=self.root/'p.json';p.write_bytes(b'{}')
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
    def test_provider_digest_and_original_receipt_mutation_refuse(self):
        e,f,_=fixture();b=zipbytes(list(f.items()));z,p=self.envelope(b,e);z.write_bytes(b+b'x')
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
        z.write_bytes(b);(self.root/'run.json').write_bytes(b'{}')
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
    def test_original_helper_argv_and_stdout_bytes_are_required(self):
        e,f,_=fixture();z,p=self.envelope(zipbytes(list(f.items())),e)
        for role,change in [('dispatch',lambda r:r['argv'].__setitem__(-1,'candidate_sha='+'a'*40)),('download',lambda r:r.__setitem__('timedOut',True)),('downloadIntent',lambda r:r['argv'].__setitem__(-1,'repos/cacheplane/chat-ui-bench/actions/artifacts/99/zip'))]:
            z,p=self.envelope(zipbytes(list(f.items())),e);params=json.loads(p.read_bytes());rpath=self.root/(role+'.json');record=json.loads(rpath.read_bytes());change(record);b=raw(record);rpath.write_bytes(b);params['originalReceipts'][role].update(bytes=len(b),sha256=digest(b));p.write_bytes(raw(params))
            with self.subTest(role=role),self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
    def test_bounded_original_provider_envelope_selection_is_labeled(self):
        e,f,_=fixture();z,p=self.envelope(zipbytes(list(f.items())),e);params=json.loads(p.read_bytes());path=self.root/'run.json';b=raw(dict(items=[json.loads(path.read_bytes())]));path.write_bytes(b);params['originalReceipts']['run'].update(bytes=len(b),sha256=digest(b),select=['items',0]);p.write_bytes(raw(params))
        r=A.audit(z,p,CONTRACT);self.assertEqual(r['originalReceiptPins']['run']['select'],['items',0]);self.assertIn('derived view',r['receiptSelectionNotice'])
    def test_pending_stream_changed_argv_and_literal_hash_refuse(self):
        for attack in ['stream','argv','bytes','missing','extra','manifest-duplicate']:
            e,f,m=fixture()
            if attack in ['stream','argv']:
                r=json.loads(f['application-result.json']);r['streams']['stdout']['writerClose']=False if attack=='stream' else True
                if attack=='argv': r['argv']=['foreign']
                f['application-result.json']=raw(r)
                for row in m['files']:
                    if row['path']=='application-result.json':
                        row.update(bytes=len(f[row['path']]),sha256=digest(f[row['path']]))
                        row['originalIdentity'][4]=row['copyIdentity'][4]=str(row['bytes'])
                f['forensic-manifest.json']=raw(m)
            if attack=='bytes': f['application.stdout']+=b'mutation'
            if attack=='missing': del f['parent.stderr']
            if attack=='extra': f['diagnostic-strict-result.json']=b'{}'
            if attack=='manifest-duplicate': m['files'][1]=m['files'][0];f['forensic-manifest.json']=raw(m)
            with self.subTest(attack=attack), self.assertRaises(A.Refusal): self.audit(f,e)
    def test_failed_and_timedout_commands_are_not_promoted_or_rejected_for_exit_only(self):
        e,f,m=fixture();r=json.loads(f['application-result.json']);r.update(timedOut=True,terminationRequested=True,exit=dict(exitCode=None,signal='SIGTERM'),close=dict(exitCode=None,signal='SIGTERM'))
        f['application-result.json']=raw(r);m['outcomes']['application']={k:r[k] for k in ['exit','close','timedOut','terminationRequested']}
        for row in m['files']:
            if row['path']=='application-result.json':
                row.update(bytes=len(f[row['path']]),sha256=digest(f[row['path']]))
                row['originalIdentity'][4]=row['copyIdentity'][4]=str(row['bytes'])
        f['forensic-manifest.json']=raw(m);self.assertTrue(self.audit(f,e)['outcomes']['application']['timedOut'])
    def test_zip_unsafe_duplicate_symlink_crc_and_size_attacks_refuse(self):
        e,f,_=fixture()
        for name in ['../parent.stderr','/parent.stderr','nested/file','PARENT.STDERR','bad\\file']:
            rows=list(f.items())+[(name,b'x')]
            with self.subTest(name=name),self.assertRaises(A.Refusal):
                z,p=self.envelope(zipbytes(rows),e);A.audit(z,p,CONTRACT)
        with self.assertWarns(UserWarning): b=zipbytes(list(f.items())+[('parent.stderr',b'x')])
        z,p=self.envelope(b,e)
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w') as zip:
            i=zipfile.ZipInfo('parent.stderr');i.create_system=3;i.external_attr=0o120777<<16;zip.writestr(i,b'target')
        z,p=self.envelope(buf.getvalue(),e)
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
        b=bytearray(zipbytes(list(f.items())));b[14]^=1;z,p=self.envelope(bytes(b),e)
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
    def test_json_duplicates_bool_counts_nan_and_depth_refuse(self):
        for b in [b'{"a":1,"a":2}',b'{"x":NaN}',('['*34+'0'+']'*34).encode(),b'{"x":9007199254740992}']:
            with self.subTest(b=b[:40]),self.assertRaises(A.Refusal): A.parse_json(b)
    def test_close_boolean_code_cannot_equal_original_numeric_exit(self):
        argv=['/node','x'];s,r=command(argv,exit=1);r['close']=dict(exitCode=True,signal=None)
        with self.assertRaises(A.Refusal): A.command_closure(s,r,b'',b'',argv)
    def test_drain_matrix_rejects_renamed_timeout_and_late_success(self):
        inactive=dict(schemaVersion=1,eligibility='ineligible',reason='no-measured-failure',original='not-started',waiter='not-started',outcome='ineligible',requestedHostMs=None,targetHostMs=None,settledHostMs=None)
        A.drain_receipt(inactive)
        for r in [dict(inactive,reason='cleanup-timeout'),dict(inactive,reason='cleanup-rejected'),dict(schemaVersion=1,eligibility='eligible',reason='eligible',original='fulfilled',waiter='fulfilled',outcome='fulfilled',requestedHostMs=1,targetHostMs=10,settledHostMs=10)]:
            with self.assertRaises(A.Refusal): A.drain_receipt(r)
    def test_declared_member_over_cap_refuses_before_decompress(self):
        e,f,_=fixture();b=bytearray(zipbytes(list(f.items())));i=b.index(b'PK\x01\x02');struct.pack_into('<I',b,i+24,999999999)
        z,p=self.envelope(bytes(b),e)
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)
    def test_boolean_attempt_does_not_equal_source_numeric_attempt(self):
        e,f,m=fixture();m['run']['attempt']=True;f['forensic-manifest.json']=raw(m)
        e=copy.deepcopy(e);e['run']['attempt']=1
        with self.assertRaises(A.Refusal): self.audit(f,e)
    def test_contradictory_hosted_identity_claims_refuse_without_claiming_physical_proof(self):
        for attack in ['hardlink','size','same-inode','special-mode']:
            e,f,m=fixture();row=m['files'][0]
            if attack=='hardlink': row['originalIdentity'][3]='2'
            if attack=='size': row['copyIdentity'][4]='1'
            if attack=='same-inode': row['copyIdentity'][:2]=row['originalIdentity'][:2]
            if attack=='special-mode': row['originalIdentity'][2]=str(0o120777)
            f['forensic-manifest.json']=raw(m)
            with self.subTest(attack=attack),self.assertRaises(A.Refusal): self.audit(f,e)
    def test_frozen_contract_cap_swap_refuses_even_when_sum_unchanged(self):
        c=copy.deepcopy(C);names=list(c['caps']);c['caps'][names[0]]+=1;c['caps'][names[1]]-=1
        p=self.root/'changed-contract.json';p.write_bytes(raw(c))
        with self.assertRaises(A.Refusal): A.contract(p)
    def test_full_branch_is_explicitly_partial_and_mutated_ref_refuses(self):
        e,f,m=full_fixture();z,p=self.envelope(zipbytes(list(f.items())),e,'full');r=A.audit(z,p,CONTRACT)
        self.assertEqual(r['branch'],'full');self.assertEqual(r['diagnosticArtifactAdmission'],'not-established')
        self.assertIn('frontend nested ZIP asset inventory and renderer/HTML joins',r['unavailable'])
        f['diagnostic-worker.mjs']+=b'mutation';z,p=self.envelope(zipbytes(list(f.items())),e,'full')
        with self.assertRaises(A.Refusal): A.audit(z,p,CONTRACT)

    def cli(self, z, p, tool=TOOL, extra=(), cwd=None):
        return subprocess.run([sys.executable, '-I', '-S', '-B', str(tool),
                               '--zip', str(z), '--parameters', str(p), *extra],
                              cwd=cwd or self.root, env={'PATH': ''},
                              capture_output=True, timeout=15)

    def test_public_contract_id_loads_without_consumer_checkout(self):
        self.assertEqual(A.contract()['commit'], C['commit'])
        consumer = self.root/'different consumer with spaces'/'tools'
        (consumer/'contracts').mkdir(parents=True)
        copied = consumer/TOOL.name
        copied.write_bytes(TOOL.read_bytes())
        (consumer/'contracts'/CONTRACT.name).write_bytes(CONTRACT.read_bytes())
        e,f,_=fixture();z,p=self.envelope(zipbytes(list(f.items())),e)
        result=self.cli(z,p,copied,extra=('--contract', A.CONTRACT_ID))
        self.assertEqual(result.returncode,0,result.stderr)
        report=json.loads(result.stdout)
        self.assertEqual(report['contractId'], A.CONTRACT_ID)
        self.assertEqual(report['source']['commitSha'], C['commit'])
        self.assertFalse((consumer.parent/'.git').exists())

    def test_contract_source_fields_and_raw_line_endings_are_immutable(self):
        for key in ['commit','tree','lockSha256','release','sourcePins']:
            c=copy.deepcopy(C);c[key]='changed'
            path=self.root/'mutated-contract.json';path.write_bytes(raw(c))
            with self.subTest(key=key),self.assertRaises(A.Refusal):A.contract(path)
        path.write_bytes(CONTRACT.read_bytes().replace(b'\n',b'\r\n'))
        with self.assertRaises(A.Refusal):A.contract(path)

    def test_public_report_separates_selected_checks_and_producer_claims(self):
        for branch in ['forensic','full']:
            e,f,_=fixture() if branch=='forensic' else full_fixture()
            z,p=self.envelope(zipbytes(list(f.items())),e,branch)
            report=A.audit(z,p)
            self.assertEqual(report['schemaVersion'],1)
            self.assertEqual(report['kind'],'scroll-cause-retained-inspection')
            self.assertTrue(report['verifiedChecks'])
            self.assertTrue(report['producerAssertions'])
            for scope in ['full publisher schema/writerClosure semantics',
                          'browser/raw/client/case closure replay and child footer laws',
                          'frontend nested ZIP asset inventory and renderer/HTML joins',
                          'native scenario admission']:
                self.assertIn(scope,report['unavailable'])
            for key in ['qualification','nativeGO','performance','scoring','ranking']:
                self.assertIs(report[key],False)
            self.assertEqual(report['fps'],'unavailable')

    def test_exact_formatted_report_byte_cap_counts_escapes_and_newline(self):
        self.assertTrue(callable(getattr(A,'render_report',None)), 'missing exact report serializer')
        empty=len((json.dumps({'value':''},indent=2)+'\n').encode())
        value='\x00'*100+'a'*(1048576-empty-600)
        encoded=A.render_report({'value':value})
        self.assertIsInstance(encoded,bytes)
        self.assertEqual(len(encoded),1048576)
        self.assertTrue(encoded.endswith(b'\n'))
        with self.assertRaises(A.Refusal):A.render_report({'value':value+'a'})

    def test_cli_refusal_is_finite_false_authority_and_exit_two(self):
        z=self.root/'bad.zip';z.write_bytes(b'not a ZIP')
        p=self.root/'parameters.json';p.write_bytes(b'{}')
        result=self.cli(z,p)
        self.assertEqual(result.returncode,2)
        report=json.loads(result.stdout)
        self.assertEqual(report['reasonCode'],'INTEGRITY')
        self.assertEqual(report['diagnosticArtifactAdmission'],'not-established')
        self.assertIs(report['qualification'],False)
        self.assertEqual(report['fps'],'unavailable')

    def test_cli_internal_error_never_formats_foreign_exception(self):
        class ForeignError(Exception):
            def __str__(self):raise AssertionError('foreign exception formatted')
        self.assertTrue(callable(getattr(A,'main',None)))
        output=io.StringIO()
        with patch.object(A,'audit',side_effect=ForeignError()),contextlib.redirect_stdout(output):
            code=A.main(['--zip','anything','--parameters','anything'])
        self.assertEqual(code,1)
        self.assertEqual(json.loads(output.getvalue())['reasonCode'],'INTERNAL')

    def test_cli_help_and_relative_inputs_have_no_artifact_side_effects(self):
        e,f,_=fixture();z,p=self.envelope(zipbytes(list(f.items())),e)
        before={x.name:digest(x.read_bytes())for x in self.root.iterdir()}
        help_result=subprocess.run([sys.executable,'-I','-S','-B',str(TOOL),'--help'],
                                   cwd=self.root,env={'PATH':''},capture_output=True,timeout=15)
        self.assertEqual(help_result.returncode,0)
        self.assertIn(b'AIMock',help_result.stdout)
        result=self.cli(z.name,p.name)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(before,{x.name:digest(x.read_bytes())for x in self.root.iterdir()})

    def test_missing_no_follow_platform_refuses_before_input_open(self):
        self.assertTrue(callable(getattr(A,'require_platform',None)), 'missing platform capability gate')
        with patch.object(A.os,'O_NOFOLLOW',None),patch.object(A.os,'open') as opened:
            with self.assertRaises(A.Refusal):A.require_platform()
            opened.assert_not_called()

    def test_zero_no_follow_flag_is_not_a_supported_platform(self):
        with patch.object(A.os,'O_NOFOLLOW',0),patch.object(A.os,'open') as opened:
            with self.assertRaises(A.Refusal):A.require_platform()
            opened.assert_not_called()

    def test_central_records_are_scanned_before_zipfile_inventory_allocation(self):
        data=bytearray(zipbytes([('parent.stdout',b'a'),('parent.stderr',b'b')]))
        end=data.rfind(b'PK\x05\x06')
        struct.pack_into('<HH',data,end+8,1,1)  # EOCD lies about two central records.
        with patch.object(A.zipfile,'ZipFile',side_effect=AssertionError('allocated too early')):
            with self.assertRaises(A.Refusal):A.archive_members(bytes(data),C['caps'])

    def test_zip32_data_descriptor_and_malformed_descriptor(self):
        class NonSeek(io.BytesIO):
            def seekable(self):return False
            def seek(self,*args):raise OSError('nonseek fixture')
        stream=NonSeek()
        with zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('parent.stdout',b'abc')
        signed=stream.getvalue()
        self.assertEqual(A.archive_members(signed,C['caps'])['parent.stdout'],b'abc')
        at=signed.index(b'PK\x07\x08')
        unsigned=bytearray(signed[:at]+signed[at+4:])
        end=unsigned.rfind(b'PK\x05\x06')
        offset=struct.unpack_from('<I',unsigned,end+16)[0]
        struct.pack_into('<I',unsigned,end+16,offset-4)
        self.assertEqual(A.archive_members(bytes(unsigned),C['caps'])['parent.stdout'],b'abc')
        bad=bytearray(signed);bad[at+4]^=1
        with self.assertRaises(A.Refusal):A.archive_members(bytes(bad),C['caps'])

    def test_file_no_follow_single_link_and_exact_byte_cap(self):
        p=self.root/'input.bin';p.write_bytes(b'abc')
        self.assertEqual(A.read_file(p,3),b'abc')
        with self.assertRaises(A.Refusal):A.read_file(p,2)
        link=self.root/'symlink';link.symlink_to(p)
        with self.assertRaises(A.Refusal):A.read_file(link,3)
        hard=self.root/'hardlink';os.link(p,hard)
        with self.assertRaises(A.Refusal):A.read_file(p,3)
        hard.unlink()
        with self.assertRaises(A.Refusal):A.read_file(self.root,100)
        fifo=self.root/'fifo';os.mkfifo(fifo)
        with self.assertRaises(A.Refusal):A.read_file(fifo,100)

    def test_file_growth_and_path_replacement_refuse_without_fd_leaks(self):
        p=self.root/'input.bin';real_read=os.read;real_close=os.close
        for attack in ['grow','replace']:
            p.write_bytes(b'abc');changed=False;closed=[]
            def read(fd,size):
                nonlocal changed
                if not changed:
                    changed=True
                    if attack=='grow':
                        with p.open('ab') as f:f.write(b'd')
                    else:
                        other=self.root/'replacement';other.write_bytes(b'abc');os.replace(other,p)
                return real_read(fd,size)
            def close(fd):closed.append(fd);return real_close(fd)
            with self.subTest(attack=attack),patch.object(A.os,'read',side_effect=read),patch.object(A.os,'close',side_effect=close):
                with self.assertRaises(A.Refusal):A.read_file(p,3)
            self.assertEqual(len(closed),1)

    def test_json_utf16_numeric_array_and_work_boundaries(self):
        self.assertEqual(A.parse_json(raw('\U0001f98a'*32768)), '\U0001f98a'*32768)
        for value in ['\U0001f98a'*32769,[0]*8193,[[0]*35 for _ in range(8192)]]:
            with self.assertRaises(A.Refusal):A.parse_json(raw(value))
        for token in [b'9007199254740992',b'1e999',b'1'+b'0'*128,b'"\xff"']:
            with self.assertRaises(A.Refusal):A.parse_json(token)

    def test_real_raw_role_32mib_boundary_and_over_cap_before_open(self):
        name='tracker-a-case-2-trace.json';cap=33554432
        data=zipbytes([(name,b'0'*cap)])
        self.assertEqual(len(A.archive_members(data,C['caps'])[name]),cap)
        over=zipbytes([(name,b'0'*(cap+1))])
        with patch.object(A.zipfile.ZipFile,'open',side_effect=AssertionError('over-cap decompressed')):
            with self.assertRaises(A.Refusal):A.archive_members(over,C['caps'])

    def test_regular_path_swapped_to_fifo_cannot_block_original_open(self):
        p=self.root/'input.bin';p.write_bytes(b'abc');real_open=os.open;real_close=os.close;closed=[]
        def open_after_swap(path,flags):
            self.assertTrue(flags & os.O_NONBLOCK,'regular-file race may block on swapped FIFO')
            p.unlink();os.mkfifo(p)
            return real_open(path,flags)
        def close(fd):closed.append(fd);return real_close(fd)
        with patch.object(A.os,'open',side_effect=open_after_swap),patch.object(A.os,'close',side_effect=close):
            with self.assertRaises(A.Refusal):A.read_file(p,3)
        self.assertEqual(len(closed),1)

    def test_missing_nonblocking_primitive_refuses_before_open(self):
        with patch.object(A.os,'O_NONBLOCK',None),patch.object(A.os,'open') as opened:
            with self.assertRaises(A.Refusal):A.require_platform()
            opened.assert_not_called()

    def test_nonzero_central_entry_disk_start_refuses_before_zipfile(self):
        data=bytearray(zipbytes([('parent.stdout',b'abc')]))
        at=data.index(b'PK\x01\x02');struct.pack_into('<H',data,at+34,1)
        with patch.object(A.zipfile,'ZipFile',side_effect=AssertionError('multidisk inventory allocated')):
            with self.assertRaises(A.Refusal):A.archive_members(bytes(data),C['caps'])

    def test_aggregate_and_external_zip_entry_limits_remain_distinct(self):
        data=zipbytes([('parent.stdout',b'123456'),('parent.stderr',b'123456')])
        with patch.object(A,'MAX_BYTES',10):
            with self.assertRaises(A.Refusal):A.archive_members(data,C['caps'])
        caps={f'file-{i}':1 for i in range(129)}
        exact=zipbytes([(name,b'')for name in list(caps)[:128]])
        self.assertEqual(len(A.archive_members(exact,caps)),128)
        over=zipbytes([(name,b'')for name in caps])
        with patch.object(A.zipfile,'ZipFile',side_effect=AssertionError('over-count inventory')):
            with self.assertRaises(A.Refusal):A.archive_members(over,caps)

    def test_provider_archive_digest_is_joined_before_zip_decompression(self):
        e,f,_=fixture();z,p=self.envelope(zipbytes(list(f.items())),e)
        parameters=json.loads(p.read_bytes());ref=parameters['originalReceipts']['artifact']
        original=pathlib.Path(ref['path']);value=json.loads(original.read_bytes())
        value['digest']='sha256:'+'0'*64;changed=raw(value);original.write_bytes(changed)
        ref.update(bytes=len(changed),sha256=digest(changed));p.write_bytes(raw(parameters))
        with patch.object(A,'archive_members',side_effect=AssertionError('decoded before digest join')):
            with self.assertRaises(A.Refusal):A.audit(z,p)

    def test_unknown_contract_selector_has_no_file_path_escape(self):
        result=self.cli('not-opened','not-opened',extra=('--contract',str(CONTRACT)))
        self.assertEqual(result.returncode,2)
        self.assertEqual(result.stdout,b'')
        self.assertIn(b'invalid choice',result.stderr)

    def test_module_import_defines_only_no_evidence_read(self):
        isolated=importlib.util.module_from_spec(spec)
        output=io.StringIO()
        with patch.object(A.os,'open',side_effect=AssertionError('evidence open on import')),contextlib.redirect_stdout(output):
            spec.loader.exec_module(isolated)
        self.assertEqual(output.getvalue(),'')
        self.assertEqual(isolated.CONTRACT_ID,A.CONTRACT_ID)

    def test_full_opaque_semantics_do_not_turn_into_admission_checks(self):
        e,f,_=full_fixture();z,p=self.envelope(zipbytes(list(f.items())),e,'full')
        report=A.audit(z,p)
        self.assertEqual(json.loads(f['diagnostic-manifest.json'])['writerClosure'],{})
        self.assertIn('full publisher schema/writerClosure semantics',report['unavailable'])
        self.assertNotIn('browser-closure',report['verifiedChecks'])
        self.assertNotIn('frontend-replay',report['verifiedChecks'])
        self.assertEqual(report['outcomes']['application']['exit']['exitCode'],2)
        self.assertEqual(report['diagnosticArtifactAdmission'],'not-established')

    def test_report_overflow_is_an_exit_two_refusal_before_stdout(self):
        output=io.StringIO()
        with patch.object(A,'audit',return_value={'value':'x'*1048576}),contextlib.redirect_stdout(output):
            code=A.main(['--zip','not-read','--parameters','not-read'])
        self.assertEqual(code,2)
        report=json.loads(output.getvalue())
        self.assertEqual(report['reasonCode'],'OUTPUT_LIMIT')
        self.assertLess(len(output.getvalue().encode()),1048576)

    def test_rehashed_provider_nonobject_step_is_cli_integrity_refusal(self):
        for malformed in [None,0,'step',[],True]:
            with self.subTest(step=malformed):
                e,f,_=fixture();z,p=self.envelope(zipbytes(list(f.items())),e)
                parameters=json.loads(p.read_bytes())
                job_path=self.root/'job.json';job=json.loads(job_path.read_bytes())
                job['steps'].append(malformed)
                changed=raw(job);job_path.write_bytes(changed)
                parameters['originalReceipts']['job'].update(bytes=len(changed),sha256=digest(changed))
                p.write_bytes(raw(parameters))
                result=self.cli(z,p)
                self.assertEqual(result.returncode,2,result.stdout)
                report=json.loads(result.stdout)
                self.assertEqual(report['reasonCode'],'INTEGRITY')
                self.assertFalse(report['qualification'])
                self.assertEqual(report['fps'],'unavailable')

    def test_rehashed_reserved_deflate_block_is_cli_integrity_refusal(self):
        e,f,_=fixture();archive=bytearray(zipbytes(list(f.items())))
        # First payload starts after the first ordinary local name/extra.
        name_length,extra_length=struct.unpack_from('<HH',archive,26)
        payload=30+name_length+extra_length
        self.assertEqual(struct.unpack_from('<H',archive,8)[0],8)
        # DEFLATE BTYPE=3 is reserved, independently of CRC/header consistency.
        archive[payload]=(archive[payload]&~7)|7
        # Rebuild all external byte/hash receipts so refusal reaches decompression.
        z,p=self.envelope(bytes(archive),e)
        result=self.cli(z,p)
        self.assertEqual(result.returncode,2,result.stdout)
        report=json.loads(result.stdout)
        self.assertEqual(report['reasonCode'],'INTEGRITY')
        self.assertFalse(report['qualification'])
        self.assertEqual(report['fps'],'unavailable')

if __name__=='__main__': unittest.main()
