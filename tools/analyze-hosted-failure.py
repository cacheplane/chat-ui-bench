#!/usr/bin/env python3
"""Offline observations of an authenticated retained failure; never qualification.

Python 3.12+ and the standard library only. Byte caps and postparse work limits
are not hard heap bounds: json.loads allocates before the iterative census.
No archived/source code is imported, no process is launched, and no network is
queried. Decimal arithmetic preserves source numbers without a float roundtrip.
"""
import argparse
from decimal import Decimal, Inexact, localcontext
from functools import wraps
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

MAX_BYTES = 134217728
MAX_FILES = 128
MAX_REPORT = 1048576
EXTERNAL_CAPS = {'provider-run':1048576,'archive':33554432,'extraction':1048576}
MAX_EXTERNAL_BYTES = 35651584
INVENTORY = 'tracker-a-failure-inventory.json'
PROFILE = 'tracker-a-profile.json'
RAW = 'tracker-a-case-2-trace.json'
INPUT = 'tracker-a-case-2-input.json'
ANCHOR = 'tracker-a-anchor-scalars-v1.json'
CHILD = 'native-child-result.json'
AUTHORITY = dict(qualification=False, nativeGO=False, performance=False,
                 scoring=False, ranking=False, fps='unavailable')
SHA = re.compile(r'[0-9a-f]{64}\Z')
SOURCE = re.compile(r'[0-9a-f]{40}\Z')
STATES = ('not-started', 'pending', 'fulfilled', 'rejected')
ANCHOR_IDENTITY = ('sameHostObject','sameOwner','sameScroller','sameScope','sameUrl',
                   'connected','uniqueSelectors','contained','parentMatched')
ANCHOR_REASONS = ('admission','selection','owner','host','scroller','scope','url',
                  'disconnected','selector','text','style','clip','work','rect',
                  'geometry','no-positive','fully-clipped','source-error')
ROLE_CAPS = {
    "application-result.json": 16384,
    "application-started.json": 524288,
    "application.stderr": 262144,
    "application.stdout": 262144,
    "browser-install-result.json": 524288,
    "browser-install-started.json": 524288,
    "browser-install.stderr": 4194304,
    "browser-install.stdout": 4194304,
    "browser-process.json": 524288,
    "browser-registry.json": 262144,
    "browser-stderr.bin": 262144,
    "browser-stdout.bin": 262144,
    "extract-result.json": 524288,
    "extract-started.json": 524288,
    "extract.stderr": 4194304,
    "extract.stdout": 4194304,
    "frontend-settings.json": 65536,
    "install-result.json": 524288,
    "install-started.json": 524288,
    "install.stderr": 4194304,
    "install.stdout": 4194304,
    "installed-admission.json": 524288,
    "native-case-1.json": 2097152,
    "native-case-2.json": 2097152,
    "native-child-failure.json": 4096,
    "native-child-options.json": 524288,
    "native-child-result.json": 524288,
    "native-intent.json": 524288,
    "native-inventory.json": 524288,
    "native-parent-partial.json": 524288,
    "native-prerequisite-artifact-intent.json": 524288,
    "native-prerequisite-artifact-receipt.json": 524288,
    "native-prerequisite-artifact.json": 262144,
    "native-prerequisite-intent.json": 524288,
    "native-prerequisite-receipt.json": 524288,
    "native-prerequisite-run-intent.json": 524288,
    "native-prerequisite-run-receipt.json": 524288,
    "native-prerequisite-run.json": 524288,
    "native-prerequisite.zip": 33554432,
    "native-result.json": 524288,
    "parent-result.json": 16384,
    "parent-started.json": 524288,
    "parent.stderr": 4194304,
    "parent.stdout": 4194304,
    "phase-failure-child.json": 4096,
    "phase-failure-install.json": 4096,
    "phase-failure-parent.json": 4096,
    "phase-failure-prepare.json": 4096,
    "phase-failure-provision.json": 4096,
    "phase-failure-run.json": 4096,
    "prerequisite-artifact-intent.json": 524288,
    "prerequisite-artifact-receipt.json": 524288,
    "prerequisite-artifact.json": 262144,
    "prerequisite-run-intent.json": 524288,
    "prerequisite-run-receipt.json": 524288,
    "prerequisite-run.json": 524288,
    "prerequisite.json": 524288,
    "profile-result.json": 524288,
    "profile-started.json": 524288,
    "profile.stderr": 65536,
    "profile.stdout": 65536,
    "static-prerequisite-intent.json": 524288,
    "static-prerequisite-receipt.json": 524288,
    "static-prerequisite.zip": 33554432,
    "tracker-a-anchor-scalars-v1.json": 65536,
    "tracker-a-case-2-input.json": 262144,
    "tracker-a-case-2-trace.json": 33554432,
    "tracker-a-case-2-transport.json": 1048576,
    "tracker-a-failure-inventory.json": 524288,
    "tracker-a-first-failure.json": 4096,
    "tracker-a-profile.json": 16384,
    "tracker-a-result.json": 262144
}

TRACE_ROLES = (
    'tracker-a-case-2-trace.json','tracker-a-case-2-input.json','tracker-a-case-2-transport.json',
    'tracker-a-result.json','native-case-1.json','native-case-2.json','native-child-result.json',
    'native-parent-partial.json','native-result.json','application-result.json','parent-result.json',
    'application.stdout','application.stderr','parent.stdout','parent.stderr','browser-stdout.bin',
    'browser-stderr.bin','native-inventory.json','phase-failure-child.json','phase-failure-parent.json',
    'phase-failure-run.json','native-child-failure.json','tracker-a-first-failure.json',
    'tracker-a-failure-inventory.json','tracker-a-anchor-scalars-v1.json')



class Refusal(Exception):
    """Only the finite code crosses the command line trust boundary."""
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def need(condition, code='SCHEMA'):
    if not condition:
        raise Refusal(code)


def integer(value, low=0, high=MAX_BYTES):
    need(type(value) is int and low <= value <= high)
    return value


def number(value):
    need(type(value) is int or isinstance(value, Decimal))
    need(not isinstance(value, Decimal) or value.is_finite())
    return value


def exact_semantics(function):
    """Isolate sufficient precision; never inherit the caller's Decimal policy."""
    @wraps(function)
    def run(*args, **kwargs):
        with localcontext() as context:
            context.prec = 8704
            context.traps[Inexact] = True
            return function(*args, **kwargs)
    return run


def fields(value, names):
    need(type(value) is dict and set(value) == set(names))
    return value


def authority(value):
    need(type(value) is dict)
    for key in ('qualification','nativeGO','performance','scoring','ranking'):
        if key in value:
            need(value[key] is False)
    for key in ('fps','ratio'):
        if key in value:
            need(value[key] == 'unavailable')


def numeric_token(token, decimal=False):
    need(len(token) <= 256, 'NUMERIC')
    exponent = re.search(r'[eE]([+-]?\d+)$', token)
    if exponent:
        need(abs(int(exponent[1])) <= 4096, 'NUMERIC')
    return Decimal(token) if decimal else int(token)


def decode_json(raw, *, max_work=16777216, max_nodes=1048576, max_depth=64):
    """Strict whole JSON syntax, then an honest postparse resource census."""
    def pairs(items):
        need(len(items) <= 4096, 'RESOURCE')
        result = {}
        for key, value in items:
            need(key not in result, 'JSON')
            result[key] = value
        return result

    def constant(_):
        raise Refusal('JSON')

    try:
        value = json.loads(raw.decode('utf-8', errors='strict'), object_pairs_hook=pairs,
                           parse_int=numeric_token,
                           parse_float=lambda token: numeric_token(token, True),
                           parse_constant=constant)
        stack = [(value, 1)]
        nodes = work = depth = 0
        while stack:
            item, level = stack.pop()
            nodes += 1
            work += 1
            depth = max(depth, level)
            need(nodes <= max_nodes and depth <= max_depth and work <= max_work, 'RESOURCE')
            if type(item) is dict:
                for key, child in item.items():
                    work += len(key.encode('utf-16-le', 'surrogatepass')) // 2 + 1
                    stack.append((child, level + 1))
            elif type(item) is list:
                stack.extend((child, level + 1) for child in item)
            elif type(item) is str:
                work += len(item.encode('utf-16-le', 'surrogatepass')) // 2
            need(work <= max_work, 'RESOURCE')
        return value, dict(nodes=nodes, work=work, depth=depth)
    except Refusal:
        raise
    except (MemoryError, RecursionError):
        raise Refusal('RESOURCE') from None
    except (ValueError, UnicodeError, OverflowError):
        raise Refusal('JSON') from None


def trace_census(raw):
    need(len(raw) <= 33554432, 'BYTES')
    value, census = decode_json(raw)
    need(type(value) is dict and type(value.get('traceEvents')) is list)
    need(all(type(event) is dict for event in value['traceEvents']))
    return dict(status='whole-json-census', bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
                eventObjects=len(value['traceEvents']), syntax=census,
                reconstruction='unavailable', fps='unavailable')


def decimal_text(value):
    number(value)
    # Avoid expansion of an authenticated large exponent into report-sized text.
    return '0' if value == 0 else str(value)


def delta(a, b):
    with localcontext() as context:
        context.prec = 8704
        return decimal_text(number(b) - number(a))


@exact_semantics
def sample_pair(a, b, anchors):
    kind = ('post' if b['role'] == 'post' else
            'same-wheel' if a['role'] == 'before' and b['role'] == 'after' and a['slot'] == b['slot'] else
            'inter-slot' if a['role'] == 'after' and b['role'] == 'before' and b['slot'] == a['slot'] + 1 else
            'other-adjacent')
    result = dict(previousOrdinal=a['ordinal'], ordinal=b['ordinal'], kind=kind,
                  elapsedPageMs=delta(a['value']['pageNowMs'], b['value']['pageNowMs']),
                  units=dict(geometry='CSSpx',elapsedPageMs='page-ms'),
                  scrollTopDelta=delta(a['value']['scrollTop'], b['value']['scrollTop']),
                  scrollHeightDelta=delta(a['value']['scrollHeight'], b['value']['scrollHeight']),
                  selectedAnchor=dict(status='unavailable', reason='missing-or-unstable-probe'))
    x, y = anchors.get(a['ordinal']), anchors.get(b['ordinal'])
    if x and y and x['status'] == y['status'] == 'available' and x['ownerToken'] == y['ownerToken'] and x['jointReadStable'] is True and y['jointReadStable'] is True:
        result['selectedAnchor'] = dict(status='available',
            viewportDelta=delta(x['contentTopCssPx'], y['contentTopCssPx']),
            scrollerRelativeDelta=delta(x['relativeTopCssPx'], y['relativeTopCssPx']),
            contentDelta=delta(x['contentTopCssPx'], y['contentTopCssPx']),
            nativeViewportDelta=delta(x['nativeViewportY'], y['nativeViewportY']),
            equalAtSamples=x['contentTopCssPx'] == y['contentTopCssPx'],
            interpretation='two-sample-coordinate-only')
    return result


def identity(value):
    return tuple(getattr(value, key) for key in
                 ('st_dev','st_ino','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns'))


def canonical(path, directory=False):
    need(type(path) is str and os.path.isabs(path), 'PATH')
    need(os.path.normpath(path) == path and os.path.realpath(path) == path, 'PATH')
    value = os.lstat(path)
    need(stat.S_ISDIR(value.st_mode) if directory else stat.S_ISREG(value.st_mode), 'PATH')
    if not directory:
        need(value.st_nlink == 1, 'PATH')
    return path


def file_read(path, cap):
    canonical(path)
    before = os.lstat(path)
    need(before.st_size <= cap, 'BYTES')
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    try:
        need(identity(os.fstat(descriptor)) == identity(before), 'LIFETIME')
        chunks = []
        total = 0
        while True:
            chunk = os.read(descriptor, min(65536, cap + 1 - total))
            if not chunk:
                break
            total += len(chunk)
            need(total <= cap, 'BYTES')
            chunks.append(chunk)
        need(identity(os.fstat(descriptor)) == identity(before), 'LIFETIME')
    finally:
        os.close(descriptor)
    need(identity(os.lstat(path)) == identity(before), 'LIFETIME')
    raw = b''.join(chunks)
    need(len(raw) == before.st_size, 'LIFETIME')
    return raw, dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()), identity(before)


def namespace(root):
    canonical(root, True)
    names = []
    total = 0
    with os.scandir(root) as entries:
        for entry in entries:
            need(len(names) < MAX_FILES, 'NAMESPACE')
            need(entry.name in ROLE_CAPS, 'ROLE')
            value = entry.stat(follow_symlinks=False)
            need(stat.S_ISREG(value.st_mode) and value.st_nlink == 1, 'PATH')
            need(value.st_size <= ROLE_CAPS[entry.name], 'BYTES')
            total += value.st_size
            need(total <= MAX_BYTES, 'BYTES')
            names.append(entry.name)
    return frozenset(names)


def reference(value, facts, expected=None):
    fields(value, ('path','bytes','sha256'))
    path = value['path']
    need(type(path) is str and path in facts and (expected is None or path == expected), 'REF')
    integer(value['bytes'])
    need(type(value['sha256']) is str and SHA.fullmatch(value['sha256']), 'REF')
    need(value['bytes'] == facts[path]['bytes'] and value['sha256'] == facts[path]['sha256'], 'REF')


def receipt(value, start='requestedHostMs'):
    fields(value, ('status', start, 'settledHostMs'))
    need(value['status'] in STATES)
    a, b = value[start], value['settledHostMs']
    if a is not None:
        need(number(a) >= 0)
    if b is not None:
        need(a is not None and number(b) >= a)
    if value['status'] == 'not-started':
        need(a is None and b is None)
    elif value['status'] == 'pending':
        need(a is not None and b is None)
    else:
        need(a is not None and b is not None)


def listener(value):
    fields(value, ('registration','removal','ownedIdentityMatch'))
    receipt(value['registration'])
    receipt(value['removal'])
    need(value['ownedIdentityMatch'] is None or type(value['ownedIdentityMatch']) is bool)
    if value['registration']['status'] == 'not-started':
        return value['removal']['status'] == 'not-started' and value['ownedIdentityMatch'] is None
    return (value['registration']['status'] == value['removal']['status'] == 'fulfilled'
            and value['ownedIdentityMatch'] is True)


def refs_walk(value, facts):
    """Check known artifact-role refs; source/package manifests are not imports."""
    stack = [value]
    while stack:
        item = stack.pop()
        if type(item) is dict:
            if set(item) == {'path','bytes','sha256'} and type(item['path']) is str and item['path'] in ROLE_CAPS:
                reference(item, facts)
            stack.extend(item.values())
        elif type(item) is list:
            stack.extend(item)


def input_drain(value, claimed):
    receipt(value)
    if claimed:
        need(value['status'] == 'fulfilled' and value['requestedHostMs'] is not None and
             value['settledHostMs'] is not None, 'RELATION')
        return dict(status='closed-original-input-drain')
    return dict(status='unavailable',reason='uncreated-input')


def role_joins(documents, facts):
    """An existing digest is insufficient: each relation has a fixed role."""
    fixed = {'profileRef':PROFILE,'childResultRef':CHILD,'inputRef':INPUT,
             'transportRef':'tracker-a-case-2-transport.json','rawRef':RAW,
             'parentPartialRef':'native-parent-partial.json','nativeResultRef':'native-result.json'}
    def visit(value):
        if type(value) is dict:
            for key, child in value.items():
                if key in fixed and child is not None:
                    reference(child,facts,fixed[key])
                visit(child)
        elif type(value) is list:
            for child in value:
                visit(child)
    for value in documents.values():
        visit(value)
    reference(documents[INVENTORY]['profileRef'],facts,PROFILE)
    for name in (INPUT,'tracker-a-case-2-transport.json',ANCHOR,'tracker-a-first-failure.json'):
        if name in documents:
            need(type(documents[name]) is dict)
            reference(documents[name].get('profileRef'),facts,PROFILE)
    for name in (ANCHOR,'tracker-a-first-failure.json'):
        if name in documents:
            reference(documents[name].get('childResultRef'),facts,CHILD)
    if ANCHOR in documents:
        reference(documents[ANCHOR]['inputRef'],facts,INPUT)
    if CHILD not in documents:
        need(documents[INVENTORY]['childResultRef'] is None, 'REF')
        return dict(status='unavailable',reason='absent-original-child')
    reference(documents[INVENTORY]['childResultRef'],facts,CHILD)
    child = documents[CHILD]
    need(type(child) is dict and child['mode'] == 'tracker-json-a-pilot-v2' and child['status'] in ('complete','incomplete') and
         child['qualification'] is False and child['fps'] == 'unavailable', 'VERSION')
    tracker = child['tracker']
    fields(tracker, ('inputRef','transportRef','inputDrain','semantic','capture','cleanup'))
    for key,name in (('inputRef',INPUT),('transportRef','tracker-a-case-2-transport.json')):
        need((tracker[key] is not None) == (name in facts), 'REF')
        if tracker[key] is not None:
            reference(tracker[key],facts,name)
    return input_drain(tracker['inputDrain'],tracker['inputRef'] is not None)


def context_join(context, documents, facts):
    required = {'sourceSha','runId','attempt','inventoryRef'}
    need(type(context) is dict and required <= set(context) <= required | {'sourceRoot','externalRefs'}, 'CONTEXT')
    need(type(context['sourceSha']) is str and SOURCE.fullmatch(context['sourceSha']), 'CONTEXT')
    need(type(context['runId']) is str and re.fullmatch(r'[1-9][0-9]{0,19}', context['runId']), 'CONTEXT')
    need(type(context['attempt']) is int and context['attempt'] == 1, 'CONTEXT')
    reference(context['inventoryRef'], facts, INVENTORY)
    intent, profile = documents.get('native-intent.json'), documents.get(PROFILE)
    need(type(intent) is dict and type(profile) is dict, 'SCHEMA')
    source = context['sourceSha']
    need(intent['source']['commitSha'] == source and profile['sourceSha'] == source, 'CONTEXT')
    need(all(intent['context'][key] == source for key in
             ('candidateSha','checkoutSha','githubSha','workflowSha','tagSha')), 'CONTEXT')
    need(intent['context']['attempt'] == str(context['attempt']), 'CONTEXT')
    need(intent['context']['releaseId'] == profile['releaseId'], 'CONTEXT')
    need(profile['schemaVersion'] == 3 and profile['kind'] == 'tracker-a-profile' and
         profile['mode'] == 'tracker-a-anchor-handler-gate-v1' and profile['strictMode'] == 'tracker-json-a-pilot-v2', 'VERSION')
    diagnostic = profile['diagnostics']['sameOwnerAnchor']
    need(diagnostic['protocol'] == 'tracker-a-anchor-scalars-v1' and diagnostic['role'] == ANCHOR and
         diagnostic['cap'] == 65536 and diagnostic['maxObservations'] == 82, 'VERSION')
    gate = profile['wheelHandlerAfterGate']
    need(gate == dict(protocol='tracker-a-wheel-handler-after-gate-v1', maxGates=40,
        entry='unchanged',arm='measured-before-existing-evaluate',wait='measured-after-existing-evaluate',event='same-original-wheel-listener'), 'VERSION')
    need(profile['qualification'] is False)
    return dict(sourceSha=source, runId=context['runId'], attempt=1,
                runIdentity='caller-supplied-unjoined', externalProvenance='caller-supplied')


@exact_semantics
def scalar(value):
    fields(value, ('pageNowMs','url','sameOriginalScroller','connected','uniqueSelector','innerWidth',
        'innerHeight','devicePixelRatio','rect','scrollTop','scrollHeight','clientHeight'))
    need(type(value['url']) is str and len(value['url'].encode('utf-8')) <= 4096)
    for key in ('sameOriginalScroller','connected','uniqueSelector'):
        need(type(value[key]) is bool)
    for key in ('pageNowMs','innerWidth','innerHeight','devicePixelRatio','scrollTop','scrollHeight','clientHeight'):
        number(value[key])
    fields(value['rect'], ('x','y','width','height'))
    for v in value['rect'].values():
        number(v)
    need(value['rect']['width'] >= 0 and value['rect']['height'] >= 0)
    need(value['clientHeight'] > 0 and value['scrollHeight'] >= value['clientHeight'] and
         0 <= value['scrollTop'] <= value['scrollHeight'] - value['clientHeight'])


def scalar_rows(value):
    need(type(value) is list and len(value) <= 82)
    previous = 0
    by_ordinal = {}
    for row in value:
        fields(row, ('ordinal','role','slot','requestedHostMs','settledHostMs','status','value'))
        ordinal = integer(row['ordinal'], 1, 82)
        need(ordinal == previous + 1, 'RELATION')
        previous = ordinal
        role, slot = row['role'], row['slot']
        need(role in ('pre','before','after','post'))
        if role == 'pre':
            need(ordinal == 1 and slot is None, 'RELATION')
        elif role == 'post':
            need(slot is None and row is value[-1] and ordinal >= 2, 'RELATION')
        else:
            integer(slot, 0, 39)
            need(ordinal == (2 if role == 'before' else 3) + 2 * slot, 'RELATION')
        receipt({key:row[key] for key in ('status','requestedHostMs','settledHostMs')})
        if row['value'] is not None:
            need(row['status'] == 'fulfilled')
            scalar(row['value'])
        by_ordinal[ordinal] = row
    return by_ordinal


@exact_semantics
def inspect_input(value):
    need(type(value) is dict and value['schemaVersion'] == 2 and value['kind'] == 'tracker-a-case-input' and
         value['mode'] == 'tracker-json-a-pilot-v2' and value['caseNumber'] == 2, 'VERSION')
    authority(value['authority'])
    rows = scalar_rows(value['scalarObservations'])
    events = value['wheelEvents']
    need(type(events) is list and len(events) <= 41)
    event_fields = ('ordinal','receivedHostMs','pageNowMs','eventTimeStampMs','isTrusted','deltaX','deltaY','deltaMode','targetContained','currentTargetIsScroller')
    for i, event in enumerate(events):
        fields(event, event_fields)
        need(type(event['ordinal']) is int and event['ordinal'] == i + 1, 'RELATION')
        for key in ('isTrusted','targetContained','currentTargetIsScroller'):
            need(type(event[key]) is bool)
        for key in ('receivedHostMs','pageNowMs','eventTimeStampMs','deltaX','deltaY','deltaMode'):
            number(event[key])
    requests = value['wheelRequests']
    need(type(requests) is list and len(requests) <= 40)
    for i, row in enumerate(requests):
        fields(row, ('slot','nominalHostMs','requestedHostMs','settledHostMs','status','beforeOrdinal','afterOrdinal'))
        need(type(row['slot']) is int and row['slot'] == i and row['beforeOrdinal'] == 2 + i * 2 and
             row['afterOrdinal'] in (None, 3 + i * 2), 'RELATION')
        number(row['nominalHostMs'])
        receipt({k:row[k] for k in ('status','requestedHostMs','settledHostMs')})
        need(row['beforeOrdinal'] in rows, 'RELATION')
        if row['afterOrdinal'] is not None:
            need(row['afterOrdinal'] in rows, 'RELATION')
    gates = value['handlerGates']
    need(type(gates) is list and len(gates) <= 40)
    gate_fields = ('slot','beforeOrdinal','afterOrdinal','expectedEventOrdinal','state','waitClaimed',
        'listenerOwnedIdentity','eventOrdinal','eventPageNowMs','eventTimeStampMs','cancellationReason','refusalCode')
    for i, gate in enumerate(gates):
        fields(gate, gate_fields)
        need(type(gate['slot']) is int and gate['slot'] == i and gate['beforeOrdinal'] == 2+i*2 and
             gate['afterOrdinal'] == 3+i*2 and gate['expectedEventOrdinal'] == i+2, 'RELATION')
        need(type(gate['waitClaimed']) is bool and gate['state'] in ('armed','observed','cancelled','refused'))
        event_tuple = [gate[k] for k in ('listenerOwnedIdentity','eventOrdinal','eventPageNowMs','eventTimeStampMs')]
        absent = all(v is None for v in event_tuple)
        need(absent or all(v is not None for v in event_tuple), 'RELATION')
        if not absent:
            ordinal = integer(gate['eventOrdinal'], 1, len(events))
            event = events[ordinal-1]
            need(gate['eventPageNowMs'] == event['pageNowMs'] and gate['eventTimeStampMs'] == event['eventTimeStampMs'] and
                 gate['listenerOwnedIdentity'] is event['currentTargetIsScroller'], 'RELATION')
        if gate['state'] == 'observed':
            need(not absent and gate['eventOrdinal'] == i+2 and
                 gate['cancellationReason'] is None and gate['refusalCode'] is None and
                 event['isTrusted'] is True and event['deltaX'] == 0 and event['deltaY'] == -12 and event['deltaMode'] == 0 and
                 event['targetContained'] is True and event['currentTargetIsScroller'] is True and
                 0 <= event['eventTimeStampMs'] <= event['pageNowMs'], 'RELATION')
            need(i < len(requests) and requests[i]['slot'] == i and requests[i]['beforeOrdinal'] == gate['beforeOrdinal'], 'RELATION')
            before, after = rows.get(2+i*2), rows.get(3+i*2)
            if before and after and before['value'] is not None and after['value'] is not None:
                need(before['value']['pageNowMs'] <= event['pageNowMs'] <= after['value']['pageNowMs'], 'RELATION')
        elif gate['state'] == 'cancelled':
            need(absent and gate['cancellationReason'] == 'listener-remove' and gate['refusalCode'] is None, 'RELATION')
        elif gate['state'] == 'armed':
            need(absent and gate['cancellationReason'] is None and gate['refusalCode'] is None, 'RELATION')
        else:
            need(gate['refusalCode'] in ('arm-state','unexpected-order','duplicate-event','event-invalid','event-copy-invalid','source-error') and gate['cancellationReason'] is None)
    fields(value['listeners'], ('wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose'))
    for item in value['listeners'].values():
        listener(item)
    phase = value['phase']
    if phase['hostT0Ms'] is not None and phase['hostT1Ms'] is not None:
        need(number(phase['hostT1Ms']) == number(phase['hostT0Ms']) + 2000, 'RELATION')
    post = phase['postBoundaryScalarOrdinal']
    if post is not None:
        need(type(post) is int and post in rows and rows[post]['role'] == 'post' and
             phase['postBoundarySettled'] == rows[post]['status'], 'RELATION')
    return rows


def input_brackets(value, rows):
    checked = unavailable = 0
    for gate in value['handlerGates']:
        if gate['state'] != 'observed':
            continue
        before,after = rows.get(gate['beforeOrdinal']),rows.get(gate['afterOrdinal'])
        if before and after and before['value'] is not None and after['value'] is not None:
            checked += 1
        else:
            unavailable += 1
    return dict(checked=checked,unavailable=unavailable,interpretation='original-returned-scalar-brackets-only')


@exact_semantics
def inspect_anchor(value, input_value, rows, snapshots):
    fields(value, ('schemaVersion','kind','profileRef','childResultRef','inputRef','selection','observations','qualification','nativeGO','performance'))
    need(type(value['schemaVersion']) is int and value['schemaVersion'] == 1 and value['kind'] == 'tracker-a-anchor-scalars-v1', 'VERSION')
    authority(value)
    selection = value['selection']
    fields(selection, ('snapshotRef','id','role','ownerToken','metric','contentTopCssPx','relativeTopCssPx','nativeViewportY'))
    need(selection['snapshotRef'] == dict(path='native-case-2.json',index=1) and
         selection['metric'] == 'min-positive-text-rect-viewport-y' and selection['role'] in ('user','assistant'))
    integer(selection['ownerToken'])
    need(type(selection['id']) is str and len(selection['id'].encode('utf-8')) <= 128)
    need(input_value['anchor'] is not None and input_value['anchor']['id'] == selection['id'] and
         input_value['anchor']['ownerToken'] == selection['ownerToken'], 'RELATION')
    checkpoint = input_value['geometryCheckpoints']['G1']
    need(checkpoint['status'] == 'fulfilled' and checkpoint['snapshotRef'] == selection['snapshotRef'], 'RELATION')
    need(type(snapshots) is list and len(snapshots) >= 2 and snapshots[1]['snapshot']['status'] == 'available', 'RELATION')
    frame = snapshots[1]['snapshot']['frame']
    need(selection['nativeViewportY'] == frame['nativeViewport']['y'], 'RELATION')
    # Original evaluated G1 rows are joined; no DOM or geometry evaluator runs.
    evaluation = snapshots[1]['snapshot']['evaluation']
    eligible = [row for row in evaluation['rows'] if row['id'] != frame['expectedResponse']['id'] and row['geometryEligibility'] == 'eligible']
    need(eligible, 'RELATION')
    first = eligible[0]
    need(all(selection[key] == first[key] for key in ('id','role','ownerToken','contentTopCssPx','relativeTopCssPx')), 'RELATION')
    observations = value['observations']
    need(type(observations) is list and len(observations) == len(rows), 'RELATION')
    result = {}
    row_fields = ('ordinal','role','slot','status','reason','pageStartMs','pageEndMs','identity','ownerToken',
        'contentTopCssPx','relativeTopCssPx','nativeViewportY','textRectCount','eligible','scrollTopAfterProbe',
        'jointReadStable','nodesVisited','rectangleUnits','textChars')
    for row in observations:
        fields(row, row_fields)
        ordinal = integer(row['ordinal'],1,82)
        need(ordinal in rows and ordinal not in result, 'RELATION')
        original = rows[ordinal]
        need(row['role'] == original['role'] and row['slot'] == original['slot'], 'RELATION')
        fields(row['identity'], ANCHOR_IDENTITY)
        need(all(v is None or type(v) is bool for v in row['identity'].values()))
        for key, cap in (('textRectCount',256),('nodesVisited',4096),('rectangleUnits',290),('textChars',8192)):
            integer(row[key],0,cap)
        need(row['eligible'] is None or type(row['eligible']) is bool)
        start, end = row['pageStartMs'], row['pageEndMs']
        need((start is None) == (end is None))
        if start is not None:
            need(0 <= number(start) <= number(end) <= 360000 and
                 (original['value'] is None or start >= original['value']['pageNowMs']), 'RELATION')
        if row['status'] == 'available':
            need(row['reason'] is None and original['status'] == 'fulfilled' and original['value'] is not None and
                 start is not None and row['ownerToken'] == selection['ownerToken'] and row['eligible'] is True and
                 all(v is True for v in row['identity'].values()), 'RELATION')
            for key in ('contentTopCssPx','relativeTopCssPx','nativeViewportY','scrollTopAfterProbe'):
                need(abs(number(row[key])) <= 1000000)
            need(row['relativeTopCssPx'] == row['contentTopCssPx'] - row['nativeViewportY'] and
                 row['scrollTopAfterProbe'] >= 0 and row['textRectCount'] > 0, 'RELATION')
        else:
            need(row['status'] == 'unavailable' and row['reason'] in ANCHOR_REASONS and
                 row['eligible'] in (None,False) and all(row[k] is None for k in
                 ('ownerToken','contentTopCssPx','relativeTopCssPx','nativeViewportY','scrollTopAfterProbe')))
        expected = (original['value']['scrollTop'] == row['scrollTopAfterProbe'] if
                    original['value'] is not None and row['scrollTopAfterProbe'] is not None else None)
        need(row['jointReadStable'] is expected, 'RELATION')
        result[ordinal] = row
    return result


def first_failure(value, rows):
    fields(value, ('schemaVersion','kind','profileRef','childResultRef','firstFailure','qualification','nativeGO','performance'))
    need(type(value['schemaVersion']) is int and value['schemaVersion'] == 1 and value['kind'] == 'tracker-a-first-failure', 'VERSION')
    authority(value)
    failure = value['firstFailure']
    fields(failure, ('code','ordinal','previousOrdinal','slot'))
    need(failure['code'] in ('unclassified','baseline','timestamp-reverse','opposing-offset','end-stop'))
    ordinal, previous, slot = failure['ordinal'], failure['previousOrdinal'], failure['slot']
    if failure['code'] == 'unclassified':
        need(ordinal is None and previous is None and slot is None,'RELATION')
    if slot is not None:
        integer(slot,0,39)
    if ordinal is None:
        need(failure['code'] in ('unclassified','baseline') and previous is None and slot is None)
    else:
        integer(ordinal,1,82)
        need(ordinal in rows and rows[ordinal]['slot'] == slot, 'RELATION')
        if previous is not None:
            integer(previous,1,82)
            need(previous < ordinal and previous in rows, 'RELATION')
        else:
            need(failure['code'] == 'baseline')
        if failure['code'] in ('timestamp-reverse','opposing-offset','end-stop'):
            need(previous == ordinal-1 and rows[ordinal]['value'] is not None and rows[previous]['value'] is not None,'RELATION')
            current,prior = rows[ordinal]['value'],rows[previous]['value']
            if failure['code'] == 'timestamp-reverse':
                need(current['pageNowMs'] < prior['pageNowMs'],'RELATION')
            elif failure['code'] == 'opposing-offset':
                need(current['pageNowMs'] >= prior['pageNowMs'] and current['scrollTop'] > prior['scrollTop'],'RELATION')
            else:
                need(rows[ordinal]['role'] != 'pre' and current['scrollTop'] == 0 and current['pageNowMs'] >= prior['pageNowMs'],'RELATION')
    return dict(failure)


@exact_semantics
def transport(value, facts):
    need(type(value['schemaVersion']) is int and value['schemaVersion'] == 1 and value['kind'] == 'tracker-a-transport' and value['mode'] == 'tracker-json-a-pilot-v2', 'VERSION')
    authority(value['authority'])
    operations = value['operations']
    need(type(operations) is list and len(operations) <= 1031)
    kinds = {}
    reads = {}
    writes = set()
    read_bytes = written = 0
    closed = True
    for index, operation in enumerate(operations):
        fields(operation, ('ordinal','kind','requestedHostMs','settledHostMs','status','timedOut','handleOrdinal','bytes','eof','readOperationOrdinal'))
        need(type(operation['ordinal']) is int and operation['ordinal'] == index+1, 'RELATION')
        kind = operation['kind']
        need(kind in ('start','end','read','write','io-close','sink-finish','detach'))
        receipt({k:operation[k] for k in ('status','requestedHostMs','settledHostMs')})
        need(type(operation['timedOut']) is bool)
        need(operation['handleOrdinal'] is None or type(operation['handleOrdinal']) is int and operation['handleOrdinal'] in (1,2))
        need(operation['eof'] is None or type(operation['eof']) is bool)
        if operation['bytes'] is not None:
            integer(operation['bytes'],0,65536)
        kinds.setdefault(kind, []).append(operation)
        closed = closed and operation['status'] == 'fulfilled' and operation['timedOut'] is False
        if kind == 'read':
            need(operation['handleOrdinal'] is not None and operation['readOperationOrdinal'] is None, 'RELATION')
            if operation['status'] == 'fulfilled':
                need(operation['bytes'] is not None and type(operation['eof']) is bool, 'RELATION')
            reads[index+1] = operation
            read_bytes += operation['bytes'] or 0
        elif kind == 'write':
            link = operation['readOperationOrdinal']
            need(type(link) is int and link in reads and link not in writes and
                 operation['bytes'] == reads[link]['bytes'] and operation['bytes'] > 0 and operation['eof'] is None, 'RELATION')
            writes.add(link)
            written += operation['bytes']
    need(type(value['portCalls']) is int and value['portCalls'] == len(operations) and
         type(value['readCalls']) is int and value['readCalls'] == len(reads) <= 513 and
         type(value['knownReadBytes']) is int and value['knownReadBytes'] == read_bytes, 'RELATION')
    barriers = [row['ordinal'] for row in operations if row['kind'] in ('io-close','sink-finish','detach')]
    if barriers:
        need(all(row['ordinal'] < min(barriers) for row in kinds.get('write',[])), 'RELATION')
    for write in kinds.get('write',[]):
        # The collector writes a read's nonempty payload before requesting the
        # next read. An EOF read can itself carry that final payload.
        need(not any(write['readOperationOrdinal'] < read['ordinal'] < write['ordinal'] for read in reads.values()), 'RELATION')
    fields(value['listeners'], ('tracingComplete','sessionClose'))
    for item in value['listeners'].values():
        closed = listener(item) and closed
    raw = value['raw']
    fields(raw, ('status','ref','extent'))
    need(raw['status'] in ('absent','known-prefix','complete-raw'))
    if raw['ref'] is not None:
        reference(raw['ref'], facts, RAW)
        if raw['status'] == 'complete-raw':
            need(written == facts[RAW]['bytes'] and read_bytes == written, 'RELATION')
    else:
        need(raw['status'] == 'absent' and raw['extent'] == 'unobserved' and RAW not in facts, 'RELATION')
    completion = value['completion']
    fields(completion, ('firstHostMs','overflowHostMs','format','compression','dataLoss'))
    for key in ('firstHostMs','overflowHostMs'):
        if completion[key] is not None:
            need(number(completion[key]) >= 0)
    need(completion['format'] in (None,'json','other') and completion['compression'] in (None,'none','other') and
         (completion['dataLoss'] is None or type(completion['dataLoss']) is bool))
    closed = closed and completion['firstHostMs'] is not None and completion['overflowHostMs'] is None and completion['format'] == 'json' and completion['compression'] == 'none' and completion['dataLoss'] is False
    eof = [row for row in reads.values() if row['eof'] is True]
    if closed:
        need(len(eof) == 1 and eof[0] is list(reads.values())[-1], 'RELATION')
        need(writes == {ordinal for ordinal,row in reads.items() if row['bytes'] is not None and row['bytes'] > 0}, 'RELATION')
        for kind in ('start','end','io-close','sink-finish','detach'):
            need(len(kinds.get(kind,[])) == 1, 'RELATION')
        need(kinds['start'][0]['ordinal'] < kinds['end'][0]['ordinal'] < eof[0]['ordinal'] < kinds['io-close'][0]['ordinal'] < kinds['sink-finish'][0]['ordinal'] < kinds['detach'][0]['ordinal'], 'RELATION')
    sink = value['sink']
    fields(sink, ('created','finish','fsync','fileClose'))
    need(type(sink['created']) is bool and all(sink[k] in STATES for k in ('finish','fsync','fileClose')))
    closed = closed and sink['created'] is True and all(sink[k] == 'fulfilled' for k in ('finish','fsync','fileClose'))
    session = value['sessionClose']
    fields(session, ('firstHostMs','overflowHostMs','originalSessionMatch','timing'))
    for key in ('firstHostMs','overflowHostMs'):
        if session[key] is not None:
            need(number(session[key]) >= 0)
    need((session['originalSessionMatch'] is None or type(session['originalSessionMatch']) is bool) and
         session['timing'] in ('unobserved','expected-detach','unexpected-loss'))
    closed = closed and session['firstHostMs'] is not None and session['overflowHostMs'] is None and session['originalSessionMatch'] is True and session['timing'] == 'expected-detach'
    handles = value['handles']
    need(type(handles) is list and len(handles) <= 2)
    for index, handle in enumerate(handles):
        fields(handle, ('ordinal','firstHostMs','role','closeOperationOrdinal'))
        need(type(handle['ordinal']) is int and handle['ordinal'] == index+1 and handle['role'] in ('accepted','unexpected'))
        need(number(handle['firstHostMs']) >= 0)
        ordinal = handle['closeOperationOrdinal']
        if ordinal is not None:
            integer(ordinal,1,len(operations))
            op = operations[ordinal-1]
            need(op['kind'] == 'io-close' and op['handleOrdinal'] == handle['ordinal'], 'RELATION')
            closed = closed and op['status'] == 'fulfilled'
        else:
            closed = False
    handle_ids = {handle['ordinal'] for handle in handles}
    for operation in operations:
        if operation['kind'] in ('read','io-close'):
            need(operation['handleOrdinal'] in handle_ids, 'RELATION')
    if closed:
        first = operations[0]['requestedHostMs']
        last = max([row['settledHostMs'] for row in operations] +
                   [item['removal']['settledHostMs'] for item in value['listeners'].values()])
        need(first <= completion['firstHostMs'] <= last and first <= session['firstHostMs'] <= last and
             all(first <= handle['firstHostMs'] <= last for handle in handles), 'RELATION')
    closed = closed and len(handles) == 1 and handles[0]['role'] == 'accepted' and value['handleOverflow'] is None and raw['status'] == 'complete-raw' and raw['extent'] == 'complete'
    outcome = value['outcome']
    fields(outcome, ('capture','containment'))
    fields(outcome['capture'], ('status','reason'))
    need(outcome['capture']['status'] in ('not-started','incomplete','complete') and outcome['containment'] in ('verified','unverified'))
    need(outcome['capture']['reason'] == ('transport' if outcome['capture']['status'] == 'incomplete' else None))
    closed = closed and outcome['capture']['status'] == 'complete' and outcome['containment'] == 'verified'
    if raw['status'] == 'complete-raw':
        need(raw['extent'] == 'complete' and raw['ref'] is not None)
    return dict(status='completeCapturedRaw' if closed else 'unavailable',
                relation='captured-acquisition-only', readCalls=len(reads), readBytes=read_bytes,
                writtenBytes=written, scenarioCompletion='unqualified')


def disjoint(output, protected):
    need(os.path.isabs(output) and os.path.normpath(output) == output and os.path.realpath(output) == output, 'OUTPUT')
    need(not os.path.lexists(output), 'OUTPUT')
    for path in protected:
        need(os.path.commonpath((output,path)) not in (output,path), 'OUTPUT')


@contextmanager
def output_parent(path):
    """Pin every existing ancestor without following any path component link."""
    need(os.name == 'posix' and hasattr(os,'O_DIRECTORY') and hasattr(os,'O_NOFOLLOW') and
         os.open in os.supports_dir_fd and os.mkdir in os.supports_dir_fd and
         os.stat in os.supports_dir_fd and os.stat in os.supports_follow_symlinks,'OUTPUT')
    parent_path, basename = os.path.split(path)
    need(basename not in ('','.','..') and '/' not in basename,'OUTPUT')
    descriptors = []
    edges = []
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    try:
        current = os.open('/',flags)
        descriptors.append(current)
        for name in parent_path.split('/'):
            if not name:
                continue
            before = os.stat(name,dir_fd=current,follow_symlinks=False)
            need(stat.S_ISDIR(before.st_mode),'OUTPUT')
            child = os.open(name,flags,dir_fd=current)
            descriptors.append(child)
            pin = identity(before)[:3]
            need(identity(os.fstat(child))[:3] == pin,'LIFETIME')
            edges.append((current,name,child,pin))
            current = child
        def validate():
            for parent,name,child,pin in edges:
                need(identity(os.stat(name,dir_fd=parent,follow_symlinks=False))[:3] == pin and
                     identity(os.fstat(child))[:3] == pin,'LIFETIME')
            canonical(parent_path,True)
            need(identity(os.lstat(parent_path))[:3] == identity(os.fstat(current))[:3],'LIFETIME')
        validate()
        yield current,basename,validate
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def inspect_failure(artifact_dir, context_path, output_dir):
    """Authenticate originals, derive finite facts, reauthenticate, publish last."""
    canonical(artifact_dir, True)
    canonical(context_path)
    root_identity = identity(os.lstat(artifact_dir))
    context_raw, context_fact, context_identity = file_read(context_path, 65536)
    context, _ = decode_json(context_raw)
    need(type(context) is dict, 'CONTEXT')
    protected = [artifact_dir, os.path.dirname(context_path)]
    if 'sourceRoot' in context:
        protected.append(canonical(context['sourceRoot'], True))
    external = []
    descriptors = context.get('externalRefs', [])
    need(type(descriptors) is list and len(descriptors) <= 3, 'CONTEXT')
    external_kinds = set()
    external_bytes = 0
    for descriptor in descriptors:
        fields(descriptor, ('kind','path','bytes','sha256'))
        kind = descriptor['kind']
        need(type(kind) is str and kind in EXTERNAL_CAPS and kind not in external_kinds, 'CONTEXT')
        external_kinds.add(kind)
        integer(descriptor['bytes'],0,EXTERNAL_CAPS[kind])
        external_bytes += descriptor['bytes']
        need(external_bytes <= MAX_EXTERNAL_BYTES, 'BYTES')
        need(type(descriptor['sha256']) is str and SHA.fullmatch(descriptor['sha256']), 'REF')
    for descriptor in descriptors:
        canonical(descriptor['path'])
        protected.append(os.path.dirname(descriptor['path']))
        raw, fact, signature = file_read(descriptor['path'], EXTERNAL_CAPS[descriptor['kind']])
        need(type(descriptor['bytes']) is int and descriptor['bytes'] == fact['bytes'] and descriptor['sha256'] == fact['sha256'], 'REF')
        external.append((descriptor,raw,fact,signature))
    disjoint(output_dir, protected)
    names = namespace(artifact_dir)
    need(INVENTORY in names, 'NAMESPACE')
    facts, signatures, documents, raw_trace = {}, {}, {}, None
    syntax_work = syntax_nodes = 0
    for name in sorted(names):
        raw, fact, signature = file_read(os.path.join(artifact_dir,name), ROLE_CAPS[name])
        facts[name], signatures[name] = fact, signature
        if name.endswith('.json'):
            value, syntax = decode_json(raw)
            syntax_work += syntax['work']
            syntax_nodes += syntax['nodes']
            need(syntax_work <= 16777216 and syntax_nodes <= 1048576, 'RESOURCE')
            if name == RAW:
                need(type(value) is dict and type(value.get('traceEvents')) is list and
                     all(type(row) is dict for row in value['traceEvents']))
                raw_trace = dict(status='whole-json-census',**fact,eventObjects=len(value['traceEvents']),syntax=syntax,
                                 reconstruction='unavailable',fps='unavailable')
            else:
                documents[name] = value
    inventory = documents[INVENTORY]
    fields(inventory, ('schemaVersion','kind','status','profileRef','childResultRef','files','absent','bytesBeforeInventory','qualification','nativeGO','performance'))
    need(type(inventory['schemaVersion']) is int and inventory['schemaVersion'] == 1 and inventory['kind'] == 'tracker-a-failure-inventory' and inventory['status'] == 'unqualified-runtime-failure', 'VERSION')
    authority(inventory)
    need(type(inventory['files']) is list and len(inventory['files']) <= 127)
    claimed = set()
    for record in inventory['files']:
        fields(record, ('path','bytes','sha256','regular','contained','symlink'))
        need(record['regular'] is True and record['contained'] is True and record['symlink'] is False)
        reference({key:record[key] for key in ('path','bytes','sha256')},facts)
        need(record['path'] not in claimed and record['path'] != INVENTORY, 'NAMESPACE')
        claimed.add(record['path'])
    need(names == claimed | {INVENTORY}, 'NAMESPACE')
    need(type(inventory['bytesBeforeInventory']) is int and inventory['bytesBeforeInventory'] == sum(facts[name]['bytes'] for name in claimed), 'BYTES')
    need(inventory['absent'] == [name for name in TRACE_ROLES if name not in ('native-inventory.json',INVENTORY) and name not in claimed], 'NAMESPACE')
    identity_report = context_join(context,documents,facts)
    for descriptor, raw, _, _ in external:
        if descriptor['kind'] == 'provider-run':
            provider,_ = decode_json(raw)
            need(type(provider) is dict and type(provider.get('id')) is int and str(provider['id']) == context['runId'] and
                 type(provider.get('run_attempt')) is int and provider['run_attempt'] == context['attempt'] and
                 provider.get('head_sha') == context['sourceSha'], 'CONTEXT')
            identity_report['runIdentity'] = 'caller-supplied-provider-context-matched'
    for document in documents.values():
        refs_walk(document,facts)
    drain = role_joins(documents,facts)
    checked = ['whole-file-bytes','inventory-namespace-and-absence','strict-json-all-json-roles','source-attempt-release-profile-joins','known-role-physical-refs']
    unavailable = ['full-production-admission','provider-provenance','planned-scenario-completion','trace-clock-frame-reconstruction','fps']
    if drain['status'] == 'closed-original-input-drain':
        checked.append('original-child-input-drain')
    else:
        unavailable.append('original-child-input-drain')
    rows = inspect_input(documents[INPUT]) if INPUT in documents else {}
    brackets = input_brackets(documents[INPUT],rows) if INPUT in documents else dict(checked=0,unavailable=0)
    anchors = {}
    if INPUT in documents:
        checked += ['scalar-ordinal-receipts','wheel-event-handler-gate-links']
        if brackets['checked']:
            checked.append('returned-scalar-event-brackets')
        if brackets['unavailable']:
            unavailable.append('unreturned-scalar-event-brackets')
    if ANCHOR in documents:
        need(INPUT in documents and 'native-case-2.json' in documents, 'RELATION')
        anchors = inspect_anchor(documents[ANCHOR],documents[INPUT],rows,documents['native-case-2.json']['snapshots'])
        checked += ['anchor-selection-original-G1','anchor-ordinal-owner-postprobe-joins']
    else:
        unavailable.append('selected-anchor-probes')
    failure = first_failure(documents['tracker-a-first-failure.json'],rows) if 'tracker-a-first-failure.json' in documents else None
    if failure is not None:
        checked.append('first-failure-scalar-context')
        if failure['code'] in ('timestamp-reverse','opposing-offset','end-stop'):
            checked.append('first-failure-consumed-code-predicate')
        else:
            unavailable.append('baseline-or-unclassified-runtime-guard-replay')
    else:
        unavailable.append('first-failure-capsule')
    acquisition = transport(documents['tracker-a-case-2-transport.json'],facts) if 'tracker-a-case-2-transport.json' in documents else dict(status='unavailable',reason='absent-transport')
    if acquisition['status'] == 'completeCapturedRaw':
        checked.append('captured-transport-read-write-eof-close-joins')
    else:
        unavailable.append('captured-transport-closure')
    pairs = []
    ordered = list(rows.values())
    for a,b in zip(ordered,ordered[1:]):
        if a['value'] is not None and b['value'] is not None:
            pairs.append(sample_pair(a,b,anchors))
    report = dict(schemaVersion=1,kind='retained-hosted-failure-observations',status='observations-only',
        identity=identity_report,authority=dict(AUTHORITY),originalScenario='failed-or-incomplete',
        inputReferences=dict(inventory=dict(path=INVENTORY,**facts[INVENTORY]),context=dict(context_fact)),
        integrity=dict(status='authenticated-supplied-inventory',files=len(names),bytes=sum(f['bytes'] for f in facts.values())),
        checkedRelations=checked,unavailableRelations=unavailable,unsupportedRelations=['production-semantic-admission-replay'],
        firstFailure=failure,samplePairs=pairs,trace=raw_trace or dict(status='unavailable',reason='absent-raw'),
        capturedAcquisition=acquisition,inputDrain=drain,handlerBrackets=brackets,externalRefs=[dict(kind=d['kind'],bytes=f['bytes'],sha256=f['sha256']) for d,_,f,_ in external],
        resourceLimits=dict(postparse=True,hardHeapBound=False,maxJsonDepth=64,maxJsonNodes=1048576,maxJsonWork=16777216,
                            maxExternalFiles=3,maxExternalBytes=MAX_EXTERNAL_BYTES,externalRoleCaps=EXTERNAL_CAPS))
    encoded = json.dumps(report,ensure_ascii=True,separators=(',',':')).encode('ascii') + b'\n'
    need(len(encoded) <= MAX_REPORT, 'OUTPUT')
    def revalidate():
        need(namespace(artifact_dir) == names and identity(os.lstat(artifact_dir)) == root_identity, 'LIFETIME')
        for name in sorted(names):
            _, fact, signature = file_read(os.path.join(artifact_dir,name),ROLE_CAPS[name])
            need(fact == facts[name] and signature == signatures[name], 'LIFETIME')
        _, _, signature = file_read(context_path,65536)
        need(signature == context_identity, 'LIFETIME')
        for descriptor,_,fact,signature in external:
            _, final_fact, final_signature = file_read(descriptor['path'],EXTERNAL_CAPS[descriptor['kind']])
            need(final_fact == fact and final_signature == signature, 'LIFETIME')
        need(namespace(artifact_dir) == names and identity(os.lstat(artifact_dir)) == root_identity, 'LIFETIME')
        for name in names:
            need(identity(os.lstat(os.path.join(artifact_dir,name))) == signatures[name], 'LIFETIME')
    revalidate()
    disjoint(output_dir,protected)
    report_path = os.path.join(output_dir,'report.json')
    with output_parent(output_dir) as (parent_fd,basename,validate_parent):
        disjoint(output_dir,protected)
        os.mkdir(basename,0o700,dir_fd=parent_fd)
        validate_parent()
        directory_fd = os.open(basename,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent_fd)
        try:
            output_identity = identity(os.fstat(directory_fd))[:3]
            canonical(output_dir,True)
            need(identity(os.lstat(output_dir))[:3] == output_identity,'LIFETIME')
            validate_parent()
            descriptor = os.open('report.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=directory_fd)
            with os.fdopen(descriptor,'wb') as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
                report_identity = identity(os.fstat(stream.fileno()))
            revalidate()
            validate_parent()
            canonical(output_dir,True)
            need(identity(os.lstat(output_dir))[:3] == output_identity, 'LIFETIME')
            with os.scandir(directory_fd) as entries:
                entry = next(entries,None)
                need(entry is not None and entry.name == 'report.json' and next(entries,None) is None,'LIFETIME')
            published,_,signature = file_read(report_path,MAX_REPORT)
            need(published == encoded and signature == report_identity, 'LIFETIME')
        finally:
            os.close(directory_fd)
    return dict(status='report-published',bytes=len(encoded),sha256=hashlib.sha256(encoded).hexdigest(),authority=dict(AUTHORITY))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact-dir',required=True)
    parser.add_argument('--context',required=True)
    parser.add_argument('--out',required=True)
    args = parser.parse_args(argv)
    try:
        need(sys.version_info >= (3,12), 'VERSION')
        result = inspect_failure(args.artifact_dir,args.context,args.out)
        code = 0
    except Refusal as error:
        result, code = dict(status='refused',code=error.code,authority=dict(AUTHORITY)),2
    except (MemoryError,RecursionError):
        result, code = dict(status='refused',code='RESOURCE',authority=dict(AUTHORITY)),2
    except (OSError,ValueError,TypeError,KeyError,IndexError,ArithmeticError):
        result, code = dict(status='refused',code='FORMAT',authority=dict(AUTHORITY)),2
    terminal = json.dumps(result,separators=(',',':'))
    need(len(terminal.encode('ascii')) <= 4096,'OUTPUT')
    print(terminal)
    return code


if __name__ == '__main__':
    raise SystemExit(main())
