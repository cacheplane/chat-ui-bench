INCLUDE PERFETTO MODULE chrome.graphics_pipeline;

-- Exact retained names and literal phases share one scope; collisions select once.
CREATE PERFETTO VIEW _target_inventory_selected AS
SELECT id, ts, dur, name, track_id, arg_set_id FROM slice
WHERE name IN ('SetLayerTreeId', 'TracingStartedInBrowser',
  'FrameCommittedInBrowser', 'FrameDeletedInBrowser', 'ProcessReadyInBrowser',
  'BeginFrame', 'PipelineReporter', 'Graphics.Pipeline')
  OR name IN (__PHASE_LITERALS__);

WITH names(name) AS (VALUES ('SetLayerTreeId'), ('TracingStartedInBrowser'),
  ('FrameCommittedInBrowser'), ('FrameDeletedInBrowser'), ('ProcessReadyInBrowser'),
  ('BeginFrame'), ('PipelineReporter'), ('Graphics.Pipeline'))
-- The pinned formatter wraps text without escaping interior quotes. Compensate
-- only in final projections; all scope, grouping and ordering uses raw columns.
SELECT REPLACE(names.name, '"', '""') AS name, COUNT(slice.id) AS event_count,
  COUNT(DISTINCT slice.arg_set_id) AS arg_set_count
FROM names LEFT JOIN slice ON slice.name = names.name
GROUP BY names.name ORDER BY names.name;

SELECT s.id, s.ts, s.dur, REPLACE(s.name, '"', '""') AS name,
  s.track_id, REPLACE(t.name, '"', '""') AS track_name,
  s.arg_set_id, c.utid, c.tid, c.upid, c.pid,
  REPLACE(c.process_name, '"', '""') AS process_name,
  REPLACE(c.thread_name, '"', '""') AS thread_name,
  t.name IS NULL AS track_name_is_null,
  c.process_name IS NULL AS process_name_is_null,
  c.thread_name IS NULL AS thread_name_is_null
FROM _target_inventory_selected s LEFT JOIN track t ON s.track_id = t.id
LEFT JOIN thread_or_process_slice c ON c.id = s.id
ORDER BY s.ts, s.id;

-- Keep every matched argument and unmatched placeholder for each referring slice.
SELECT s.id AS slice_id, REPLACE(s.name, '"', '""') AS name, s.arg_set_id,
  a.arg_set_id IS NOT NULL AS arg_present,
  REPLACE(a.flat_key, '"', '""') AS flat_key,
  REPLACE(a.key, '"', '""') AS key,
  REPLACE(a.value_type, '"', '""') AS value_type,
  a.int_value, REPLACE(a.string_value, '"', '""') AS string_value, a.real_value,
  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null,
  a.value_type IS NULL AS value_type_is_null,
  a.int_value IS NULL AS int_value_is_null,
  a.string_value IS NULL AS string_value_is_null,
  a.real_value IS NULL AS real_value_is_null
FROM _target_inventory_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id
ORDER BY s.ts, s.id, a.flat_key, a.key, a.value_type,
  a.int_value, a.string_value, a.real_value;

-- Matched NULL keys contribute occurrences; unmatched slices contribute only slices.
SELECT REPLACE(s.name, '"', '""') AS name,
  REPLACE(a.flat_key, '"', '""') AS flat_key,
  REPLACE(a.key, '"', '""') AS key,
  REPLACE(a.value_type, '"', '""') AS value_type,
  COUNT(a.arg_set_id) AS arg_occurrence_count, COUNT(DISTINCT s.id) AS slice_count,
  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null,
  a.value_type IS NULL AS value_type_is_null
FROM _target_inventory_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id
GROUP BY s.name, a.flat_key, a.key, a.value_type
ORDER BY s.name, a.flat_key, a.key, a.value_type;

SELECT REPLACE(st.name, '"', '""') AS name, st.idx,
  REPLACE(st.severity, '"', '""') AS severity,
  REPLACE(st.source, '"', '""') AS source, st.value
FROM stats st WHERE st.value != 0 ORDER BY st.name, st.idx;

SELECT start_ts, end_ts FROM trace_bounds ORDER BY start_ts, end_ts;

-- The pinned module's normalized first-display relation is exported in full.
SELECT surface_frame_trace_id, display_trace_id
FROM chrome_surface_frame_id_to_first_display_id
ORDER BY surface_frame_trace_id, display_trace_id;
