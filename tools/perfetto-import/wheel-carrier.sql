INCLUDE PERFETTO MODULE chrome.graphics_pipeline;

-- Fixed complete wheel-family and literal-prefix inventory, without association.
-- Single selection preserves phase/family/prefix collisions once per slice.
CREATE PERFETTO VIEW _scope_inventory_selected AS
SELECT id, ts, dur, name, track_id, arg_set_id FROM slice
WHERE name COLLATE BINARY IN ('LatencyInfo.Flow',
  'WidgetBaseInputHandler::OnHandleInputEvent', 'EventDispatch',
  'InputLatency::MouseWheel', 'EventLatency')
  OR name COLLATE BINARY IN (__PHASE_LITERALS__)
  OR substr(name, 1, length('native-wheel-witness-v1:')) COLLATE BINARY
    = 'native-wheel-witness-v1:' COLLATE BINARY;

-- ID-only UNION terminates cycles and deduplicates shared existing ancestors.
CREATE PERFETTO VIEW _scope_inventory_context AS
WITH RECURSIVE context_ids(id) AS (
  SELECT id FROM _scope_inventory_selected
  UNION
  SELECT parent.id FROM context_ids c
  JOIN slice child ON child.id = c.id
  JOIN slice parent ON parent.id = child.parent_id
)
SELECT s.* FROM context_ids c JOIN slice s ON s.id = c.id;

-- Deduplicate raw names, never slice or argument occurrences. Binary collation
-- also applies to joins/grouping, regardless of the source column collation.
WITH families(name) AS (VALUES ('LatencyInfo.Flow'),
  ('WidgetBaseInputHandler::OnHandleInputEvent'), ('EventDispatch'),
  ('InputLatency::MouseWheel'), ('EventLatency')),
phases(name) AS (VALUES __PHASE_VALUES__),
names(name) AS (
  SELECT name COLLATE BINARY FROM families
  UNION SELECT name COLLATE BINARY FROM _scope_inventory_selected
  UNION SELECT name COLLATE BINARY FROM phases
)
SELECT REPLACE(names.name, '"', '""') AS name, COUNT(slice.id) AS event_count,
  COUNT(DISTINCT slice.arg_set_id) AS arg_set_count
FROM names LEFT JOIN slice ON slice.name COLLATE BINARY = names.name COLLATE BINARY
GROUP BY names.name COLLATE BINARY ORDER BY names.name COLLATE BINARY;

-- Parent edges and depth are raw shape, without consistency certification.
-- Context-only ancestor arg sets are visible here but deliberately unexpanded.
SELECT s.id, s.ts, s.dur, s.depth, s.parent_id,
  EXISTS(SELECT 1 FROM _scope_inventory_selected selected WHERE selected.id = s.id) AS is_selected,
  REPLACE(s.name, '"', '""') AS name, REPLACE(s.category, '"', '""') AS category,
  s.track_id, REPLACE(t.name, '"', '""') AS track_name,
  s.arg_set_id, c.utid, c.tid, c.upid, c.pid,
  REPLACE(c.process_name, '"', '""') AS process_name,
  REPLACE(c.thread_name, '"', '""') AS thread_name,
  CASE WHEN s.parent_id IS NULL THEN 'no_parent'
    WHEN parent.id IS NULL THEN 'missing_parent' ELSE 'parent_present' END AS parent_status,
  CASE WHEN s.dur = -1 THEN 'unclosed' WHEN s.dur < 0 THEN 'other_negative'
    ELSE 'nonnegative' END AS duration_status,
  s.parent_id IS NULL AS parent_id_is_null, s.name IS NULL AS name_is_null,
  s.category IS NULL AS category_is_null, t.name IS NULL AS track_name_is_null,
  c.process_name IS NULL AS process_name_is_null,
  c.thread_name IS NULL AS thread_name_is_null
FROM _scope_inventory_context s LEFT JOIN slice parent ON parent.id = s.parent_id
LEFT JOIN track t ON s.track_id = t.id
LEFT JOIN thread_or_process_slice c ON c.id = s.id
ORDER BY s.ts, s.id;

-- Group raw dimensions first; matched NULLs and unmatched placeholders share groups.
CREATE PERFETTO VIEW _scope_inventory_arg_groups AS
SELECT s.name, a.flat_key, a.key, a.value_type,
  COUNT(a.arg_set_id) AS arg_occurrence_count, COUNT(DISTINCT s.id) AS slice_count
FROM _scope_inventory_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id
GROUP BY s.name COLLATE BINARY, a.flat_key COLLATE BINARY,
  a.key COLLATE BINARY, a.value_type COLLATE BINARY;

-- Artifact-local IDs use a total raw TEXT order, never rendered text or input order.
CREATE PERFETTO VIEW _scope_inventory_arg_dictionary AS
SELECT ROW_NUMBER() OVER (ORDER BY
  name COLLATE BINARY,
  flat_key IS NOT NULL, flat_key COLLATE BINARY,
  key IS NOT NULL, key COLLATE BINARY,
  value_type IS NOT NULL, value_type COLLATE BINARY) AS arg_key_id,
  name, flat_key, key, value_type, arg_occurrence_count, slice_count
FROM _scope_inventory_arg_groups;

-- Keep every matched argument and unmatched placeholder for each referring slice.
SELECT s.id AS slice_id, d.arg_key_id, s.arg_set_id,
  a.arg_set_id IS NOT NULL AS arg_present,
  a.int_value, REPLACE(a.string_value, '"', '""') AS string_value, a.real_value,
  a.int_value IS NULL AS int_value_is_null,
  a.string_value IS NULL AS string_value_is_null,
  a.real_value IS NULL AS real_value_is_null
FROM _scope_inventory_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id
JOIN _scope_inventory_arg_dictionary d
  ON (d.name COLLATE BINARY) IS (s.name COLLATE BINARY)
  AND (d.flat_key COLLATE BINARY) IS (a.flat_key COLLATE BINARY)
  AND (d.key COLLATE BINARY) IS (a.key COLLATE BINARY)
  AND (d.value_type COLLATE BINARY) IS (a.value_type COLLATE BINARY)
ORDER BY s.ts, s.id, a.flat_key COLLATE BINARY, a.key COLLATE BINARY,
  a.value_type COLLATE BINARY, a.int_value, a.string_value COLLATE BINARY,
  a.real_value;

-- Matched NULL keys contribute occurrences; unmatched slices contribute only slices.
SELECT arg_key_id, REPLACE(name, '"', '""') AS name,
  REPLACE(flat_key, '"', '""') AS flat_key,
  REPLACE(key, '"', '""') AS key,
  REPLACE(value_type, '"', '""') AS value_type,
  arg_occurrence_count, slice_count,
  flat_key IS NULL AS flat_key_is_null, key IS NULL AS key_is_null,
  value_type IS NULL AS value_type_is_null
FROM _scope_inventory_arg_dictionary
ORDER BY arg_key_id;

SELECT REPLACE(st.name, '"', '""') AS name, st.idx,
  REPLACE(st.severity, '"', '""') AS severity,
  REPLACE(st.source, '"', '""') AS source, st.value,
  st.name IS NULL AS name_is_null, st.severity IS NULL AS severity_is_null,
  st.source IS NULL AS source_is_null
FROM stats st WHERE st.value != 0 ORDER BY st.name, st.idx;

SELECT start_ts, end_ts FROM trace_bounds ORDER BY start_ts, end_ts;
