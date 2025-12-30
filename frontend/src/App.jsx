import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { FaWhatsapp, FaEnvelope, FaTerminal, FaCog, FaUser, FaLock, FaUserPlus } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';

// Initialize socket outside but connect later
let socket;

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);

  // Auth Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Dashboard State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [qrCode, setQrCode] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState([]);
  const [senders, setSenders] = useState([]);
  const [newSender, setNewSender] = useState('');
  // Config Form
  const [startConfig, setStartConfig] = useState({});

  useEffect(() => {
    if (token) {
      // Connect Socket with Token
      socket = io('http://localhost:3001', {
        auth: { token }
      });

      socket.on('connect', () => addLog('Connected to Personal Session'));
      socket.on('qr', (qr) => { setQrCode(qr); setIsReady(false); });
      socket.on('ready', (s) => { setIsReady(s); if (s) setQrCode(''); });
      socket.on('log', (msg) => addLog(msg));

      fetchUser();
      fetchSenders();

      return () => { socket.disconnect(); }
    }
  }, [token]);

  const addLog = (msg) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 50));

  // --- API HELPER ---
  const api = async (url, options = {}) => {
    const res = await fetch(`http://localhost:3001/api${url}`, {
      ...options,
      headers: { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) logout();
    return res;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? '/register' : '/login';
    try {
      const res = await fetch(`http://localhost:3001/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setUser(data.user);
      } else {
        alert(data.error);
      }
    } catch (err) { alert('Connection Error'); }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setUser(null);
    if (socket) socket.disconnect();
  };

  const fetchUser = async () => {
    const res = await api('/me');
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setStartConfig(data);
    }
  };

  const fetchSenders = async () => {
    const res = await api('/senders');
    if (res.ok) setSenders(await res.json());
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    const res = await api('/me', { method: 'PUT', body: JSON.stringify(startConfig) });
    if (res.ok) { alert('Saved!'); setActiveTab('dashboard'); }
  };

  const addSender = async (e) => {
    e.preventDefault();
    if (!newSender) return;
    await api('/senders', { method: 'POST', body: JSON.stringify({ email: newSender }) });
    setNewSender('');
    fetchSenders();
  };

  // --- RENDER ---

  if (!token) {
    return (
      <div className="onboarding-overlay">
        <div className="card onboarding-card">
          <div className="header">
            <h1>{isRegistering ? 'Create Account' : 'Welcome Back'}</h1>
            <p>{isRegistering ? 'Setup your personal notification bridge.' : 'Login to access your dashboard.'}</p>
          </div>
          <form onSubmit={handleAuth}>
            <div className="form-field">
              <label>Username</label>
              <input required value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button type="submit" style={{ width: '100%' }}>{isRegistering ? 'Register & Start' : 'Login'}</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
            <button onClick={() => setIsRegistering(!isRegistering)} style={{ background: 'none', border: 'none', color: '#7c3aed', padding: '0 5px', textDecoration: 'underline', cursor: 'pointer' }}>
              {isRegistering ? 'Login here' : 'Register here'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Initial Onboarding (if logged in but no whatsapp number)
  if (user && !user.whatsapp_number) {
    return (
      <div className="onboarding-overlay">
        <div className="card onboarding-card">
          <div className="header"><h1>Setup Profile ⚙️</h1><p>Configure your contact details to start.</p></div>
          <form onSubmit={saveConfig}>
            <div className="form-field"><label>WhatsApp Number (@c.us)</label><input required value={startConfig.whatsapp_number || ''} onChange={e => setStartConfig({ ...startConfig, whatsapp_number: e.target.value })} placeholder="5511999998888@c.us" /></div>
            <div className="form-field"><label>Email User</label><input required value={startConfig.email_user || ''} onChange={e => setStartConfig({ ...startConfig, email_user: e.target.value })} /></div>
            <div className="form-field"><label>App Password</label><input type="password" required value={startConfig.email_pass || ''} onChange={e => setStartConfig({ ...startConfig, email_pass: e.target.value })} /></div>
            <button type="submit" style={{ width: '100%' }}>Save & Continue</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Email Bridge <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'normal' }}>| {user?.username}</span></h3>
        <button onClick={logout} className="secondary" style={{ fontSize: '0.8rem' }}>Logout</button>
      </header>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="grid">
          <div className="card">
            <h2><FaWhatsapp /> Connection</h2>
            <div className="qr-container">
              {isReady ? <div style={{ textAlign: 'center' }}><div className="status-badge">● Online</div><button onClick={() => api('/whatsapp/restart', { method: 'POST' })} style={{ marginTop: '1rem', background: '#ef4444' }}>Reset</button></div> :
                <div style={{ textAlign: 'center' }}><div className="status-badge pending">{qrCode ? 'Scan Code' : 'Connecting...'}</div>{qrCode && <QRCodeSVG value={qrCode} size={180} />}</div>}
            </div>
          </div>
          <div className="card">
            <h2><FaEnvelope /> Senders</h2>
            <form onSubmit={addSender} className="input-group"><input value={newSender} onChange={e => setNewSender(e.target.value)} placeholder="Email..." /><button>Add</button></form>
            <ul className="sender-list">{senders.map(s => <li key={s.id} className="sender-item"><span>{s.email}</span><button className="delete-btn" onClick={() => { api(`/senders/${s.id}`, { method: 'DELETE' }); fetchSenders() }}>&times;</button></li>)}</ul>
          </div>
          <div className="card full-width"><h2><FaTerminal /> Logs</h2><div className="logs">{logs.map((l, i) => <div key={i} className="log-entry">{l}</div>)}</div></div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2>Settings</h2>
          <form onSubmit={saveConfig}>
            <div className="form-field"><label>WhatsApp</label><input value={startConfig.whatsapp_number || ''} onChange={e => setStartConfig({ ...startConfig, whatsapp_number: e.target.value })} /></div>
            <div className="form-field"><label>Email</label><input value={startConfig.email_user || ''} onChange={e => setStartConfig({ ...startConfig, email_user: e.target.value })} /></div>
            <div className="form-field"><label>Password (Hidden)</label><input type="password" value={startConfig.email_pass || ''} onChange={e => setStartConfig({ ...startConfig, email_pass: e.target.value })} placeholder="******" /></div>
            <button>Save</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
