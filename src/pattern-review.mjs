// Formal archive evidence is tied to the reviewed project, drawing and solution revision.
export function patternReviewState(project, revision = project.currentRevision || project) {
  const solution = revision?.solution;
  const drawing = revision?.drawing || (solution?.id === project.solution?.id ? project.drawing : null);
  const events = Array.isArray(project.events) ? project.events : [];
  const trace = revision?.trace;
  const empty = {latest:null, approved:null, archive:null};
  if (!project.id || !solution?.id || !drawing?.id || drawing.id !== 'CAD-' + solution.id + '-V' + solution.version) return empty;
  const belongs = entry => entry && entry.projectId === project.id && entry.version === solution.version &&
    entry.solutionId === solution.id && entry.drawingId === drawing.id;
  const validId = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
  const validTime = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
  const latestIndex = events.findLastIndex(entry => entry?.type === 'pattern-review' && belongs(entry));
  if (latestIndex < 0) return empty;
  const latest = events[latestIndex];
  if (latest.decision !== 'approved' || latest.actor !== '版师' || !validId(latest.reviewId) ||
      !validTime(latest.changedAt) || typeof latest.comment !== 'string' || !latest.comment.trim() || latest.comment.length > 400 ||
      (revision.changedAt && Date.parse(latest.changedAt) < Date.parse(revision.changedAt)) ||
      (trace && ['intakeId','requirementId','matchId'].some(key => (latest[key] ?? null) !== (trace[key] ?? null)))) {
    return {latest, approved:null, archive:null};
  }
  const archive = events.slice(latestIndex + 1).findLast(entry => entry?.type === 'archive' && belongs(entry) &&
    entry.reviewId === latest.reviewId && entry.actor === '业务人员' && validTime(entry.changedAt) &&
    Date.parse(entry.changedAt) >= Date.parse(latest.changedAt)) || null;
  return {latest, approved:latest, archive};
}
