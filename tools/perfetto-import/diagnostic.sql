INCLUDE PERFETTO MODULE chrome.graphics_pipeline;

-- Literal phase names are substituted by the runner, never caller SQL.
SELECT s.id, s.ts, s.dur, s.name, s.track_id, t.name AS track_name
FROM slice s LEFT JOIN track t ON s.track_id = t.id
WHERE s.name IN (__PHASE_LITERALS__) ORDER BY s.ts, s.id;

SELECT name, idx, severity, source, value FROM stats
WHERE value != 0 ORDER BY name, idx;

SELECT start_ts, end_ts FROM trace_bounds;

-- Inventory only: these counts are not a frame population or FPS numerator.
WITH names(name) AS (VALUES ('FramePresented'), ('Display::DrawAndSwap'),
  ('PipelineReporter'), ('DrawFrame'), ('BeginFrame'), ('Graphics.Pipeline'))
SELECT names.name, COUNT(slice.id) AS event_count FROM names
LEFT JOIN slice ON slice.name = names.name GROUP BY names.name ORDER BY names.name;
