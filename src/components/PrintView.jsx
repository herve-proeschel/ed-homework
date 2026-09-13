export default function PrintView({ days, buildPrintHtml }) {
  if (!days) return null;
  return (
    <div id="printView">
      <h1 style={{ textAlign: 'center' }}>Devoirs à venir</h1>
      {/* eslint-disable-next-line react/no-danger -- markup built from API data, not user input */}
      <div dangerouslySetInnerHTML={{ __html: buildPrintHtml(days) }} />
    </div>
  );
}
