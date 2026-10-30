INCLUDE PERFETTO MODULE chrome.graphics_pipeline;

-- Fixed versioned wire representation of the complete original selected scope.
-- All grouping and population selection use raw values, never rendered cells.
CREATE PERFETTO VIEW _feedback_target_selected AS
SELECT id, ts, dur, name, track_id, arg_set_id FROM slice
WHERE name IN ('SetLayerTreeId', 'TracingStartedInBrowser', 'FrameCommittedInBrowser', 'FrameDeletedInBrowser', 'ProcessReadyInBrowser', 'BeginFrame', 'PipelineReporter', 'Graphics.Pipeline') OR name IN (__PHASE_LITERALS__);

CREATE PERFETTO VIEW _feedback_target_names AS
WITH names(name) AS (VALUES ('SetLayerTreeId'), ('TracingStartedInBrowser'), ('FrameCommittedInBrowser'), ('FrameDeletedInBrowser'), ('ProcessReadyInBrowser'), ('BeginFrame'), ('PipelineReporter'), ('Graphics.Pipeline')) SELECT name FROM names;

-- Registry includes empty non-NULL sets. NULL-set slices reconstruct placeholders.
CREATE PERFETTO VIEW _feedback_target_sets AS
SELECT arg_set_id, COUNT(*) AS slice_count FROM _feedback_target_selected
WHERE arg_set_id IS NOT NULL GROUP BY arg_set_id;

-- Expand each referenced set once, retaining every duplicate argument occurrence.
-- Context-only ancestor sets remain deliberately unexpanded as in original scope.
CREATE PERFETTO VIEW _feedback_target_args AS
SELECT a.* FROM args a JOIN _feedback_target_sets sets ON sets.arg_set_id = a.arg_set_id;

CREATE PERFETTO VIEW _feedback_target_dimensions AS
SELECT s.name, a.flat_key, a.key, a.value_type,
  COUNT(a.arg_set_id) AS arg_occurrence_count, COUNT(DISTINCT s.id) AS slice_count
FROM _feedback_target_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id
GROUP BY s.name, a.flat_key, a.key, a.value_type;

CREATE PERFETTO VIEW _feedback_target_stats AS SELECT * FROM stats WHERE value != 0;

-- Canonical uppercase hex preserves raw text bytes, including quotes, NUL and
-- invalid UTF8. text_id 0 is NULL only, never an actual dictionary member.
-- Group validity by bytes too: a same-byte BLOB cannot hide behind valid TEXT.
CREATE PERFETTO TABLE _feedback_target_text AS
SELECT ROW_NUMBER() OVER (ORDER BY text_hex COLLATE BINARY) AS text_id,
  text_hex, MIN(valid_text) AS valid_text
FROM (
SELECT HEX(CAST(n.name AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(n.name) = 'text' AS valid_text FROM _feedback_target_names n WHERE n.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(s.name AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(s.name) = 'text' AS valid_text FROM _feedback_target_selected s WHERE s.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(t.name AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(t.name) = 'text' AS valid_text FROM _feedback_target_selected s LEFT JOIN track t ON t.id = s.track_id WHERE t.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(c.process_name AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(c.process_name) = 'text' AS valid_text FROM _feedback_target_selected s LEFT JOIN thread_or_process_slice c ON c.id = s.id WHERE c.process_name IS NOT NULL
UNION ALL
SELECT HEX(CAST(c.thread_name AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(c.thread_name) = 'text' AS valid_text FROM _feedback_target_selected s LEFT JOIN thread_or_process_slice c ON c.id = s.id WHERE c.thread_name IS NOT NULL
UNION ALL
SELECT HEX(CAST(a.flat_key AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(a.flat_key) = 'text' AS valid_text FROM _feedback_target_args a WHERE a.flat_key IS NOT NULL
UNION ALL
SELECT HEX(CAST(a.key AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(a.key) = 'text' AS valid_text FROM _feedback_target_args a WHERE a.key IS NOT NULL
UNION ALL
SELECT HEX(CAST(a.value_type AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(a.value_type) = 'text' AS valid_text FROM _feedback_target_args a WHERE a.value_type IS NOT NULL
UNION ALL
SELECT HEX(CAST(a.string_value AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(a.string_value) = 'text' AS valid_text FROM _feedback_target_args a WHERE a.string_value IS NOT NULL
UNION ALL
SELECT HEX(CAST(st.name AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(st.name) = 'text' AS valid_text FROM _feedback_target_stats st WHERE st.name IS NOT NULL
UNION ALL
SELECT HEX(CAST(st.severity AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(st.severity) = 'text' AS valid_text FROM _feedback_target_stats st WHERE st.severity IS NOT NULL
UNION ALL
SELECT HEX(CAST(st.source AS BLOB)) COLLATE BINARY AS text_hex,
  TYPEOF(st.source) = 'text' AS valid_text FROM _feedback_target_stats st WHERE st.source IS NOT NULL
) GROUP BY text_hex COLLATE BINARY;

-- Table 1: complete deterministic text dictionary.
SELECT text_id, text_hex, valid_text FROM _feedback_target_text ORDER BY text_id;

-- Table 2: every original family census, including zero-count families.
SELECT d.text_id AS name_text_id, COUNT(s.id) AS event_count,
  COUNT(DISTINCT s.arg_set_id) AS arg_set_count
FROM _feedback_target_names n LEFT JOIN slice s ON s.name = n.name
JOIN _feedback_target_text d ON d.text_hex = HEX(CAST(n.name AS BLOB)) COLLATE BINARY
GROUP BY n.name ORDER BY n.name;

-- Table 3: original slices or full original ancestor context, in original order.
-- Scope enums: parent 0=no_parent,1=parent_present,2=missing_parent;
-- duration 0=nonnegative,1=unclosed,2=other_negative.
SELECT s.id AS id,
  s.ts AS ts,
  s.dur AS dur,
  COALESCE(d0.text_id, 0) AS name_text_id,
  s.track_id AS track_id,
  COALESCE(d1.text_id, 0) AS track_name_text_id,
  s.arg_set_id AS arg_set_id,
  c.utid AS utid,
  c.tid AS tid,
  c.upid AS upid,
  c.pid AS pid,
  COALESCE(d2.text_id, 0) AS process_name_text_id,
  COALESCE(d3.text_id, 0) AS thread_name_text_id
FROM _feedback_target_selected s
LEFT JOIN track t ON t.id = s.track_id
LEFT JOIN thread_or_process_slice c ON c.id = s.id
LEFT JOIN _feedback_target_text d0 ON d0.text_hex = HEX(CAST(s.name AS BLOB)) COLLATE BINARY AND s.name IS NOT NULL
LEFT JOIN _feedback_target_text d1 ON d1.text_hex = HEX(CAST(t.name AS BLOB)) COLLATE BINARY AND t.name IS NOT NULL
LEFT JOIN _feedback_target_text d2 ON d2.text_hex = HEX(CAST(c.process_name AS BLOB)) COLLATE BINARY AND c.process_name IS NOT NULL
LEFT JOIN _feedback_target_text d3 ON d3.text_hex = HEX(CAST(c.thread_name AS BLOB)) COLLATE BINARY AND c.thread_name IS NOT NULL
ORDER BY s.ts, s.id;

-- Table 4: exact occurrence and referring-slice multiplicities, no padding.
SELECT sets.arg_set_id,
  (SELECT COUNT(*) FROM args a WHERE a.arg_set_id = sets.arg_set_id) AS arg_count,
  sets.slice_count
FROM _feedback_target_sets sets ORDER BY sets.arg_set_id;

-- Table 5: each set's full raw argument multiset once, including duplicates.
-- Numeric cells retain the exact original pinned formatter contract.
SELECT a.arg_set_id AS arg_set_id,
  COALESCE(d0.text_id, 0) AS flat_key_text_id,
  COALESCE(d1.text_id, 0) AS key_text_id,
  COALESCE(d2.text_id, 0) AS value_type_text_id,
  a.int_value AS int_value,
  COALESCE(d3.text_id, 0) AS string_value_text_id,
  a.real_value AS real_value
FROM _feedback_target_args a
LEFT JOIN _feedback_target_text d0 ON d0.text_hex = HEX(CAST(a.flat_key AS BLOB)) COLLATE BINARY AND a.flat_key IS NOT NULL
LEFT JOIN _feedback_target_text d1 ON d1.text_hex = HEX(CAST(a.key AS BLOB)) COLLATE BINARY AND a.key IS NOT NULL
LEFT JOIN _feedback_target_text d2 ON d2.text_hex = HEX(CAST(a.value_type AS BLOB)) COLLATE BINARY AND a.value_type IS NOT NULL
LEFT JOIN _feedback_target_text d3 ON d3.text_hex = HEX(CAST(a.string_value AS BLOB)) COLLATE BINARY AND a.string_value IS NOT NULL
ORDER BY a.arg_set_id, a.flat_key, a.key, a.value_type,
  a.int_value, a.string_value, a.real_value;

-- Table 6: original selected occurrence groups, including unmatched placeholders.
SELECT COALESCE(d0.text_id, 0) AS name_text_id,
  COALESCE(d1.text_id, 0) AS flat_key_text_id,
  COALESCE(d2.text_id, 0) AS key_text_id,
  COALESCE(d3.text_id, 0) AS value_type_text_id,
  g.arg_occurrence_count AS arg_occurrence_count,
  g.slice_count AS slice_count
FROM _feedback_target_dimensions g
LEFT JOIN _feedback_target_text d0 ON d0.text_hex = HEX(CAST(g.name AS BLOB)) COLLATE BINARY AND g.name IS NOT NULL
LEFT JOIN _feedback_target_text d1 ON d1.text_hex = HEX(CAST(g.flat_key AS BLOB)) COLLATE BINARY AND g.flat_key IS NOT NULL
LEFT JOIN _feedback_target_text d2 ON d2.text_hex = HEX(CAST(g.key AS BLOB)) COLLATE BINARY AND g.key IS NOT NULL
LEFT JOIN _feedback_target_text d3 ON d3.text_hex = HEX(CAST(g.value_type AS BLOB)) COLLATE BINARY AND g.value_type IS NOT NULL
ORDER BY g.name, g.flat_key, g.key, g.value_type;

-- Table 7: all nonzero source stats, without interpretation or filtering.
SELECT COALESCE(d0.text_id, 0) AS name_text_id,
  st.idx AS idx,
  COALESCE(d1.text_id, 0) AS severity_text_id,
  COALESCE(d2.text_id, 0) AS source_text_id,
  st.value AS value
FROM _feedback_target_stats st
LEFT JOIN _feedback_target_text d0 ON d0.text_hex = HEX(CAST(st.name AS BLOB)) COLLATE BINARY AND st.name IS NOT NULL
LEFT JOIN _feedback_target_text d1 ON d1.text_hex = HEX(CAST(st.severity AS BLOB)) COLLATE BINARY AND st.severity IS NOT NULL
LEFT JOIN _feedback_target_text d2 ON d2.text_hex = HEX(CAST(st.source AS BLOB)) COLLATE BINARY AND st.source IS NOT NULL
ORDER BY st.name, st.idx;

-- Table 8: complete original trace bounds.
SELECT start_ts, end_ts FROM trace_bounds ORDER BY start_ts, end_ts;

-- Table 9: complete normalized first-display relation, duplicates retained.
-- Scope carries this full extra evidence too; no new qualification is implied.
SELECT surface_frame_trace_id, display_trace_id
FROM chrome_surface_frame_id_to_first_display_id
ORDER BY surface_frame_trace_id, display_trace_id;
