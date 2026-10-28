INCLUDE PERFETTO MODULE slices.with_context;
-- Fixed canonical uppercase ASCII hex is an injective byte encoding; BINARY
-- equality/order preserves empty, embedded NUL and invalid UTF8 distinctly.
-- Pinned authored gate rejects materialized BLOB. No runtime fallback exists.
CREATE PERFETTO VIEW _callback_selected AS
SELECT * FROM slice WHERE name COLLATE BINARY IN
  ('Graphics.Pipeline.DrawAndSwap', 'Display::FrameDisplayed', 'Graphics.Pipeline', 'PipelineReporter')
  OR name COLLATE BINARY IN (__PHASE_LITERALS__);

CREATE PERFETTO VIEW _callback_tracks AS
SELECT t.*, i.event_type, i.counter_unit, i.utid, i.upid
FROM track t JOIN __intrinsic_track i ON i.id = t.id
WHERE t.id IN (SELECT track_id FROM _callback_selected);

CREATE PERFETTO VIEW _callback_track_sets AS
SELECT id AS track_id, 'source' AS namespace, source_arg_set_id AS arg_set_id FROM _callback_tracks
UNION ALL
SELECT id AS track_id, 'dimension' AS namespace, dimension_arg_set_id AS arg_set_id FROM _callback_tracks;

CREATE PERFETTO VIEW _callback_names AS
WITH families(name) AS (VALUES ('Graphics.Pipeline.DrawAndSwap'),('Display::FrameDisplayed'),('Graphics.Pipeline'),('PipelineReporter')),
phases(name) AS (VALUES __PHASE_VALUES__)
SELECT name COLLATE BINARY AS name FROM families UNION SELECT name COLLATE BINARY FROM phases;

CREATE PERFETTO TABLE _callback_stats AS SELECT * FROM stats WHERE value != 0;

CREATE PERFETTO TABLE _callback_text AS
SELECT ROW_NUMBER() OVER (ORDER BY bytes_hex COLLATE BINARY) AS text_id, bytes_hex
FROM (
SELECT HEX(CAST(n.name AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_names n LEFT JOIN slice s ON s.name COLLATE BINARY = n.name COLLATE BINARY WHERE n.name IS NOT NULL
UNION
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id WHERE s.name IS NOT NULL
UNION
SELECT HEX(CAST(s.category AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id WHERE s.category IS NOT NULL
UNION
SELECT HEX(CAST(t.name AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id WHERE t.name IS NOT NULL
UNION
SELECT HEX(CAST(c.process_name AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id WHERE c.process_name IS NOT NULL
UNION
SELECT HEX(CAST(c.thread_name AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id WHERE c.thread_name IS NOT NULL
UNION
SELECT HEX(CAST(a.flat_key AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id WHERE a.flat_key IS NOT NULL
UNION
SELECT HEX(CAST(a.key AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id WHERE a.key IS NOT NULL
UNION
SELECT HEX(CAST(a.value_type AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id WHERE a.value_type IS NOT NULL
UNION
SELECT HEX(CAST(a.string_value AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id WHERE a.string_value IS NOT NULL
UNION
SELECT HEX(CAST(t.name AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_tracks t WHERE t.name IS NOT NULL
UNION
SELECT HEX(CAST(t.type AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_tracks t WHERE t.type IS NOT NULL
UNION
SELECT HEX(CAST(t.event_type AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_tracks t WHERE t.event_type IS NOT NULL
UNION
SELECT HEX(CAST(t.counter_unit AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_tracks t WHERE t.counter_unit IS NOT NULL
UNION
SELECT HEX(CAST(t.namespace AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_track_sets t LEFT JOIN args a ON a.arg_set_id = t.arg_set_id WHERE t.namespace IS NOT NULL
UNION
SELECT HEX(CAST(a.flat_key AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_track_sets t LEFT JOIN args a ON a.arg_set_id = t.arg_set_id WHERE a.flat_key IS NOT NULL
UNION
SELECT HEX(CAST(a.key AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_track_sets t LEFT JOIN args a ON a.arg_set_id = t.arg_set_id WHERE a.key IS NOT NULL
UNION
SELECT HEX(CAST(a.value_type AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_track_sets t LEFT JOIN args a ON a.arg_set_id = t.arg_set_id WHERE a.value_type IS NOT NULL
UNION
SELECT HEX(CAST(a.string_value AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_track_sets t LEFT JOIN args a ON a.arg_set_id = t.arg_set_id WHERE a.string_value IS NOT NULL
UNION
SELECT HEX(CAST(st.name AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_stats st WHERE st.name IS NOT NULL
UNION
SELECT HEX(CAST(st.severity AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_stats st WHERE st.severity IS NOT NULL
UNION
SELECT HEX(CAST(st.source AS BLOB)) COLLATE BINARY AS bytes_hex FROM _callback_stats st WHERE st.source IS NOT NULL
);

SELECT text_id, bytes_hex FROM _callback_text ORDER BY text_id;

SELECT d0.text_id AS name_text_id, COUNT(s.id) AS event_count,
  COUNT(DISTINCT s.arg_set_id) AS arg_set_count
FROM _callback_names n LEFT JOIN slice s ON s.name COLLATE BINARY = n.name COLLATE BINARY

LEFT JOIN _callback_text d0 ON d0.bytes_hex = HEX(CAST(n.name AS BLOB)) COLLATE BINARY AND n.name IS NOT NULL
GROUP BY n.name COLLATE BINARY ORDER BY n.name COLLATE BINARY;

SELECT s.id AS id,
  s.ts AS ts,
  s.dur AS dur,
  s.depth AS depth,
  s.parent_id AS parent_id,
  d0.text_id AS name_text_id,
  d1.text_id AS category_text_id,
  s.track_id AS track_id,
  s.arg_set_id AS arg_set_id,
  d2.text_id AS track_name_text_id,
  c.utid AS utid,
  c.tid AS tid,
  c.upid AS upid,
  c.pid AS pid,
  d3.text_id AS process_name_text_id,
  d4.text_id AS thread_name_text_id,
  s.ts IS NULL AS ts_is_null, s.dur IS NULL AS dur_is_null, s.depth IS NULL AS depth_is_null, s.parent_id IS NULL AS parent_id_is_null, s.name IS NULL AS name_is_null, s.category IS NULL AS category_is_null, s.track_id IS NULL AS track_id_is_null, s.arg_set_id IS NULL AS arg_set_id_is_null, t.name IS NULL AS track_name_is_null, c.utid IS NULL AS utid_is_null, c.tid IS NULL AS tid_is_null, c.upid IS NULL AS upid_is_null, c.pid IS NULL AS pid_is_null, c.process_name IS NULL AS process_name_is_null, c.thread_name IS NULL AS thread_name_is_null
FROM _callback_selected s LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id 
LEFT JOIN _callback_text d0 ON d0.bytes_hex = HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
LEFT JOIN _callback_text d1 ON d1.bytes_hex = HEX(CAST(s.category AS BLOB)) COLLATE BINARY AND s.category IS NOT NULL
LEFT JOIN _callback_text d2 ON d2.bytes_hex = HEX(CAST(t.name AS BLOB)) COLLATE BINARY AND t.name IS NOT NULL
LEFT JOIN _callback_text d3 ON d3.bytes_hex = HEX(CAST(c.process_name AS BLOB)) COLLATE BINARY AND c.process_name IS NOT NULL
LEFT JOIN _callback_text d4 ON d4.bytes_hex = HEX(CAST(c.thread_name AS BLOB)) COLLATE BINARY AND c.thread_name IS NOT NULL
ORDER BY s.ts, s.id;

SELECT s.id AS slice_id, s.arg_set_id, s.arg_set_id IS NULL AS arg_set_id_is_null,
  a.arg_set_id IS NOT NULL AS arg_present,
  d0.text_id AS flat_key_text_id,
  d1.text_id AS key_text_id,
  d2.text_id AS value_type_text_id,
  a.int_value AS int_value,
  d3.text_id AS string_value_text_id,
  a.real_value AS real_value,
  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null, a.value_type IS NULL AS value_type_is_null, a.int_value IS NULL AS int_value_is_null, a.string_value IS NULL AS string_value_is_null, a.real_value IS NULL AS real_value_is_null
FROM _callback_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id

LEFT JOIN _callback_text d0 ON d0.bytes_hex = HEX(CAST(a.flat_key AS BLOB)) COLLATE BINARY AND a.flat_key IS NOT NULL
LEFT JOIN _callback_text d1 ON d1.bytes_hex = HEX(CAST(a.key AS BLOB)) COLLATE BINARY AND a.key IS NOT NULL
LEFT JOIN _callback_text d2 ON d2.bytes_hex = HEX(CAST(a.value_type AS BLOB)) COLLATE BINARY AND a.value_type IS NOT NULL
LEFT JOIN _callback_text d3 ON d3.bytes_hex = HEX(CAST(a.string_value AS BLOB)) COLLATE BINARY AND a.string_value IS NOT NULL
ORDER BY s.ts, s.id, a.flat_key COLLATE BINARY, a.key COLLATE BINARY, a.value_type COLLATE BINARY, a.int_value, a.string_value COLLATE BINARY, a.real_value;

SELECT t.id AS id,
  d0.text_id AS name_text_id,
  d1.text_id AS type_text_id,
  t.parent_id AS parent_id,
  t.machine_id AS machine_id,
  t.source_arg_set_id AS source_arg_set_id,
  t.dimension_arg_set_id AS dimension_arg_set_id,
  t.track_group_id AS track_group_id,
  d2.text_id AS event_type_text_id,
  d3.text_id AS counter_unit_text_id,
  t.utid AS utid,
  t.upid AS upid,
  t.name IS NULL AS name_is_null, t.type IS NULL AS type_is_null, t.parent_id IS NULL AS parent_id_is_null, t.machine_id IS NULL AS machine_id_is_null, t.source_arg_set_id IS NULL AS source_arg_set_id_is_null, t.dimension_arg_set_id IS NULL AS dimension_arg_set_id_is_null, t.track_group_id IS NULL AS track_group_id_is_null, t.event_type IS NULL AS event_type_is_null, t.counter_unit IS NULL AS counter_unit_is_null, t.utid IS NULL AS utid_is_null, t.upid IS NULL AS upid_is_null FROM _callback_tracks t 
LEFT JOIN _callback_text d0 ON d0.bytes_hex = HEX(CAST(t.name AS BLOB)) COLLATE BINARY AND t.name IS NOT NULL
LEFT JOIN _callback_text d1 ON d1.bytes_hex = HEX(CAST(t.type AS BLOB)) COLLATE BINARY AND t.type IS NOT NULL
LEFT JOIN _callback_text d2 ON d2.bytes_hex = HEX(CAST(t.event_type AS BLOB)) COLLATE BINARY AND t.event_type IS NOT NULL
LEFT JOIN _callback_text d3 ON d3.bytes_hex = HEX(CAST(t.counter_unit AS BLOB)) COLLATE BINARY AND t.counter_unit IS NOT NULL
ORDER BY t.id;

SELECT t.track_id,
  d0.text_id AS namespace_text_id, t.arg_set_id, t.arg_set_id IS NULL AS arg_set_id_is_null,
  a.arg_set_id IS NOT NULL AS arg_present,
  d1.text_id AS flat_key_text_id,
  d2.text_id AS key_text_id,
  d3.text_id AS value_type_text_id,
  a.int_value AS int_value,
  d4.text_id AS string_value_text_id,
  a.real_value AS real_value,
  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null, a.value_type IS NULL AS value_type_is_null, a.int_value IS NULL AS int_value_is_null, a.string_value IS NULL AS string_value_is_null, a.real_value IS NULL AS real_value_is_null
FROM _callback_track_sets t LEFT JOIN args a ON a.arg_set_id = t.arg_set_id

LEFT JOIN _callback_text d0 ON d0.bytes_hex = HEX(CAST(t.namespace AS BLOB)) COLLATE BINARY AND t.namespace IS NOT NULL
LEFT JOIN _callback_text d1 ON d1.bytes_hex = HEX(CAST(a.flat_key AS BLOB)) COLLATE BINARY AND a.flat_key IS NOT NULL
LEFT JOIN _callback_text d2 ON d2.bytes_hex = HEX(CAST(a.key AS BLOB)) COLLATE BINARY AND a.key IS NOT NULL
LEFT JOIN _callback_text d3 ON d3.bytes_hex = HEX(CAST(a.value_type AS BLOB)) COLLATE BINARY AND a.value_type IS NOT NULL
LEFT JOIN _callback_text d4 ON d4.bytes_hex = HEX(CAST(a.string_value AS BLOB)) COLLATE BINARY AND a.string_value IS NOT NULL
ORDER BY t.track_id, t.namespace COLLATE BINARY, a.flat_key COLLATE BINARY, a.key COLLATE BINARY, a.value_type COLLATE BINARY, a.int_value, a.string_value COLLATE BINARY, a.real_value;

SELECT d0.text_id AS name_text_id, st.idx,
  d1.text_id AS severity_text_id, d2.text_id AS source_text_id, st.value,
  st.name IS NULL AS name_is_null, st.idx IS NULL AS idx_is_null,
  st.severity IS NULL AS severity_is_null, st.source IS NULL AS source_is_null,
  st.value IS NULL AS value_is_null
FROM _callback_stats st 
LEFT JOIN _callback_text d0 ON d0.bytes_hex = HEX(CAST(st.name AS BLOB)) COLLATE BINARY AND st.name IS NOT NULL
LEFT JOIN _callback_text d1 ON d1.bytes_hex = HEX(CAST(st.severity AS BLOB)) COLLATE BINARY AND st.severity IS NOT NULL
LEFT JOIN _callback_text d2 ON d2.bytes_hex = HEX(CAST(st.source AS BLOB)) COLLATE BINARY AND st.source IS NOT NULL
ORDER BY st.name COLLATE BINARY, st.idx,
  st.severity COLLATE BINARY, st.source COLLATE BINARY, st.value;

SELECT start_ts, end_ts, start_ts IS NULL AS start_ts_is_null,
  end_ts IS NULL AS end_ts_is_null FROM trace_bounds 
ORDER BY start_ts, end_ts;
