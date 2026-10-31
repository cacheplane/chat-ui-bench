-- Fixed whole-selected inventory; no target/window restriction, LIMIT or paging.
INCLUDE PERFETTO MODULE slices.with_context;
CREATE PERFETTO VIEW _pc_names AS
WITH names(name) AS (VALUES ('FrameSequenceTrackerV3'),('FrameSequenceTracker'),('PipelineReporter'),('Graphics.Pipeline'),('Graphics.Pipeline.DrawAndSwap'),('Display::FrameDisplayed'),('BeginFrame'),('SetLayerTreeId'),('TracingStartedInBrowser'),('FrameCommittedInBrowser'),('FrameDeletedInBrowser'),('ProcessReadyInBrowser'),('MainFrame.Draw'),('Scheduler::BeginFrame'),('Scheduler::BeginImplFrame'),('DrawFrame'),__PHASE_VALUES__) SELECT DISTINCT name COLLATE BINARY AS name FROM names;
-- Phases absent from the trace still require a zero census row.
CREATE PERFETTO VIEW _pc_seed AS SELECT s.* FROM slice s LEFT JOIN track t ON t.id=s.track_id WHERE s.name COLLATE BINARY IN (SELECT name FROM _pc_names) OR t.name COLLATE BINARY IN ('FrameSequenceTrackerV3','FrameSequenceTracker');
CREATE PERFETTO TABLE _pc_selected AS
WITH RECURSIVE descendants(id) AS (SELECT id FROM _pc_seed UNION SELECT s.id FROM slice s JOIN descendants d ON s.parent_id=d.id),
complete(id) AS (SELECT id FROM descendants UNION SELECT s.parent_id FROM slice s JOIN complete c ON s.id=c.id WHERE s.parent_id IS NOT NULL)
SELECT s.* FROM slice s WHERE s.id IN (SELECT id FROM complete);
CREATE PERFETTO TABLE _pc_context AS SELECT s.*,c.utid,c.tid,c.upid,c.pid,c.process_name,c.thread_name,t.name AS track_name, CASE WHEN s.id IN (SELECT id FROM _pc_seed) THEN 1 ELSE 0 END AS is_seed FROM _pc_selected s LEFT JOIN thread_or_process_slice c ON c.id=s.id LEFT JOIN track t ON t.id=s.track_id;
CREATE PERFETTO VIEW _pc_tracks AS WITH RECURSIVE ids(id) AS (SELECT track_id FROM _pc_selected UNION SELECT t.parent_id FROM track t JOIN ids ON ids.id=t.id WHERE t.parent_id IS NOT NULL) SELECT t.*,i.event_type,i.counter_unit,i.utid,i.upid FROM track t JOIN __intrinsic_track i ON i.id=t.id WHERE t.id IN (SELECT id FROM ids);
CREATE PERFETTO VIEW _pc_slice_sets AS SELECT arg_set_id,COUNT(*) AS slice_count FROM _pc_selected WHERE arg_set_id IS NOT NULL GROUP BY arg_set_id;
CREATE PERFETTO VIEW _pc_slice_args AS SELECT a.* FROM args a JOIN _pc_slice_sets r ON r.arg_set_id=a.arg_set_id;
CREATE PERFETTO VIEW _pc_track_refs AS SELECT id AS track_id,'source' AS namespace,source_arg_set_id AS arg_set_id FROM _pc_tracks UNION ALL SELECT id,'dimension',dimension_arg_set_id FROM _pc_tracks;
CREATE PERFETTO VIEW _pc_track_sets AS SELECT arg_set_id,COUNT(*) AS reference_count FROM _pc_track_refs WHERE arg_set_id IS NOT NULL GROUP BY arg_set_id;
CREATE PERFETTO VIEW _pc_track_args AS SELECT a.* FROM args a JOIN _pc_track_sets r ON r.arg_set_id=a.arg_set_id;
CREATE PERFETTO VIEW _pc_threads AS SELECT * FROM thread WHERE utid IN (SELECT utid FROM _pc_context UNION SELECT utid FROM _pc_tracks);
CREATE PERFETTO VIEW _pc_processes AS SELECT * FROM process WHERE upid IN (SELECT upid FROM _pc_context UNION SELECT upid FROM _pc_tracks UNION SELECT upid FROM _pc_threads);
CREATE PERFETTO VIEW _pc_stats AS SELECT * FROM stats WHERE value!=0;
CREATE PERFETTO TABLE _pc_text AS SELECT ROW_NUMBER() OVER (ORDER BY text_hex COLLATE BINARY) AS text_id,text_hex,MIN(valid_text) AS valid_text FROM (
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.name)='text' AS valid_text FROM _pc_names s WHERE s.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.name)='text' AS valid_text FROM _pc_context s WHERE s.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.category AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.category)='text' AS valid_text FROM _pc_context s WHERE s.category IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.track_name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.track_name)='text' AS valid_text FROM _pc_context s WHERE s.track_name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.process_name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.process_name)='text' AS valid_text FROM _pc_context s WHERE s.process_name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.thread_name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.thread_name)='text' AS valid_text FROM _pc_context s WHERE s.thread_name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.flat_key AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.flat_key)='text' AS valid_text FROM _pc_slice_args s WHERE s.flat_key IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.key AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.key)='text' AS valid_text FROM _pc_slice_args s WHERE s.key IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.value_type AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.value_type)='text' AS valid_text FROM _pc_slice_args s WHERE s.value_type IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.string_value AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.string_value)='text' AS valid_text FROM _pc_slice_args s WHERE s.string_value IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.name)='text' AS valid_text FROM _pc_tracks s WHERE s.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.type AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.type)='text' AS valid_text FROM _pc_tracks s WHERE s.type IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.event_type AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.event_type)='text' AS valid_text FROM _pc_tracks s WHERE s.event_type IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.counter_unit AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.counter_unit)='text' AS valid_text FROM _pc_tracks s WHERE s.counter_unit IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.namespace AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.namespace)='text' AS valid_text FROM _pc_track_refs s WHERE s.namespace IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.flat_key AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.flat_key)='text' AS valid_text FROM _pc_track_args s WHERE s.flat_key IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.key AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.key)='text' AS valid_text FROM _pc_track_args s WHERE s.key IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.value_type AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.value_type)='text' AS valid_text FROM _pc_track_args s WHERE s.value_type IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.string_value AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.string_value)='text' AS valid_text FROM _pc_track_args s WHERE s.string_value IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.name)='text' AS valid_text FROM _pc_processes s WHERE s.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.name)='text' AS valid_text FROM _pc_threads s WHERE s.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.name)='text' AS valid_text FROM _pc_stats s WHERE s.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.severity AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.severity)='text' AS valid_text FROM _pc_stats s WHERE s.severity IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.source AS BLOB)) COLLATE BINARY AS text_hex,TYPEOF(s.source)='text' AS valid_text FROM _pc_stats s WHERE s.source IS NOT NULL
) GROUP BY text_hex COLLATE BINARY;
SELECT text_id,text_hex,valid_text FROM _pc_text ORDER BY text_id;
SELECT COALESCE(d0.text_id,0) AS name_text_id,
 (SELECT COUNT(*) FROM slice z WHERE z.name COLLATE BINARY=s.name COLLATE BINARY) AS event_count,
 (SELECT COUNT(DISTINCT z.arg_set_id) FROM slice z WHERE z.name COLLATE BINARY=s.name COLLATE BINARY) AS arg_set_count
FROM _pc_names s
LEFT JOIN _pc_text d0 ON d0.text_hex=HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
ORDER BY s.name COLLATE BINARY;
SELECT s.id AS id,
 s.ts AS ts,
 s.dur AS dur,
 s.depth AS depth,
 s.parent_id AS parent_id,
 s.is_seed AS is_seed,
 COALESCE(d6.text_id,0) AS name_text_id,
 COALESCE(d7.text_id,0) AS category_text_id,
 s.track_id AS track_id,
 s.arg_set_id AS arg_set_id,
 s.utid AS utid,
 s.tid AS tid,
 s.upid AS upid,
 s.pid AS pid,
 COALESCE(d14.text_id,0) AS track_name_text_id,
 COALESCE(d15.text_id,0) AS process_name_text_id,
 COALESCE(d16.text_id,0) AS thread_name_text_id
FROM _pc_context s
LEFT JOIN _pc_text d6 ON d6.text_hex=HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
LEFT JOIN _pc_text d7 ON d7.text_hex=HEX(CAST(s.category AS BLOB)) COLLATE BINARY AND s.category IS NOT NULL
LEFT JOIN _pc_text d14 ON d14.text_hex=HEX(CAST(s.track_name AS BLOB)) COLLATE BINARY AND s.track_name IS NOT NULL
LEFT JOIN _pc_text d15 ON d15.text_hex=HEX(CAST(s.process_name AS BLOB)) COLLATE BINARY AND s.process_name IS NOT NULL
LEFT JOIN _pc_text d16 ON d16.text_hex=HEX(CAST(s.thread_name AS BLOB)) COLLATE BINARY AND s.thread_name IS NOT NULL
ORDER BY s.ts,s.id;
SELECT s.arg_set_id AS arg_set_id,
 (SELECT COUNT(*) FROM args a WHERE a.arg_set_id=s.arg_set_id) AS arg_count,
 s.slice_count AS slice_count
FROM _pc_slice_sets s

ORDER BY s.arg_set_id;
SELECT s.arg_set_id AS arg_set_id,
 COALESCE(d1.text_id,0) AS flat_key_text_id,
 COALESCE(d2.text_id,0) AS key_text_id,
 COALESCE(d3.text_id,0) AS value_type_text_id,
 CASE WHEN s.value_type='uint' AND TYPEOF(s.int_value)='integer' AND s.int_value<0 THEN printf('%llu',s.int_value) ELSE s.int_value END AS int_value,
 COALESCE(d5.text_id,0) AS string_value_text_id,
 s.real_value AS real_value
FROM _pc_slice_args s
LEFT JOIN _pc_text d1 ON d1.text_hex=HEX(CAST(s.flat_key AS BLOB)) COLLATE BINARY AND s.flat_key IS NOT NULL
LEFT JOIN _pc_text d2 ON d2.text_hex=HEX(CAST(s.key AS BLOB)) COLLATE BINARY AND s.key IS NOT NULL
LEFT JOIN _pc_text d3 ON d3.text_hex=HEX(CAST(s.value_type AS BLOB)) COLLATE BINARY AND s.value_type IS NOT NULL
LEFT JOIN _pc_text d5 ON d5.text_hex=HEX(CAST(s.string_value AS BLOB)) COLLATE BINARY AND s.string_value IS NOT NULL
ORDER BY s.arg_set_id,s.flat_key COLLATE BINARY,s.key COLLATE BINARY,s.value_type COLLATE BINARY,CASE WHEN s.value_type='uint' AND s.int_value<0 THEN 1 ELSE 0 END,s.int_value,s.string_value COLLATE BINARY,s.real_value;
SELECT s.id AS id,
 COALESCE(d1.text_id,0) AS name_text_id,
 COALESCE(d2.text_id,0) AS type_text_id,
 s.parent_id AS parent_id,
 s.machine_id AS machine_id,
 s.source_arg_set_id AS source_arg_set_id,
 s.dimension_arg_set_id AS dimension_arg_set_id,
 s.track_group_id AS track_group_id,
 COALESCE(d8.text_id,0) AS event_type_text_id,
 COALESCE(d9.text_id,0) AS counter_unit_text_id,
 s.utid AS utid,
 s.upid AS upid
FROM _pc_tracks s
LEFT JOIN _pc_text d1 ON d1.text_hex=HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
LEFT JOIN _pc_text d2 ON d2.text_hex=HEX(CAST(s.type AS BLOB)) COLLATE BINARY AND s.type IS NOT NULL
LEFT JOIN _pc_text d8 ON d8.text_hex=HEX(CAST(s.event_type AS BLOB)) COLLATE BINARY AND s.event_type IS NOT NULL
LEFT JOIN _pc_text d9 ON d9.text_hex=HEX(CAST(s.counter_unit AS BLOB)) COLLATE BINARY AND s.counter_unit IS NOT NULL
ORDER BY s.id;
SELECT s.track_id AS track_id,
 COALESCE(d1.text_id,0) AS namespace_text_id,
 s.arg_set_id AS arg_set_id
FROM _pc_track_refs s
LEFT JOIN _pc_text d1 ON d1.text_hex=HEX(CAST(s.namespace AS BLOB)) COLLATE BINARY AND s.namespace IS NOT NULL
ORDER BY s.track_id,s.namespace COLLATE BINARY;
SELECT s.arg_set_id AS arg_set_id,
 (SELECT COUNT(*) FROM args a WHERE a.arg_set_id=s.arg_set_id) AS arg_count,
 s.reference_count AS reference_count
FROM _pc_track_sets s

ORDER BY s.arg_set_id;
SELECT s.arg_set_id AS arg_set_id,
 COALESCE(d1.text_id,0) AS flat_key_text_id,
 COALESCE(d2.text_id,0) AS key_text_id,
 COALESCE(d3.text_id,0) AS value_type_text_id,
 CASE WHEN s.value_type='uint' AND TYPEOF(s.int_value)='integer' AND s.int_value<0 THEN printf('%llu',s.int_value) ELSE s.int_value END AS int_value,
 COALESCE(d5.text_id,0) AS string_value_text_id,
 s.real_value AS real_value
FROM _pc_track_args s
LEFT JOIN _pc_text d1 ON d1.text_hex=HEX(CAST(s.flat_key AS BLOB)) COLLATE BINARY AND s.flat_key IS NOT NULL
LEFT JOIN _pc_text d2 ON d2.text_hex=HEX(CAST(s.key AS BLOB)) COLLATE BINARY AND s.key IS NOT NULL
LEFT JOIN _pc_text d3 ON d3.text_hex=HEX(CAST(s.value_type AS BLOB)) COLLATE BINARY AND s.value_type IS NOT NULL
LEFT JOIN _pc_text d5 ON d5.text_hex=HEX(CAST(s.string_value AS BLOB)) COLLATE BINARY AND s.string_value IS NOT NULL
ORDER BY s.arg_set_id,s.flat_key COLLATE BINARY,s.key COLLATE BINARY,s.value_type COLLATE BINARY,CASE WHEN s.value_type='uint' AND s.int_value<0 THEN 1 ELSE 0 END,s.int_value,s.string_value COLLATE BINARY,s.real_value;
SELECT s.upid AS upid,
 s.pid AS pid,
 COALESCE(d2.text_id,0) AS name_text_id
FROM _pc_processes s
LEFT JOIN _pc_text d2 ON d2.text_hex=HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
ORDER BY s.upid;
SELECT s.utid AS utid,
 s.tid AS tid,
 s.upid AS upid,
 COALESCE(d3.text_id,0) AS name_text_id
FROM _pc_threads s
LEFT JOIN _pc_text d3 ON d3.text_hex=HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
ORDER BY s.utid;
SELECT COALESCE(d0.text_id,0) AS name_text_id,
 s.idx AS idx,
 COALESCE(d2.text_id,0) AS severity_text_id,
 COALESCE(d3.text_id,0) AS source_text_id,
 s.value AS value
FROM _pc_stats s
LEFT JOIN _pc_text d0 ON d0.text_hex=HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
LEFT JOIN _pc_text d2 ON d2.text_hex=HEX(CAST(s.severity AS BLOB)) COLLATE BINARY AND s.severity IS NOT NULL
LEFT JOIN _pc_text d3 ON d3.text_hex=HEX(CAST(s.source AS BLOB)) COLLATE BINARY AND s.source IS NOT NULL
ORDER BY s.name COLLATE BINARY,s.idx;
SELECT s.start_ts AS start_ts,
 s.end_ts AS end_ts
FROM trace_bounds s

ORDER BY s.start_ts,s.end_ts;
