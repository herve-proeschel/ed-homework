export default function StatusMessage({ message, isError, emptyMessage = 'Téléchargez les devoirs.' }) {
  if (!message) return <div className={`status ${isError ? 'status-error' : 'status-info'}`}>{emptyMessage}</div>;
  return <div className={`status ${isError ? 'status-error' : 'status-info'}`}>{message}</div>;
}
