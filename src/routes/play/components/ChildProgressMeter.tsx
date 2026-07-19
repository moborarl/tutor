export function ChildProgressMeter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const safeMax = Math.max(0, max);
  const safeValue = Math.min(Math.max(0, value), safeMax);
  const percentage = safeMax === 0 ? 0 : Math.round((safeValue / safeMax) * 100);

  return (
    <div className="child-progress-meter">
      <div className="child-progress-meter-label">
        <span>{label}</span>
        <strong>{percentage}%</strong>
      </div>
      <progress aria-label={label} value={safeValue} max={safeMax || 1}>
        {percentage}%
      </progress>
    </div>
  );
}
