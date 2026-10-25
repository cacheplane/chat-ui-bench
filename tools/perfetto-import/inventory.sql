INCLUDE PERFETTO MODULE chrome.graphics_pipeline;

-- Literal phase names are substituted by the runner, never caller SQL.
SELECT s.id, s.ts, s.dur, s.name, s.track_id, t.name AS track_name,
  c.utid, c.tid, c.upid, c.pid, c.process_name, c.thread_name
FROM slice s LEFT JOIN track t ON s.track_id = t.id
LEFT JOIN thread_or_process_slice c ON c.id = s.id
WHERE s.name IN (__PHASE_LITERALS__) ORDER BY s.ts, s.id;

SELECT name, idx, severity, source, value FROM stats
WHERE value != 0 ORDER BY name, idx;

SELECT start_ts, end_ts FROM trace_bounds;

-- These counts do not establish a target or frame population.
WITH names(name) AS (VALUES ('FramePresented'), ('Display::DrawAndSwap'),
  ('PipelineReporter'), ('DrawFrame'), ('BeginFrame'), ('Graphics.Pipeline'))
SELECT names.name, COUNT(slice.id) AS event_count FROM names
LEFT JOIN slice ON slice.name = names.name GROUP BY names.name ORDER BY names.name;

SELECT 'surface_frame_steps' AS inventory, COUNT(*) AS row_count
FROM chrome_graphics_pipeline_surface_frame_steps
UNION ALL
SELECT 'display_frame_steps', COUNT(*)
FROM chrome_graphics_pipeline_display_frame_steps
UNION ALL
SELECT 'surface_first_display_mapping', COUNT(*)
FROM chrome_surface_frame_id_to_first_display_id
ORDER BY inventory;

SELECT 'surface_frame_steps' AS inventory, step, COUNT(*) AS row_count
FROM chrome_graphics_pipeline_surface_frame_steps GROUP BY step
UNION ALL
SELECT 'display_frame_steps', step, COUNT(*)
FROM chrome_graphics_pipeline_display_frame_steps GROUP BY step
ORDER BY inventory, step;

SELECT 'surface_without_first_display_mapping' AS inventory, COUNT(*) AS row_count
FROM (SELECT DISTINCT surface_frame_trace_id
  FROM chrome_graphics_pipeline_surface_frame_steps
  WHERE surface_frame_trace_id IS NOT NULL) s
WHERE NOT EXISTS (SELECT 1 FROM chrome_surface_frame_id_to_first_display_id m
  WHERE m.surface_frame_trace_id = s.surface_frame_trace_id);

-- The pinned module normalizes the invalid -1 ID to NULL.
SELECT 'surface_steps_without_surface_id' AS inventory, COUNT(*) AS row_count
FROM chrome_graphics_pipeline_surface_frame_steps
WHERE surface_frame_trace_id IS NULL;

-- Complete raw-slice groups retain NULL track/process/thread context.
SELECT s.name, s.track_id, t.name AS track_name,
  c.utid, c.tid, c.upid, c.pid, c.process_name, c.thread_name,
  COUNT(*) AS slice_count
FROM slice s LEFT JOIN track t ON s.track_id = t.id
LEFT JOIN thread_or_process_slice c ON c.id = s.id
WHERE s.name IN ('PipelineReporter', 'Graphics.Pipeline')
GROUP BY s.name, s.track_id, t.name,
  c.utid, c.tid, c.upid, c.pid, c.process_name, c.thread_name
ORDER BY s.name, s.track_id, t.name,
  c.utid, c.tid, c.upid, c.pid, c.process_name, c.thread_name;

-- Count matched argument rows even when their key is NULL; the equality join
-- guarantees a matched arg_set_id is non-NULL. Unmatched slices contribute zero
-- occurrences, but remain in slice_count, including in mixed NULL-key groups.
SELECT s.name, a.flat_key, a.key, a.value_type,
  COUNT(a.arg_set_id) AS arg_occurrence_count, COUNT(DISTINCT s.id) AS slice_count
FROM slice s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id
WHERE s.name IN ('PipelineReporter', 'Graphics.Pipeline')
GROUP BY s.name, a.flat_key, a.key, a.value_type
ORDER BY s.name, a.flat_key, a.key, a.value_type;
