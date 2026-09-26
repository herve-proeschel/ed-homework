export default function StatusMessage({ message, isError }) { 
  if (!message) return <div className={`status ${isError ? 'status-error' : 'status-info'}`}>Téléchargez les devoirs.</div>;;
  return <div className={`status ${isError ? 'status-error' : 'status-info'}`}>{message}</div>;
}
