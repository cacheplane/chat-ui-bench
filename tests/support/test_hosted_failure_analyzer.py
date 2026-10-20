"""Synthetic, offline-only checks. No private hosted evidence is loaded here."""
import importlib.util
import json
import hashlib
import copy
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from decimal import Decimal

TOOL = Path(__file__).resolve().parents[2] / 'tools/analyze-hosted-failure.py'


class AnalyzerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not TOOL.is_file():
            raise AssertionError('The offline analyzer must exist before it can authenticate failed captures')
        spec = importlib.util.spec_from_file_location('hosted_failure_analyzer', TOOL)
        cls.tool = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.tool)

    def decode(self, value):
        return self.tool.decode_json(value)[0]

    def fixture(self, directory, additions=None):
        root = Path(directory).resolve()
        artifact = root / 'evidence'
        expected = root / 'expected'
        artifact.mkdir()
        expected.mkdir()
        source = 'a' * 40
        profile = dict(schemaVersion=3,kind='tracker-a-profile',mode='tracker-a-anchor-handler-gate-v1',
            strictMode='tracker-json-a-pilot-v2',sourceSha=source,releaseId='synthetic-release',qualification=False,
            diagnostics=dict(sameOwnerAnchor=dict(protocol='tracker-a-anchor-scalars-v1',role=self.tool.ANCHOR,cap=65536,maxObservations=82)),
            wheelHandlerAfterGate=dict(protocol='tracker-a-wheel-handler-after-gate-v1',maxGates=40,
                entry='unchanged',arm='measured-before-existing-evaluate',wait='measured-after-existing-evaluate',event='same-original-wheel-listener'))
        intent = dict(source=dict(commitSha=source),context=dict(
            candidateSha=source,checkoutSha=source,githubSha=source,workflowSha=source,tagSha=source,
            attempt='1',releaseId='synthetic-release'),prerequisite=dict(originalRunId='999'))
        documents = {'native-intent.json':intent,self.tool.PROFILE:profile,
                     'parent.stdout':b'opaque sentinel\x00\xff'}
        documents.update(additions or {})
        for name, value in documents.items():
            (artifact/name).write_bytes(value if type(value) is bytes else json.dumps(value,separators=(',',':')).encode())
        self.reinventory(artifact, expected)
        return artifact, expected/'context.json', root/'report'

    def reinventory(self, artifact, expected):
        records = []
        for path in sorted(artifact.iterdir()):
            if path.name == self.tool.INVENTORY:
                continue
            raw = path.read_bytes()
            records.append(dict(path=path.name,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),regular=True,contained=True,symlink=False))
        def ref(name):
            record = next(row for row in records if row['path'] == name)
            return {key:record[key] for key in ('path','bytes','sha256')}
        inventory = dict(schemaVersion=1,kind='tracker-a-failure-inventory',status='unqualified-runtime-failure',
            profileRef=ref(self.tool.PROFILE),childResultRef=None,files=records,
            absent=[name for name in self.tool.TRACE_ROLES if name not in ('native-inventory.json',self.tool.INVENTORY) and name not in {row['path'] for row in records}],
            bytesBeforeInventory=sum(row['bytes'] for row in records),qualification=False,nativeGO=False,performance=False)
        raw = json.dumps(inventory,separators=(',',':')).encode()
        (artifact/self.tool.INVENTORY).write_bytes(raw)
        context = dict(sourceSha='a'*40,runId='12345',attempt=1,
            inventoryRef=dict(path=self.tool.INVENTORY,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
        (expected/'context.json').write_text(json.dumps(context))

    def inspect(self, artifact, context, output):
        return self.tool.inspect_failure(str(artifact),str(context),str(output))

    def scalar_input(self):
        rows=[]
        for ordinal,role,slot,scroll in [(1,'pre',None,120),(2,'before',0,110),(3,'after',0,100),(4,'before',1,107),(5,'post',None,108)]:
            rows.append(dict(ordinal=ordinal,role=role,slot=slot,requestedHostMs=ordinal*10,
                settledHostMs=ordinal*10+1,status='fulfilled',value=dict(pageNowMs=ordinal*10,
                    url='https://synthetic.invalid/',sameOriginalScroller=True,connected=True,uniqueSelector=True,
                    innerWidth=800,innerHeight=600,devicePixelRatio=1,rect=dict(x=0,y=0,width=100,height=100),
                    scrollTop=scroll,scrollHeight=500+ordinal,clientHeight=100)))
        event=lambda ordinal,page,dy: dict(ordinal=ordinal,receivedHostMs=page,pageNowMs=page,
            eventTimeStampMs=page-1,isTrusted=True,deltaX=0,deltaY=dy,deltaMode=0,targetContained=True,currentTargetIsScroller=True)
        gate=lambda slot,state:dict(slot=slot,beforeOrdinal=2+slot*2,afterOrdinal=3+slot*2,
            expectedEventOrdinal=slot+2,state=state,waitClaimed=state=='observed',listenerOwnedIdentity=True if state=='observed' else None,
            eventOrdinal=2 if state=='observed' else None,eventPageNowMs=25 if state=='observed' else None,
            eventTimeStampMs=24 if state=='observed' else None,cancellationReason='listener-remove' if state=='cancelled' else None,refusalCode=None)
        return dict(schemaVersion=2,kind='tracker-a-case-input',mode='tracker-json-a-pilot-v2',caseNumber=2,
            authority=dict(qualification=False,fps='unavailable',ratio='unavailable',scoring=False,ranking=False),
            scalarObservations=rows,wheelRequests=[dict(slot=0,nominalHostMs=20,requestedHostMs=22,settledHostMs=26,status='fulfilled',beforeOrdinal=2,afterOrdinal=3)],
            wheelEvents=[event(1,1,-600),event(2,25,-12)],handlerGates=[gate(0,'observed'),gate(1,'cancelled')],
            listeners={key:dict(registration=dict(status='not-started',requestedHostMs=None,settledHostMs=None),
                removal=dict(status='not-started',requestedHostMs=None,settledHostMs=None),ownedIdentityMatch=None)
                for key in ('wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose')},
            phase=dict(hostT0Ms=20,hostT1Ms=2020,postBoundaryScalarOrdinal=5,postBoundarySettled='fulfilled'),
            anchor=dict(id='selected',ownerToken=8),geometryCheckpoints=dict(G1=dict(status='fulfilled',snapshotRef=dict(path='native-case-2.json',index=1))))

    def anchor_input(self, input_value):
        selection=dict(snapshotRef=dict(path='native-case-2.json',index=1),id='selected',role='user',ownerToken=8,
            metric='min-positive-text-rect-viewport-y',contentTopCssPx=55,relativeTopCssPx=55,nativeViewportY=0)
        observations=[]
        for scalar in input_value['scalarObservations']:
            observations.append(dict(ordinal=scalar['ordinal'],role=scalar['role'],slot=scalar['slot'],status='available',reason=None,
                pageStartMs=scalar['value']['pageNowMs']+1,pageEndMs=scalar['value']['pageNowMs']+2,
                identity={key:True for key in self.tool.ANCHOR_IDENTITY},ownerToken=8,contentTopCssPx=55,relativeTopCssPx=55,nativeViewportY=0,
                textRectCount=1,eligible=True,scrollTopAfterProbe=scalar['value']['scrollTop'],jointReadStable=True,nodesVisited=1,rectangleUnits=1,textChars=1))
        value=dict(schemaVersion=1,kind='tracker-a-anchor-scalars-v1',profileRef=None,childResultRef=None,inputRef=None,
            selection=selection,observations=observations,qualification=False,nativeGO=False,performance=False)
        snapshots=[{},dict(snapshot=dict(status='available',frame=dict(nativeViewport=dict(y=0),expectedResponse=dict(id='response')),
            evaluation=dict(rows=[dict(id='selected',role='user',ownerToken=8,contentTopCssPx=55,relativeTopCssPx=55,geometryEligibility='eligible')])))]
        return value,snapshots

    def test_failed_prefix_gate_and_anchor_relations_without_success_cardinality(self):
        value=self.scalar_input()
        rows=self.tool.inspect_input(value)
        anchor,snapshots=self.anchor_input(value)
        observations=self.tool.inspect_anchor(anchor,value,rows,snapshots)
        capsule=dict(schemaVersion=1,kind='tracker-a-first-failure',profileRef=None,childResultRef=None,
            firstFailure=dict(code='opposing-offset',ordinal=4,previousOrdinal=3,slot=1),qualification=False,nativeGO=False,performance=False)
        self.assertEqual(self.tool.first_failure(capsule,rows)['code'],'opposing-offset')
        pair=self.tool.sample_pair(rows[3],rows[4],observations)
        self.assertEqual(pair['kind'],'inter-slot')
        self.assertEqual(pair['scrollTopDelta'],'7')
        self.assertTrue(pair['selectedAnchor']['equalAtSamples'])
        self.assertEqual(len(rows),5)

    def test_observed_gate_with_unreturned_after_scalar_keeps_partial_evidence(self):
        for status in ('rejected','pending'):
            with self.subTest(status=status):
                value=self.scalar_input()
                value['scalarObservations'][2].update(status=status,value=None,
                    settledHostMs=31 if status=='rejected' else None)
                rows=self.tool.inspect_input(value)
                self.assertIsNone(rows[3]['value'])
                self.assertEqual(self.tool.input_brackets(value,rows)['unavailable'],1)

    def test_event_timestamp_can_predate_before_scalar_when_handler_is_bracketed(self):
        value=self.scalar_input()
        value['wheelEvents'][1]['eventTimeStampMs']=5
        value['handlerGates'][0]['eventTimeStampMs']=5
        self.tool.inspect_input(value)

    def test_timestamp_reverse_failure_remains_inspectable(self):
        value=self.scalar_input();value['scalarObservations'][3]['value']['pageNowMs']=15
        rows=self.tool.inspect_input(value)
        capsule=dict(schemaVersion=1,kind='tracker-a-first-failure',profileRef=None,childResultRef=None,
            firstFailure=dict(code='timestamp-reverse',ordinal=4,previousOrdinal=3,slot=1),qualification=False,nativeGO=False,performance=False)
        self.assertEqual(self.tool.first_failure(capsule,rows)['code'],'timestamp-reverse')

    def test_scalar_gate_anchor_mismatches_are_integrity_refusals(self):
        for change in ('ordinal','slot','event','bracket','tuple','post','owner','probe','work','G1','missing-request'):
            with self.subTest(change=change):
                value=self.scalar_input()
                if change=='ordinal': value['scalarObservations'][2]['ordinal']=2
                if change=='slot': value['scalarObservations'][2]['slot']=1
                if change=='event': value['handlerGates'][0]['eventOrdinal']=1
                if change=='bracket': value['wheelEvents'][1]['pageNowMs']=40;value['handlerGates'][0]['eventPageNowMs']=40
                if change=='tuple': value['handlerGates'][1]['eventOrdinal']=3
                if change=='post': value['phase']['postBoundaryScalarOrdinal']=4
                if change=='missing-request': value['wheelRequests']=[]
                with self.assertRaises(self.tool.Refusal):
                    rows=self.tool.inspect_input(value)
                    anchor,snapshots=self.anchor_input(value)
                    if change=='owner': anchor['observations'][1]['ownerToken']=9
                    if change=='probe': anchor['observations'][1]['scrollTopAfterProbe']+=1
                    if change=='work': anchor['observations'][1]['nodesVisited']=4097
                    if change=='G1': snapshots[1]['snapshot']['evaluation']['rows'][0]['id']='different'
                    self.tool.inspect_anchor(anchor,value,rows,snapshots)

    def transport_fixture(self):
        def op(ordinal,kind,size=None,eof=None,read=None,handle=None):
            return dict(ordinal=ordinal,kind=kind,requestedHostMs=ordinal*10,settledHostMs=ordinal*10+1,
                status='fulfilled',timedOut=False,handleOrdinal=handle,bytes=size,eof=eof,readOperationOrdinal=read)
        operations=[op(1,'start'),op(2,'end'),op(3,'read',4,False,handle=1),op(4,'write',4,read=3),
            op(5,'read',0,True,handle=1),op(6,'io-close',handle=1),op(7,'sink-finish'),op(8,'detach')]
        def closed_listener():
            return dict(registration=dict(status='fulfilled',requestedHostMs=1,settledHostMs=2),
                removal=dict(status='fulfilled',requestedHostMs=90,settledHostMs=91),ownedIdentityMatch=True)
        raw=b'{}  '
        facts={self.tool.RAW:dict(bytes=4,sha256=hashlib.sha256(raw).hexdigest())}
        value=dict(schemaVersion=1,kind='tracker-a-transport',mode='tracker-json-a-pilot-v2',authority={},
            raw=dict(status='complete-raw',extent='complete',ref=dict(path=self.tool.RAW,**facts[self.tool.RAW])),
            operations=operations,portCalls=8,readCalls=2,knownReadBytes=4,listeners=dict(tracingComplete=closed_listener(),sessionClose=closed_listener()),
            completion=dict(firstHostMs=19,overflowHostMs=None,format='json',compression='none',dataLoss=False),
            sink=dict(created=True,finish='fulfilled',fsync='fulfilled',fileClose='fulfilled'),
            sessionClose=dict(firstHostMs=89,overflowHostMs=None,originalSessionMatch=True,timing='expected-detach'),
            handles=[dict(ordinal=1,firstHostMs=19,role='accepted',closeOperationOrdinal=6)],handleOverflow=None,
            outcome=dict(capture=dict(status='complete',reason=None),containment='verified'))
        return value,facts

    def test_transport_complete_capture_is_separate_from_scenario_completion(self):
        value,facts=self.transport_fixture()
        result=self.tool.transport(value,facts)
        self.assertEqual(result['status'],'completeCapturedRaw')
        self.assertEqual(result['scenarioCompletion'],'unqualified')
        value['completion']['dataLoss']=True
        self.assertEqual(self.tool.transport(value,facts)['status'],'unavailable')
        value['completion']['dataLoss']=False
        value['outcome']['capture']=dict(status='incomplete',reason='transport')
        self.assertEqual(self.tool.transport(value,facts)['status'],'unavailable')

    def test_positive_eof_read_keeps_its_linked_write_before_close(self):
        value,facts=self.transport_fixture()
        value['operations'][2]['bytes']=2
        value['operations'][3]['bytes']=2
        value['operations'][4]['bytes']=2
        final_write=copy.deepcopy(value['operations'][3])
        final_write.update(readOperationOrdinal=5,requestedHostMs=52,settledHostMs=53)
        value['operations'].insert(5,final_write)
        for ordinal,operation in enumerate(value['operations'],1): operation['ordinal']=ordinal
        value['portCalls']=9
        value['handles'][0]['closeOperationOrdinal']=7
        self.assertEqual(self.tool.transport(value,facts)['status'],'completeCapturedRaw')
        value['operations'][4]['eof']=False
        with self.assertRaises(self.tool.Refusal): self.tool.transport(value,facts)

    def test_valid_interrupted_transport_is_unavailable_not_fabricated_closure(self):
        value,facts=self.transport_fixture()
        value['operations']=value['operations'][:3]
        value['operations'][-1].update(status='rejected',bytes=None,eof=None)
        value.update(portCalls=3,readCalls=1,knownReadBytes=0,handles=[dict(ordinal=1,firstHostMs=19,role='accepted',closeOperationOrdinal=None)])
        value['raw']=dict(status='absent',ref=None,extent='unobserved')
        value['sink'].update(created=False,finish='not-started',fsync='not-started',fileClose='not-started')
        self.assertEqual(self.tool.transport(value,{})['status'],'unavailable')

    def test_schema_versions_are_integer_not_boolean(self):
        value,facts=self.transport_fixture();value['schemaVersion']=True
        with self.assertRaises(self.tool.Refusal): self.tool.transport(value,facts)

    def test_unclassified_failure_cannot_claim_scalar_context(self):
        value=self.scalar_input();rows=self.tool.inspect_input(value)
        capsule=dict(schemaVersion=1,kind='tracker-a-first-failure',profileRef=None,childResultRef=None,
            firstFailure=dict(code='unclassified',ordinal=4,previousOrdinal=3,slot=1),qualification=False,nativeGO=False,performance=False)
        with self.assertRaises(self.tool.Refusal): self.tool.first_failure(capsule,rows)

    def test_capsule_predicate_and_previous_scalar_context_are_exact(self):
        rows=self.tool.scalar_rows(self.scalar_input()['scalarObservations'])
        for change in ('previous','offset','timestamp','end-stop'):
            with self.subTest(change=change):
                capsule=dict(schemaVersion=1,kind='tracker-a-first-failure',profileRef=None,childResultRef=None,
                    firstFailure=dict(code='opposing-offset',ordinal=4,previousOrdinal=3,slot=1),qualification=False,nativeGO=False,performance=False)
                copy_rows=copy.deepcopy(rows)
                if change=='previous': capsule['firstFailure']['previousOrdinal']=2
                if change=='offset': copy_rows[4]['value']['scrollTop']=99
                if change=='timestamp': capsule['firstFailure']['code']='timestamp-reverse'
                if change=='end-stop': capsule['firstFailure']['code']='end-stop'
                with self.assertRaises(self.tool.Refusal): self.tool.first_failure(capsule,copy_rows)

    def test_transport_write_after_close_or_finish_is_refused(self):
        for insertion in (5,6,7):
            with self.subTest(insertion=insertion):
                value,facts=self.transport_fixture()
                write=value['operations'].pop(3)
                value['operations'].insert(insertion,write)
                for ordinal,operation in enumerate(value['operations'],1): operation['ordinal']=ordinal
                # Original read remains ordinal3; all other recorded joins adjusted.
                value['handles'][0]['closeOperationOrdinal']=next(op['ordinal'] for op in value['operations'] if op['kind']=='io-close')
                with self.assertRaises(self.tool.Refusal): self.tool.transport(value,facts)

    def test_transport_ref_bytes_eof_writes_order_and_counter_mismatch(self):
        for change in ('bytes','eof','write','close','ordinal','counter','listener','handle','missing-listener','alien-handle','clock'):
            with self.subTest(change=change):
                value,facts=self.transport_fixture()
                if change=='bytes': value['operations'][3]['bytes']=3
                if change=='eof': value['operations'][2]['eof']=True
                if change=='write': value['operations'][3]['readOperationOrdinal']=5
                if change=='close': value['operations'][5]['kind']='detach'
                if change=='ordinal': value['operations'][2]['ordinal']=4
                if change=='counter': value['knownReadBytes']=5
                if change=='listener': value['listeners']['sessionClose']['removal']['status']='forged'
                if change=='handle': value['handles'][0]['closeOperationOrdinal']=7
                if change=='missing-listener': value['listeners']={}
                if change=='alien-handle': value['operations'][2]['handleOrdinal']=2
                if change=='clock': value['completion']['firstHostMs']=True
                with self.assertRaises(self.tool.Refusal): self.tool.transport(value,facts)

    def test_semantic_arithmetic_preserves_more_than_28_digits(self):
        value=self.scalar_input()
        value['phase']['hostT0Ms']=Decimal('100.00000000000000000000000000001')
        value['phase']['hostT1Ms']=Decimal('2100.00000000000000000000000000001')
        rows=self.tool.inspect_input(value)
        anchor,snapshots=self.anchor_input(value)
        anchor['observations'][0].update(contentTopCssPx=Decimal('55.00000000000000000000000000001'),
            nativeViewportY=Decimal('0.00000000000000000000000000001'),relativeTopCssPx=55)
        self.tool.inspect_anchor(anchor,value,rows,snapshots)
        value['phase']['hostT0Ms']=Decimal('1e40')
        value['phase']['hostT1Ms']=Decimal('1e40')
        with self.assertRaises(self.tool.Refusal): self.tool.inspect_input(value)

    def test_minimal_failed_prefix_publishes_only_observations(self):
        with tempfile.TemporaryDirectory() as temp:
            artifact, context, output = self.fixture(temp)
            receipt = self.inspect(artifact,context,output)
            report = json.loads((output/'report.json').read_text())
            self.assertEqual(receipt['status'],'report-published')
            self.assertEqual(report['identity']['runId'],'12345')
            self.assertEqual(report['identity']['runIdentity'],'caller-supplied-unjoined')
            self.assertEqual(report['authority'], self.tool.AUTHORITY)
            self.assertEqual(report['samplePairs'],[])
            self.assertEqual(report['capturedAcquisition']['status'],'unavailable')
            self.assertNotIn('sentinel',json.dumps(report))
            self.assertEqual(report['integrity']['files'],4)
            inventory=(artifact/self.tool.INVENTORY).read_bytes()
            context_raw=context.read_bytes()
            self.assertEqual(report['inputReferences']['inventory'],dict(path=self.tool.INVENTORY,
                bytes=len(inventory),sha256=hashlib.sha256(inventory).hexdigest()))
            self.assertEqual(report['inputReferences']['context'],dict(bytes=len(context_raw),sha256=hashlib.sha256(context_raw).hexdigest()))
            self.assertNotIn(str(context),json.dumps(report))

    def test_source_file_metadata_is_not_an_artifact_import_or_ref(self):
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output=self.fixture(temp)
            path=artifact/'native-intent.json';value=json.loads(path.read_text())
            value['source']['files']=[dict(path='src/opaque-source.ts',bytes=12,sha256='b'*64)]
            path.write_text(json.dumps(value));self.reinventory(artifact,context.parent)
            self.inspect(artifact,context,output)
            report=json.loads((output/'report.json').read_text())
            self.assertIn('production-semantic-admission-replay',report['unsupportedRelations'])

    def test_opaque_bytes_and_inventory_absence_cannot_be_forged(self):
        for change in ('opaque','absent','extra','missing','duplicate','bool-bytes','claimed-regular'):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as temp:
                artifact, context, output = self.fixture(temp)
                inventory_path = artifact/self.tool.INVENTORY
                inventory = json.loads(inventory_path.read_text())
                if change == 'opaque':
                    (artifact/'parent.stdout').write_bytes(b'changed')
                elif change == 'extra':
                    (artifact/'unknown.txt').write_bytes(b'x')
                elif change == 'missing':
                    (artifact/'parent.stdout').unlink()
                else:
                    if change == 'absent': inventory['absent'] = []
                    if change == 'duplicate': inventory['files'].append(inventory['files'][0])
                    if change == 'bool-bytes': inventory['files'][0]['bytes'] = True
                    if change == 'claimed-regular': inventory['files'][0]['regular'] = 1
                    inventory_path.write_text(json.dumps(inventory))
                    raw = inventory_path.read_bytes()
                    expected = json.loads(context.read_text())
                    expected['inventoryRef'].update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
                    context.write_text(json.dumps(expected))
                with self.assertRaises(self.tool.Refusal):
                    self.inspect(artifact,context,output)
                self.assertFalse(output.exists())

    def test_source_attempt_versions_and_present_malformed_optional_refused(self):
        for change in ('source','attempt','version','optional','ref'):
            with self.subTest(change=change),tempfile.TemporaryDirectory() as temp:
                artifact,context,output = self.fixture(temp)
                profile_path = artifact/self.tool.PROFILE
                profile = json.loads(profile_path.read_text())
                if change == 'source': profile['sourceSha']='b'*40
                if change == 'version': profile['schemaVersion']=4
                if change == 'ref': profile['forgedRef']=dict(path='parent.stdout',bytes=0,sha256='0'*64)
                profile_path.write_text(json.dumps(profile))
                if change == 'optional': (artifact/self.tool.ANCHOR).write_text('{}')
                self.reinventory(artifact,context.parent)
                if change == 'attempt':
                    expected=json.loads(context.read_text());expected['attempt']=True;context.write_text(json.dumps(expected))
                with self.assertRaises(self.tool.Refusal):
                    self.inspect(artifact,context,output)

    def test_role_caps_exact_and_plus_one(self):
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output = self.fixture(temp,{'profile.stdout':b'x'*65536})
            self.inspect(artifact,context,output)
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output = self.fixture(temp,{'profile.stdout':b'x'*65537})
            with self.assertRaises(self.tool.Refusal) as caught:
                self.inspect(artifact,context,output)
            self.assertEqual(caught.exception.code,'BYTES')

    def test_symlink_hardlink_and_output_overlap_refused(self):
        for change in ('symlink','hardlink','output-child','output-ancestor','existing'):
            with self.subTest(change=change),tempfile.TemporaryDirectory() as temp:
                artifact,context,output = self.fixture(temp)
                if change in ('symlink','hardlink'):
                    destination = artifact/'parent.stdout'
                    saved = Path(temp)/'saved'
                    destination.rename(saved)
                    if change == 'symlink': destination.symlink_to(saved)
                    else: os.link(saved,destination)
                if change == 'output-child': output=artifact/'output'
                if change == 'output-ancestor': output=Path(temp)
                if change == 'existing': output.mkdir()
                with self.assertRaises(self.tool.Refusal):
                    self.inspect(artifact,context,output)

    def test_namespace_and_original_mutation_before_publication_refused(self):
        for mode in ('file','namespace'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as temp:
                artifact,context,output=self.fixture(temp)
                original=self.tool.context_join
                def mutate(*args):
                    result=original(*args)
                    (artifact/('parent.stdout' if mode=='file' else 'parent.stderr')).write_bytes(b'changed')
                    return result
                with patch.object(self.tool,'context_join',side_effect=mutate):
                    with self.assertRaises(self.tool.Refusal): self.inspect(artifact,context,output)
                self.assertFalse(output.exists())

    def test_original_and_output_lifetime_survive_report_write(self):
        for mode in ('original','context','namespace','report-hardlink'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as temp:
                artifact,context,output=self.fixture(temp)
                original=self.tool.os.fsync
                def mutate(descriptor):
                    original(descriptor)
                    if mode=='original': (artifact/'parent.stdout').write_bytes(b'changed')
                    if mode=='context': context.write_text('{}')
                    if mode=='namespace': (artifact/'parent.stderr').write_bytes(b'new')
                    if mode=='report-hardlink': os.link(output/'report.json',Path(temp)/'report-alias')
                with patch.object(self.tool.os,'fsync',side_effect=mutate):
                    with self.assertRaises(self.tool.Refusal): self.inspect(artifact,context,output)
                self.assertTrue((output/'report.json').exists())

    def test_output_parent_symlink_swap_never_writes_evidence(self):
        for boundary in ('mkdir','open-child','open-report'):
            with self.subTest(boundary=boundary),tempfile.TemporaryDirectory() as temp:
                artifact,context,_=self.fixture(temp)
                root=Path(temp).resolve();parent=root/'destination';parent.mkdir()
                output=parent/'report';parked=root/'parked'
                original_names=set(path.name for path in artifact.iterdir())
                real_open=self.tool.os.open;real_mkdir=self.tool.os.mkdir
                swapped=[]
                def swap():
                    parent.rename(parked);parent.symlink_to(artifact);swapped.append(True)
                def mkdir(name,*args,**kwargs):
                    if boundary=='mkdir' and name=='report' and not swapped: swap()
                    return real_mkdir(name,*args,**kwargs)
                def open_file(name,*args,**kwargs):
                    if ((boundary=='open-child' and name=='report') or
                        (boundary=='open-report' and name=='report.json')) and not swapped: swap()
                    return real_open(name,*args,**kwargs)
                with patch.object(self.tool.os,'mkdir',side_effect=mkdir) as mocked_mkdir, patch.object(self.tool.os,'open',side_effect=open_file) as mocked_open:
                    with patch.object(self.tool.os,'supports_dir_fd',self.tool.os.supports_dir_fd|{mocked_mkdir,mocked_open}):
                        with self.assertRaises(self.tool.Refusal): self.inspect(artifact,context,output)
                self.assertEqual(swapped,[True])
                self.assertEqual(set(path.name for path in artifact.iterdir()),original_names)
                self.assertFalse((artifact/'report').exists())
                self.assertFalse((artifact/'report.json').exists())

    def test_external_kind_multiplicity_refused_before_reads(self):
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output=self.fixture(temp)
            provider=context.parent/'provider.json'
            provider.write_text('{"id":12345,"run_attempt":1,"head_sha":"'+'a'*40+'"}')
            raw=provider.read_bytes()
            external=dict(kind='provider-run',path=str(provider),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
            expected=json.loads(context.read_text());expected['externalRefs']=[external,external]
            context.write_text(json.dumps(expected))
            with self.assertRaises(self.tool.Refusal): self.inspect(artifact,context,output)

    def test_provider_context_is_matched_but_remains_caller_supplied(self):
        for mismatch in (False,True):
            with self.subTest(mismatch=mismatch),tempfile.TemporaryDirectory() as temp:
                artifact,context,output=self.fixture(temp)
                provider=context.parent/'provider.json'
                provider.write_text(json.dumps(dict(id=12345,run_attempt=2 if mismatch else 1,head_sha='a'*40)))
                raw=provider.read_bytes()
                expected=json.loads(context.read_text());expected['externalRefs']=[dict(kind='provider-run',path=str(provider),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())]
                context.write_text(json.dumps(expected))
                if mismatch:
                    with self.assertRaises(self.tool.Refusal): self.inspect(artifact,context,output)
                else:
                    self.inspect(artifact,context,output)
                    report=json.loads((output/'report.json').read_text())
                    self.assertEqual(report['identity']['runIdentity'],'caller-supplied-provider-context-matched')
                    self.assertEqual(report['identity']['externalProvenance'],'caller-supplied')
                    self.assertIn('provider-provenance',report['unavailableRelations'])

    def test_success_cli_receipt_only_admits_report(self):
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output=self.fixture(temp)
            result=subprocess.run([sys.executable,'-I','-S','-B',str(TOOL),'--artifact-dir',str(artifact),
                '--context',str(context),'--out',str(output)],capture_output=True,check=False)
            self.assertEqual(result.returncode,0)
            self.assertEqual(result.stderr,b'')
            receipt=json.loads(result.stdout)
            self.assertEqual(receipt['status'],'report-published')
            self.assertEqual(receipt['authority'],self.tool.AUTHORITY)
            self.assertEqual(receipt['sha256'],hashlib.sha256((output/'report.json').read_bytes()).hexdigest())

    def test_valid_hash_for_wrong_role_is_not_a_profile_join(self):
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output=self.fixture(temp)
            inventory=json.loads((artifact/self.tool.INVENTORY).read_text())
            other=next(row for row in inventory['files'] if row['path']=='native-intent.json')
            inventory['profileRef']={key:other[key] for key in ('path','bytes','sha256')}
            raw=json.dumps(inventory).encode();(artifact/self.tool.INVENTORY).write_bytes(raw)
            expected=json.loads(context.read_text())
            expected['inventoryRef'].update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
            context.write_text(json.dumps(expected))
            with self.assertRaises(self.tool.Refusal): self.inspect(artifact,context,output)

    def test_original_drain_receipt_required_for_published_input(self):
        value=dict(status='fulfilled',requestedHostMs=1,settledHostMs=2)
        self.assertEqual(self.tool.input_drain(value,True)['status'],'closed-original-input-drain')
        for change in ('pending','time','boolean'):
            changed=copy.deepcopy(value)
            if change=='pending': changed.update(status='pending',settledHostMs=None)
            if change=='time': changed['settledHostMs']=0
            if change=='boolean': changed['requestedHostMs']=True
            with self.assertRaises(self.tool.Refusal): self.tool.input_drain(changed,True)

    def test_moving_container_is_not_viewport_stability(self):
        a={'ordinal':3,'role':'after','slot':0,'value':dict(scrollTop=100,scrollHeight=500,pageNowMs=10)}
        b={'ordinal':4,'role':'before','slot':1,'value':dict(scrollTop=107,scrollHeight=509,pageNowMs=20)}
        anchors={3:dict(status='available',ownerToken=8,jointReadStable=True,relativeTopCssPx=55,nativeViewportY=0,contentTopCssPx=55),
                 4:dict(status='available',ownerToken=8,jointReadStable=True,relativeTopCssPx=55,nativeViewportY=10,contentTopCssPx=65)}
        selected=self.tool.sample_pair(a,b,anchors)['selectedAnchor']
        self.assertEqual(selected['viewportDelta'],'10')
        self.assertEqual(selected['scrollerRelativeDelta'],'0')
        self.assertFalse(selected['equalAtSamples'])

    def test_cli_refusal_is_bounded_and_does_not_leak_payload(self):
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output=self.fixture(temp)
            (artifact/'parent.stdout').write_bytes(b'PRIVATE_SENTINEL_BAD_BYTES')
            result=subprocess.run([sys.executable,'-I','-S','-B',str(TOOL),'--artifact-dir',str(artifact),
                '--context',str(context),'--out',str(output)],capture_output=True,check=False)
            self.assertEqual(result.returncode,2)
            self.assertEqual(result.stderr,b'')
            self.assertLess(len(result.stdout),4096)
            self.assertNotIn(b'PRIVATE_SENTINEL',result.stdout)
            self.assertNotIn(str(artifact).encode(),result.stdout)
            self.assertEqual(json.loads(result.stdout)['authority'],self.tool.AUTHORITY)

    def refused(self, raw, code=None):
        with self.assertRaises(self.tool.Refusal) as caught:
            self.decode(raw)
        if code:
            self.assertEqual(caught.exception.code, code)

    def test_exact_adjacent_integers_and_decimal_arithmetic(self):
        value = self.decode(b'[9007199254740992,9007199254740993,0.1,1e4096]')
        self.assertNotEqual(value[0], value[1])
        self.assertIs(type(value[0]), int)
        self.assertEqual(value[2] + value[2], Decimal('0.2'))
        self.assertEqual(value[3], Decimal('1e4096'))

    def test_duplicate_decoded_keys_and_trailing_bytes_refused(self):
        for raw in [b'{"a":1,"\\u0061":2}', b'{}garbage', b'{}{}', b'\xff',
                    b'[NaN]', b'[Infinity]', b'{"traceEvents":[]} trailing']:
            with self.subTest(raw=raw):
                self.refused(raw, 'JSON')

    def test_numeric_bounds_before_large_decimal_construction(self):
        for raw in [b'1e4097', b'1e-4097', b'1' * 257]:
            self.refused(raw, 'NUMERIC')
        self.assertEqual(self.decode(b'1e-4096'), Decimal('1e-4096'))

    def test_depth_and_unknown_string_work_are_accounted(self):
        self.refused(b'[' * 66 + b'0' + b']' * 66, 'RESOURCE')
        with self.assertRaises(self.tool.Refusal):
            self.tool.decode_json(b'{"unknown":"' + b'x' * 2048 + b'"}', max_work=1024)

    def test_parser_nodes_keys_recursion_and_report_bytes_bound(self):
        with self.assertRaises(self.tool.Refusal): self.tool.decode_json(b'[1,2,3]',max_nodes=3)
        self.refused(json.dumps({str(i):0 for i in range(4097)}).encode(),'RESOURCE')
        self.refused(b'['*2000+b'0'+b']'*2000,'RESOURCE')
        with tempfile.TemporaryDirectory() as temp:
            artifact,context,output=self.fixture(temp)
            with patch.object(self.tool,'MAX_REPORT',100):
                with self.assertRaises(self.tool.Refusal): self.inspect(artifact,context,output)
            self.assertFalse(output.exists())

    def test_metadata_namespace_aggregate_exact_cap_and_plus_one(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp).resolve()
            roles=['native-prerequisite.zip','static-prerequisite.zip',self.tool.RAW,
                'browser-install.stderr','browser-install.stdout','install.stderr','install.stdout',
                'extract.stderr','extract.stdout','parent.stderr','parent.stdout']
            for role in roles:
                with (root/role).open('wb') as stream: stream.truncate(self.tool.ROLE_CAPS[role])
            self.assertEqual(len(self.tool.namespace(str(root))),11)
            (root/'application.stdout').write_bytes(b'x')
            with self.assertRaises(self.tool.Refusal) as caught: self.tool.namespace(str(root))
            self.assertEqual(caught.exception.code,'BYTES')

    def test_whole_trace_census_above_projector_limit_and_seven_megabytes(self):
        for count in [20000, 400000]:
            raw = b'{"traceEvents":[' + b','.join([b'{"opaque":"sentinel"}'] * count) + b']}'
            census = self.tool.trace_census(raw)
            self.assertEqual(census['eventObjects'], count)
            self.assertEqual(census['bytes'], len(raw))
            self.assertNotIn('sentinel', json.dumps(census))
            self.assertGreater(len(raw), 262144)

    def test_trace_requires_object_events_through_eof(self):
        for raw in [b'{"traceEvents":[{},1]}', b'{"traceEvents":[]}x', b'[]',
                    b'{"traceEvents":[],"traceEvents":[]}']:
            with self.assertRaises(self.tool.Refusal):
                self.tool.trace_census(raw)

    def test_pair_type_and_exact_selected_anchor_delta(self):
        a = {'ordinal':3, 'role':'after', 'slot':0, 'value':{'scrollTop':100,'scrollHeight':500,'pageNowMs':Decimal('100.00000000000000000000000000001')}}
        b = {'ordinal':4, 'role':'before', 'slot':1, 'value':{'scrollTop':107,'scrollHeight':509,'pageNowMs':Decimal('116.50000000000000000000000000001')}}
        anchors = {3:{'status':'available','ownerToken':8,'jointReadStable':True,'relativeTopCssPx':Decimal('55.1'),'nativeViewportY':0,'contentTopCssPx':Decimal('55.1')},
                   4:{'status':'available','ownerToken':8,'jointReadStable':True,'relativeTopCssPx':Decimal('55.1'),'nativeViewportY':0,'contentTopCssPx':Decimal('55.1')}}
        pair = self.tool.sample_pair(a,b,anchors)
        self.assertEqual(pair['kind'], 'inter-slot')
        self.assertEqual(pair['scrollTopDelta'], '7')
        self.assertEqual(pair['scrollHeightDelta'], '9')
        self.assertEqual(Decimal(pair['elapsedPageMs']),Decimal('16.5'))
        self.assertEqual(pair['units'],dict(geometry='CSSpx',elapsedPageMs='page-ms'))
        self.assertEqual(pair['selectedAnchor']['viewportDelta'], '0')
        self.assertTrue(pair['selectedAnchor']['equalAtSamples'])
        anchors[4]['ownerToken'] = 9
        self.assertEqual(self.tool.sample_pair(a,b,anchors)['selectedAnchor']['status'], 'unavailable')
        anchors[4]['ownerToken'] = 8
        anchors[4]['jointReadStable'] = False
        self.assertEqual(self.tool.sample_pair(a,b,anchors)['selectedAnchor']['status'], 'unavailable')


if __name__ == '__main__':
    unittest.main()
