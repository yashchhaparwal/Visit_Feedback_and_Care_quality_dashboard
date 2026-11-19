export function Loading({ height = 120 }) {
  return <div className="card skeleton" style={{ height }} aria-busy="true" aria-label="Loading" />;
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="alert alert-error" role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <span>{error.message}</span>
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}
