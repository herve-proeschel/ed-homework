export default function LoginForm({ username, setUsername, password, setPassword, onSubmit, busy }) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="username">Identifiant ÉcoleDirecte</label>
        <input
          type="text"
          id="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Mot de passe</label>
        <input
          type="password"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <button type="button" className="main-btn" onClick={onSubmit} disabled={busy}>
        Connectez vous
      </button>
    </>
  );
}
