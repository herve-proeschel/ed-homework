export default function StatusMessage({ message, isError }) {
  if (!message) return null;
  return <div className={`status ${isError ? 'status-error' : 'status-info'}`}>{message}</div>;
}
