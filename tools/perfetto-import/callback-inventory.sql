INCLUDE PERFETTO MODULE slices.with_context;

-- All exported TEXT uses byte hex to survive embedded NUL and invalid UTF8.
-- Fixed selected callback evidence only. Parent IDs are descriptive, not expanded.
CREATE PERFETTO VIEW _callback_selected AS
SELECT * FROM slice WHERE name COLLATE BINARY IN
  ('Graphics.Pipeline.DrawAndSwap', 'Display::FrameDisplayed', 'Graphics.Pipeline', 'PipelineReporter')
  OR name COLLATE BINARY IN (__PHASE_LITERALS__);

WITH families(name) AS (VALUES ('Graphics.Pipeline.DrawAndSwap'),
  ('Display::FrameDisplayed'), ('Graphics.Pipeline'), ('PipelineReporter')),
phases(name) AS (VALUES __PHASE_VALUES__),
names(name) AS (SELECT name COLLATE BINARY FROM families UNION SELECT name COLLATE BINARY FROM phases)
SELECT CASE WHEN n.name IS NULL THEN NULL ELSE HEX(CAST(n.name AS BLOB)) END AS name_bytes_hex, COUNT(s.id) AS event_count,
  COUNT(DISTINCT s.arg_set_id) AS arg_set_count
FROM names n LEFT JOIN slice s ON s.name COLLATE BINARY = n.name COLLATE BINARY
GROUP BY n.name COLLATE BINARY ORDER BY n.name COLLATE BINARY;

SELECT s.id AS id,
  s.ts AS ts,
  s.dur AS dur,
  s.depth AS depth,
  s.parent_id AS parent_id,
  CASE WHEN s.name IS NULL THEN NULL ELSE HEX(CAST(s.name AS BLOB)) END AS name_bytes_hex,
  CASE WHEN s.category IS NULL THEN NULL ELSE HEX(CAST(s.category AS BLOB)) END AS category_bytes_hex,
  s.track_id AS track_id,
  s.arg_set_id AS arg_set_id,
  CASE WHEN t.name IS NULL THEN NULL ELSE HEX(CAST(t.name AS BLOB)) END AS track_name_bytes_hex,
  c.utid AS utid,
  c.tid AS tid,
  c.upid AS upid,
  c.pid AS pid,
  CASE WHEN c.process_name IS NULL THEN NULL ELSE HEX(CAST(c.process_name AS BLOB)) END AS process_name_bytes_hex,
  CASE WHEN c.thread_name IS NULL THEN NULL ELSE HEX(CAST(c.thread_name AS BLOB)) END AS thread_name_bytes_hex,
  s.ts IS NULL AS ts_is_null, s.dur IS NULL AS dur_is_null, s.depth IS NULL AS depth_is_null, s.parent_id IS NULL AS parent_id_is_null, s.name IS NULL AS name_is_null, s.category IS NULL AS category_is_null, s.track_id IS NULL AS track_id_is_null, s.arg_set_id IS NULL AS arg_set_id_is_null, t.name IS NULL AS track_name_is_null, c.utid IS NULL AS utid_is_null, c.tid IS NULL AS tid_is_null, c.upid IS NULL AS upid_is_null, c.pid IS NULL AS pid_is_null, c.process_name IS NULL AS process_name_is_null, c.thread_name IS NULL AS thread_name_is_null
FROM _callback_selected s LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id ORDER BY s.ts, s.id;

-- Every occurrence, including matched all-NULL rows and unmatched placeholders.
SELECT s.id AS slice_id, s.arg_set_id, s.arg_set_id IS NULL AS arg_set_id_is_null,
  a.arg_set_id IS NOT NULL AS arg_present,
  CASE WHEN a.flat_key IS NULL THEN NULL ELSE HEX(CAST(a.flat_key AS BLOB)) END AS flat_key_bytes_hex,
  CASE WHEN a.key IS NULL THEN NULL ELSE HEX(CAST(a.key AS BLOB)) END AS key_bytes_hex,
  CASE WHEN a.value_type IS NULL THEN NULL ELSE HEX(CAST(a.value_type AS BLOB)) END AS value_type_bytes_hex,
  a.int_value AS int_value,
  CASE WHEN a.string_value IS NULL THEN NULL ELSE HEX(CAST(a.string_value AS BLOB)) END AS string_value_bytes_hex,
  a.real_value AS real_value,
  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null, a.value_type IS NULL AS value_type_is_null, a.int_value IS NULL AS int_value_is_null, a.string_value IS NULL AS string_value_is_null, a.real_value IS NULL AS real_value_is_null
FROM _callback_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id
ORDER BY s.ts, s.id, a.flat_key COLLATE BINARY, a.key COLLATE BINARY, a.value_type COLLATE BINARY, a.int_value, a.string_value COLLATE BINARY, a.real_value;

CREATE PERFETTO VIEW _callback_tracks AS
SELECT t.*, i.event_type, i.counter_unit, i.utid, i.upid
FROM track t JOIN __intrinsic_track i ON i.id = t.id
WHERE t.id IN (SELECT track_id FROM _callback_selected);

SELECT t.id AS id,
  CASE WHEN t.name IS NULL THEN NULL ELSE HEX(CAST(t.name AS BLOB)) END AS name_bytes_hex,
  CASE WHEN t.type IS NULL THEN NULL ELSE HEX(CAST(t.type AS BLOB)) END AS type_bytes_hex,
  t.parent_id AS parent_id,
  t.machine_id AS machine_id,
  t.source_arg_set_id AS source_arg_set_id,
  t.dimension_arg_set_id AS dimension_arg_set_id,
  t.track_group_id AS track_group_id,
  CASE WHEN t.event_type IS NULL THEN NULL ELSE HEX(CAST(t.event_type AS BLOB)) END AS event_type_bytes_hex,
  CASE WHEN t.counter_unit IS NULL THEN NULL ELSE HEX(CAST(t.counter_unit AS BLOB)) END AS counter_unit_bytes_hex,
  t.utid AS utid,
  t.upid AS upid,
  t.name IS NULL AS name_is_null, t.type IS NULL AS type_is_null, t.parent_id IS NULL AS parent_id_is_null, t.machine_id IS NULL AS machine_id_is_null, t.source_arg_set_id IS NULL AS source_arg_set_id_is_null, t.dimension_arg_set_id IS NULL AS dimension_arg_set_id_is_null, t.track_group_id IS NULL AS track_group_id_is_null, t.event_type IS NULL AS event_type_is_null, t.counter_unit IS NULL AS counter_unit_is_null, t.utid IS NULL AS utid_is_null, t.upid IS NULL AS upid_is_null FROM _callback_tracks t ORDER BY t.id;

-- Same set in both roles is expanded twice; argument rows are never deduplicated.
CREATE PERFETTO VIEW _callback_track_sets AS
SELECT id AS track_id, 'source' AS namespace, source_arg_set_id AS arg_set_id FROM _callback_tracks
UNION ALL
SELECT id AS track_id, 'dimension' AS namespace, dimension_arg_set_id AS arg_set_id FROM _callback_tracks;

SELECT t.track_id,
  CASE WHEN t.namespace IS NULL THEN NULL ELSE HEX(CAST(t.namespace AS BLOB)) END AS namespace_bytes_hex, t.arg_set_id, t.arg_set_id IS NULL AS arg_set_id_is_null,
  a.arg_set_id IS NOT NULL AS arg_present,
  CASE WHEN a.flat_key IS NULL THEN NULL ELSE HEX(CAST(a.flat_key AS BLOB)) END AS flat_key_bytes_hex,
  CASE WHEN a.key IS NULL THEN NULL ELSE HEX(CAST(a.key AS BLOB)) END AS key_bytes_hex,
  CASE WHEN a.value_type IS NULL THEN NULL ELSE HEX(CAST(a.value_type AS BLOB)) END AS value_type_bytes_hex,
  a.int_value AS int_value,
  CASE WHEN a.string_value IS NULL THEN NULL ELSE HEX(CAST(a.string_value AS BLOB)) END AS string_value_bytes_hex,
  a.real_value AS real_value,
  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null, a.value_type IS NULL AS value_type_is_null, a.int_value IS NULL AS int_value_is_null, a.string_value IS NULL AS string_value_is_null, a.real_value IS NULL AS real_value_is_null
FROM _callback_track_sets t LEFT JOIN args a ON a.arg_set_id = t.arg_set_id
ORDER BY t.track_id, t.namespace COLLATE BINARY, a.flat_key COLLATE BINARY, a.key COLLATE BINARY, a.value_type COLLATE BINARY, a.int_value, a.string_value COLLATE BINARY, a.real_value;

SELECT CASE WHEN st.name IS NULL THEN NULL ELSE HEX(CAST(st.name AS BLOB)) END AS name_bytes_hex, st.idx,
  CASE WHEN st.severity IS NULL THEN NULL ELSE HEX(CAST(st.severity AS BLOB)) END AS severity_bytes_hex, CASE WHEN st.source IS NULL THEN NULL ELSE HEX(CAST(st.source AS BLOB)) END AS source_bytes_hex, st.value,
  st.name IS NULL AS name_is_null, st.idx IS NULL AS idx_is_null,
  st.severity IS NULL AS severity_is_null, st.source IS NULL AS source_is_null,
  st.value IS NULL AS value_is_null
FROM stats st WHERE st.value != 0 ORDER BY st.name COLLATE BINARY, st.idx,
  st.severity COLLATE BINARY, st.source COLLATE BINARY, st.value;

SELECT start_ts, end_ts, start_ts IS NULL AS start_ts_is_null,
  end_ts IS NULL AS end_ts_is_null FROM trace_bounds ORDER BY start_ts, end_ts;
