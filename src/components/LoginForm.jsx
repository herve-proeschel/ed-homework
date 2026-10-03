export default function LoginForm({ username, setUsername, password, setPassword, onSubmit, busy }) {
  return (
    <>
      <div className="form-group">
        <input
          type="text"
          id="username"
          placeholder=" "
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <label htmlFor="username">Identifiant ÉcoleDirecte</label>
      </div>

      <div className="form-group">
        <input
          type="password"
          id="password"
          placeholder=" "
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <label htmlFor="password">Mot de passe</label>
      </div>

      <button type="button" className="main-btn" onClick={onSubmit} disabled={busy}>
        Connectez vous
      </button>
    </>
  );
}
