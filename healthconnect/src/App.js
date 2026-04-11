import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { auth, db } from "./firebase";
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./App.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const COLORS = ["#2563eb","#7c3aed","#059669","#d97706","#dc2626","#0d9488","#6366f1","#ea580c","#0891b2","#be185d"];
const ALL_TESTS = ["Blood Test (CBC)","MRI Brain","CT Scan Chest","ECG","X-Ray","Lipid Profile"];
const SPECIALITIES = [
  "All","Cardiology","Neurology","Orthopedics","Oncology","Pediatrics",
  "Gastroenterology","Nephrology","General Medicine","Emergency","Surgery",
  "Dermatology","Psychiatry","Ophthalmology","ENT","Urology",
  "Endocrinology","Pulmonology","Rheumatology"
];
const TIME_SLOTS = ["9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM"];

const HEALTH_TIPS = [
  { id:1, category:"Prevention", icon:"🛡️", color:"#059669", title:"Regular Health Checkups", desc:"Get a full body checkup at least once a year. Early detection can prevent serious health issues.", tip:"Schedule your next checkup today!" },
  { id:2, category:"Nutrition", icon:"🥗", color:"#d97706", title:"Balanced Diet is Key", desc:"Include plenty of fruits, vegetables, whole grains, and lean proteins. Limit processed foods and excessive sugar.", tip:"Try adding one new vegetable this week!" },
  { id:3, category:"Mental Health", icon:"🧠", color:"#7c3aed", title:"Prioritize Mental Wellness", desc:"Practice meditation, deep breathing, or yoga daily. Don't hesitate to seek professional help if needed.", tip:"Start with 5 minutes of meditation today." },
  { id:4, category:"First Aid", icon:"🩹", color:"#dc2626", title:"Basic First Aid Knowledge", desc:"Everyone should know CPR, treating burns, stopping bleeding, and handling choking emergencies.", tip:"Take a free first aid course online!" },
  { id:5, category:"Fitness", icon:"🏃", color:"#2563eb", title:"Stay Physically Active", desc:"Aim for at least 30 minutes of moderate exercise daily. Walking, jogging, or swimming reduces disease risk.", tip:"A 30-min walk daily adds years to your life!" },
  { id:6, category:"Hygiene", icon:"🧼", color:"#0891b2", title:"Maintain Good Hygiene", desc:"Wash hands frequently, maintain oral hygiene, and keep your living environment clean.", tip:"Wash hands for at least 20 seconds!" },
  { id:7, category:"Sleep", icon:"😴", color:"#6366f1", title:"Quality Sleep Matters", desc:"Adults need 7-9 hours of quality sleep per night. Poor sleep increases risk of heart disease and obesity.", tip:"Put away screens 1 hour before bed." },
  { id:8, category:"Hydration", icon:"💧", color:"#0d9488", title:"Drink Enough Water", desc:"Stay hydrated — at least 8 glasses (2 liters) daily. Hydration improves digestion, skin, and energy.", tip:"Carry a water bottle everywhere!" },
];

const EMERGENCY_CONTACTS = [
  { name:"Ambulance", number:"102", icon:"🚑", color:"#dc2626", desc:"Medical Emergency — Free ambulance" },
  { name:"Police", number:"100", icon:"👮", color:"#6366f1", desc:"Law enforcement assistance" },
  { name:"Fire Brigade", number:"101", icon:"🚒", color:"#ea580c", desc:"Fire & rescue services" },
  { name:"Women Helpline", number:"1091", icon:"👩", color:"#7c3aed", desc:"24/7 women safety helpline" },
  { name:"Child Helpline", number:"1098", icon:"👶", color:"#0891b2", desc:"Child protection & emergency" },
  { name:"Emergency", number:"112", icon:"🆘", color:"#be185d", desc:"Universal emergency — works everywhere" },
  { name:"Mental Health", number:"08046110007", icon:"🧠", color:"#6366f1", desc:"NIMHANS mental health helpline" },
  { name:"COVID Helpline", number:"1075", icon:"😷", color:"#059669", desc:"Health ministry COVID helpline" },
];

const API_URL = process.env.REACT_APP_API_URL || "https://healthconnect-backend-pcun.onrender.com";

/* ═══════════════════════════════════════
   UTILITY COMPONENTS
   ═══════════════════════════════════════ */

/* Typing animation hook */
function useTyping(phrases, typeSpeed = 80, deleteSpeed = 40, pause = 2000) {
  const [text, setText] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIdx];
    let timer;

    if (!isDeleting && text === current) {
      timer = setTimeout(() => setIsDeleting(true), pause);
    } else if (isDeleting && text === "") {
      setIsDeleting(false);
      setPhraseIdx((prev) => (prev + 1) % phrases.length);
    } else {
      timer = setTimeout(() => {
        setText(
          isDeleting
            ? current.substring(0, text.length - 1)
            : current.substring(0, text.length + 1)
        );
      }, isDeleting ? deleteSpeed : typeSpeed);
    }
    return () => clearTimeout(timer);
  }, [text, phraseIdx, isDeleting, phrases, typeSpeed, deleteSpeed, pause]);

  return text;
}

/* Animated counter */
function AnimCounter({ target, duration = 1500, suffix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const num = parseInt(target, 10);
          if (isNaN(num)) { setCount(target); return; }
          const start = performance.now();
          const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * num));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* Star rating */
const Stars = ({ rating, size = 14 }) => (
  <span>
    {[1, 2, 3, 4, 5].map((s) => (
      <span key={s} style={{ fontSize: size, color: s <= Math.round(rating) ? "#f59e0b" : "#d1d5db" }}>★</span>
    ))}
  </span>
);

/* Badge */
const Badge = ({ children, color = "gray" }) => (
  <span className={`badge badge-${color}`}>{children}</span>
);

/* Loading Screen */
function LoaderScreen({ visible }) {
  return (
    <div className={`loader-screen ${visible ? "" : "hide"}`}>
      <div className="loader-logo">Pulse<span>RATE</span></div>
      <div className="loader-sub">AI-Powered Healthcare</div>
      <svg className="loader-ecg" viewBox="0 0 200 50">
        <path d="M0,25 L30,25 L40,10 L50,40 L60,5 L70,45 L80,25 L110,25 L120,15 L130,35 L140,20 L150,30 L160,25 L200,25" />
      </svg>
    </div>
  );
}

/* ═══ MAP ═══ */
function RealMap({ hospitals, onSelect }) {
  const center = hospitals.length > 0
    ? [hospitals[0].lat || 28.6139, hospitals[0].lng || 77.209]
    : [20.5937, 78.9629];
  const CITY_PINS = [
    { name: "Delhi", lat: 28.6139, lng: 77.209 },
    { name: "Mumbai", lat: 19.076, lng: 72.8777 },
    { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
    { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
    { name: "Pune", lat: 18.5204, lng: 73.8567 },
    { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
    { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  ];

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", height: hospitals.length > 0 ? 400 : 550, border: "1px solid var(--border)" }}>
      <MapContainer center={center} zoom={hospitals.length > 0 ? 11 : 5} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {hospitals.map((h) => (
          <Marker key={h.id} position={[h.lat || 28.6139, h.lng || 77.209]}>
            <Popup>
              <div style={{ fontFamily: "var(--font-body)", minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{h.name}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>📍 {h.address}</div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>⭐ {h.rating} · {h.reviews.toLocaleString()} reviews</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`} target="_blank" rel="noreferrer"
                    style={{ background: "#2563eb", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Directions</a>
                  <button onClick={() => onSelect(h)} style={{ background: "#059669", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>View</button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        {hospitals.length === 0 && CITY_PINS.map((c) => (
          <Marker key={c.name} position={[c.lat, c.lng]}>
            <Popup><strong>🏥 {c.name}</strong><br />Search hospitals in {c.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

/* ═══ AUTH ═══ */
function AuthPage({ onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError(""); setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name) { setError("Please enter your name"); setLoading(false); return; }
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: name });
      }
      onSuccess();
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use": "Email already registered. Please login.",
        "auth/wrong-password": "Wrong password. Try again.",
        "auth/user-not-found": "No account found. Please sign up.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-email": "Please enter a valid email.",
      };
      setError(msgs[e.code] || "Something went wrong. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/pulserate-logo.png?v=2" alt="PulseRATE" />
          <div className="auth-logo-text">Pulse<span className="rate">RATE</span></div>
          <div className="auth-sub">{isLogin ? "Welcome back! Sign in to continue." : "Create your account to get started."}</div>
        </div>
        {!isLogin && <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="auth-input" />}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" className="auth-input" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 6 chars)" className="auth-input" onKeyDown={e => e.key === "Enter" && handle()} />
        {error && <div className="auth-err">❌ {error}</div>}
        <button onClick={handle} disabled={loading} className="auth-btn">
          {loading ? "Please wait..." : isLogin ? "Sign In →" : "Create Account →"}
        </button>
        <div className="auth-toggle">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span className="auth-toggle-link" onClick={() => { setIsLogin(!isLogin); setError(""); }}>
            {isLogin ? "Sign Up" : "Sign In"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══ BOOKING MODAL ═══ */
function BookingModal({ doctor, hospital, user, onClose, onBooked }) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("Mon, 24 Mar");
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState(user?.displayName || "");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [saving, setSaving] = useState(false);
  const dates = ["Mon, 24 Mar", "Tue, 25 Mar", "Wed, 26 Mar", "Thu, 27 Mar", "Fri, 28 Mar"];

  const confirmBooking = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/appointments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorName: doctor.name, doctorSpec: doctor.spec, doctorEmail: doctor.email, hospitalName: hospital.name, hospitalId: hospital.id, date, time: slot, patientName: name, patientAge: age, patientEmail: user?.email, reason, fee: doctor.fee }),
      });
      const data = await res.json();
      if (data.success) { setBookingId(data.appointment.id); setDone(true); if (onBooked) onBooked(); }
    } catch {
      setBookingId("HC" + Math.floor(Math.random() * 90000 + 10000));
      setDone(true); if (onBooked) onBooked();
    }
    setSaving(false);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 3 }}>Booking Appointment</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{doctor.name}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{doctor.spec} · {hospital.name}</div>
            </div>
            <button className="modal-x" onClick={onClose}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div className={`step-dot ${step >= s ? "on" : "off"}`}>{s}</div>
                <span style={{ fontSize: 11, opacity: step >= s ? 1 : 0.5 }}>{["Date", "Info", "Pay", "Confirm"][s - 1]}</span>
                {s < 4 && <span style={{ opacity: 0.3, margin: "0 2px" }}>›</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-body">
          {!done ? (
            <>
              {step === 1 && <div>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Select Date</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  {dates.map(d => <button key={d} onClick={() => setDate(d)} className={`date-pill ${date === d ? "on" : ""}`}>{d}</button>)}
                </div>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Select Time</div>
                <div className="time-grid">
                  {TIME_SLOTS.map(t => <button key={t} onClick={() => setSlot(t)} className={`time-pill ${slot === t ? "on" : ""}`}>{t}</button>)}
                </div>
                <button onClick={() => slot && setStep(2)} className={`btn btn-lg ${slot ? "btn-primary" : "btn-outline"}`} style={{ width: "100%" }}>Continue →</button>
              </div>}

              {step === 2 && <div>
                <div style={{ fontWeight: 700, marginBottom: 14 }}>Patient Information</div>
                {[["Full Name", name, setName, "text"], ["Age", age, setAge, "number"], ["Phone Number", phone, setPhone, "tel"]].map(([l, v, set, t]) => (
                  <div key={l} style={{ marginBottom: 12 }}>
                    <label className="form-label">{l}</label>
                    <input type={t} value={v} onChange={e => set(e.target.value)} placeholder={l} className="form-input" />
                  </div>
                ))}
                <div style={{ marginBottom: 18 }}>
                  <label className="form-label">Reason for Visit</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe symptoms..." className="form-input" style={{ resize: "vertical", minHeight: 70 }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(1)} className="btn btn-outline" style={{ flex: 1 }}>← Back</button>
                  <button onClick={() => name && phone && setStep(3)} className="btn btn-primary" style={{ flex: 2 }}>Continue →</button>
                </div>
              </div>}

              {step === 3 && <div>
                <div style={{ fontWeight: 700, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                  <span>Card Details</span><span style={{ fontSize: 22 }}>💳</span>
                </div>
                <div className="pay-card">
                  <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Card Number</div>
                  <input type="text" placeholder="0000 0000 0000 0000" maxLength={19} className="pay-input" />
                  <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Expiry</div><input type="text" placeholder="MM/YY" maxLength={5} className="pay-sm" /></div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>CVC</div><input type="password" placeholder="•••" maxLength={3} className="pay-sm" /></div>
                  </div>
                </div>
                <div style={{ fontSize: 12, textAlign: "center", color: "var(--text-muted)", marginBottom: 18 }}>🔒 Secured by Stripe API Sandbox</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(2)} className="btn btn-outline" style={{ flex: 1 }}>← Back</button>
                  <button onClick={() => setStep(4)} className="btn btn-primary" style={{ flex: 2 }}>Verify →</button>
                </div>
              </div>}

              {step === 4 && <div>
                <div className="summary-box">
                  <div style={{ fontWeight: 700, marginBottom: 12, color: "var(--primary)" }}>Appointment Summary</div>
                  {[["Doctor", doctor.name], ["Speciality", doctor.spec], ["Hospital", hospital.name], ["Date", date], ["Time", slot], ["Patient", name], ["Phone", phone], ["Fee", `₹${doctor.fee}`]].map(([k, v]) => (
                    <div key={k} className="summary-row"><span className="k">{k}</span><span className="v">{v}</span></div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(3)} className="btn btn-outline" style={{ flex: 1 }}>← Back</button>
                  <button onClick={confirmBooking} disabled={saving} className="btn btn-success" style={{ flex: 2 }}>
                    {saving ? "Processing..." : `Pay ₹${doctor.fee} & Confirm ✓`}
                  </button>
                </div>
              </div>}
            </>
          ) : (
            <div className="book-ok">
              <div className="book-ok-icon">✅</div>
              <div className="book-ok-title">Booking Confirmed!</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>Hi <strong>{user?.displayName || "User"}</strong>, your appointment is booked.</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>ID: <strong style={{ color: "var(--primary)" }}>{bookingId}</strong></div>
              <button onClick={onClose} className="btn btn-primary">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ CHATBOT ═══ */
function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ sender: "bot", text: "Hi! I'm PulseRATE AI. What symptoms are you experiencing?" }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { sender: "user", text: input }]);
    const q = input.toLowerCase(); setInput(""); setTyping(true);
    setTimeout(() => {
      let r = "I recommend consulting a General Physician for a thorough checkup.";
      if (q.includes("headache") || q.includes("migraine")) r = "Frequent headaches can be concerning. I recommend seeing a **Neurologist**.";
      else if (q.includes("heart") || q.includes("chest")) r = "Chest pain is serious. Please consult a **Cardiologist** immediately.";
      else if (q.includes("stomach") || q.includes("digestion")) r = "Digestive issues are best evaluated by a **Gastroenterologist**.";
      else if (q.includes("bone") || q.includes("joint") || q.includes("knee")) r = "Joint issues are best handled by an **Orthopedic** specialist.";
      setMessages(p => [...p, { sender: "bot", text: r }]); setTyping(false);
    }, 1200);
  };

  return (
    <div className="chat-wrap">
      {open ? (
        <div className="chat-win">
          <div className="chat-head">
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>PulseRATE AI</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>🟢 Online · Medical Assistant</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <div className="chat-msgs">
            {messages.map((m, i) => <div key={i} className={`chat-bub ${m.sender}`}>{m.text}</div>)}
            {typing && <div className="chat-typing">AI is thinking...</div>}
          </div>
          <div className="chat-bar">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Type symptoms..." className="chat-inp" />
            <button onClick={send} className="chat-send">➤</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="chat-fab" title="Chat with AI">💬</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [view, setView] = useState("home");
  const [appReady, setAppReady] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("hc-theme");
    return s ? s === "dark" : false;
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("hc-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("All");
  const [sortBy, setSortBy] = useState("rating");
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [activeTab, setActiveTab] = useState("doctors");
  const [selectedTests, setSelectedTests] = useState(["Blood Test (CBC)", "MRI Brain"]);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [searchInput, setSearchInput] = useState("");
  const [notif, setNotif] = useState(null);
  const [smsPush, setSmsPush] = useState(false);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [hospitalReviews, setHospitalReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [tipsFilter, setTipsFilter] = useState("All");
  const [cityInput, setCityInput] = useState("New Delhi");
  const [aiDisease, setAiDisease] = useState(null);
  const [aiModels, setAiModels] = useState(null);
  const [aiForm, setAiForm] = useState({});
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [healthHistory, setHealthHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [callRoom, setCallRoom] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [allDoctors, setAllDoctors] = useState([]);
  const [loadingAllDocs, setLoadingAllDocs] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [docSpecFilter, setDocSpecFilter] = useState("All");
  const [docMapView, setDocMapView] = useState(false);

  const isAdmin = user?.email === "admin@pulserate.com";
  const isDoctor = user?.email?.endsWith("@pulserate.doc");

  // Hero typing animation
  const typedText = useTyping([
    "Book Appointments",
    "Find Nearby Hospitals",
    "Compare Treatment Costs",
    "Get AI Health Predictions",
  ], 70, 35, 2200);

  // Startup loader
  useEffect(() => {
    const t = setTimeout(() => setAppReady(true), 2200);
    return () => clearTimeout(t);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  // Fetch hospitals on mount
  useEffect(() => { fetchHospitals("New Delhi"); // eslint-disable-next-line
  }, []);

  const fetchHospitals = async (city = "New Delhi") => {
    setLoadingHospitals(true); setApiError(null);
    try {
      const res = await fetch(`${API_URL}/hospitals?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (data.success && data.hospitals.length > 0) {
        setHospitals(data.hospitals.map((h, i) => ({
          ...h, color: COLORS[i % COLORS.length], image: "🏥",
          doctors: [{ id: i * 10 + 1, name: "Dr. Available Doctor", spec: "General Medicine", exp: 10, fee: 500, available: "Today", rating: 4.5, img: "👨‍⚕️" }],
          reviewsList: [],
        })));
      } else { setApiError("No hospitals found for this city."); }
    } catch { setApiError("Could not connect to backend."); }
    setLoadingHospitals(false);
  };

  const fetchDoctors = async (hospitalId) => {
    try { const res = await fetch(`${API_URL}/doctors?hospitalId=${hospitalId}`); const data = await res.json(); if (data.success) return data.doctors; } catch { }
    return null;
  };

  const fetchMyAppointments = useCallback(async () => {
    if (!user?.email) return; setLoadingAppts(true);
    try { const res = await fetch(`${API_URL}/appointments/${encodeURIComponent(user.email)}`); const data = await res.json(); if (data.success) setMyAppointments(data.appointments); } catch { }
    setLoadingAppts(false);
  }, [user]);

  const fetchReviews = async (hospitalId) => {
    setLoadingReviews(true);
    try { const res = await fetch(`${API_URL}/reviews/${hospitalId}`); const data = await res.json(); if (data.success) setHospitalReviews(data.reviews); } catch { }
    setLoadingReviews(false);
  };

  const submitReview = async (hospitalId) => {
    if (!reviewText) return;
    try {
      await fetch(`${API_URL}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hospitalId, hospitalName: selectedHospital?.name, userName: user?.displayName || "Anonymous", userEmail: user?.email || "", rating: reviewRating, text: reviewText }) });
      notifShow("Review submitted!"); setReviewText(""); setReviewRating(5); fetchReviews(hospitalId);
    } catch { notifShow("Review saved locally!"); setReviewText(""); setReviewRating(5); }
  };

  const filtered = hospitals.filter(h => {
    const q = search.toLowerCase();
    const ms = !q || h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q) || h.specialities.some(s => s.toLowerCase().includes(q));
    return ms && (specFilter === "All" || h.specialities.some(s => s === specFilter));
  }).sort((a, b) => sortBy === "rating" ? b.rating - a.rating : b.reviews - a.reviews);

  const fetchAllDoctors = async () => {
    setLoadingAllDocs(true);
    try {
      const res = await fetch(`${API_URL}/doctors?spec=${docSpecFilter === "All" ? "" : docSpecFilter}&q=${docSearch}`);
      const data = await res.json();
      if (data.success) {
        setAllDoctors(data.doctors.map(d => {
          const hosp = hospitals.find(h => h.id === Math.floor(d.id / 1000)) || hospitals[0] || { lat: 28.6139, lng: 77.209, name: "Hospital" };
          return { ...d, lat: hosp.lat, lng: hosp.lng, hospitalName: hosp.name };
        }));
      }
    } catch { }
    setLoadingAllDocs(false);
  };

  const go = async (v, h = null) => {
    setView(v);
    if (h) { const docs = await fetchDoctors(h.id); if (docs) h = { ...h, doctors: docs }; setSelectedHospital(h); }
    if (v === "detail" && h) fetchReviews(h.id);
    if (v === "appointments") fetchMyAppointments();
    if (v === "doctors") fetchAllDoctors();
  };

  const notifShow = (m) => { setNotif(m); setTimeout(() => setNotif(null), 3000); };
  const toggleTest = (t) => setSelectedTests(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const bookSpecialist = (disease) => {
    if (!user) { setShowAuth(true); return; }
    const map = { heart: "Cardiology", cancer: "Oncology", diabetes: "General Medicine" };
    setDocSpecFilter(map[disease] || "General Medicine"); go("doctors"); notifShow(`AI Recommendation: Consult a ${map[disease]} specialist.`);
  };

  const handleLogout = async () => { await signOut(auth); notifShow("Logged out!"); };

  const ML_API = `${API_URL}/ml`;

  const fetchAiModels = async () => {
    if (aiModels) return; setAiModelsLoading(true);
    try { const res = await fetch(`${ML_API}/models`); const data = await res.json(); if (data.success) setAiModels(data.models); }
    catch { notifShow("ML server not reachable."); }
    setAiModelsLoading(false);
  };

  const runPrediction = async () => {
    if (!aiDisease) return; setAiLoading(true); setAiResult(null);
    try {
      const res = await fetch(`${ML_API}/predict/${aiDisease}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aiForm) });
      const data = await res.json();
      if (data.success) {
        setAiResult(data);
        if (user) {
          try { await addDoc(collection(db, "predictions"), { userId: user.uid, email: user.email, disease: aiDisease, result: { label: data.label, probability: data.probability, confidence: data.confidence, risk_level: data.risk_level, model_used: data.model_used, recommendation: data.recommendation }, inputData: aiForm, timestamp: serverTimestamp() }); } catch { }
        }
      } else notifShow(data.error || "Prediction failed");
    } catch { notifShow("Could not reach ML server."); }
    setAiLoading(false);
  };

  const fetchHealthHistory = async () => {
    if (!user) return; setLoadingHistory(true);
    try {
      const q2 = query(collection(db, "predictions"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
      const snap = await getDocs(q2);
      setHealthHistory(snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() || new Date() })));
    } catch { }
    setLoadingHistory(false);
  };

  const fetchAdminStats = async () => {
    setLoadingAdmin(true);
    try { const res = await fetch(`${API_URL}/admin/stats`); const data = await res.json(); if (data.success) setAdminStats(data.stats); } catch { notifShow("Could not load admin stats."); }
    setLoadingAdmin(false);
  };

  const downloadPDF = async (elementId, filename) => {
    const el = document.getElementById(elementId); if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const w = pdf.internal.pageSize.getWidth();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, (canvas.height * w) / canvas.width);
      pdf.save(filename); notifShow("PDF downloaded!");
    } catch { notifShow("Failed to generate PDF."); }
  };

  const cancelAppointment = async (id) => {
    try { await fetch(`${API_URL}/appointments/${id}`, { method: "DELETE" }); notifShow("Appointment cancelled."); fetchMyAppointments(); }
    catch { notifShow("Could not cancel."); }
  };

  /* ── RENDER ── */
  if (authLoading) return <LoaderScreen visible={true} />;
  if (showAuth) return <AuthPage onSuccess={() => setShowAuth(false)} />;

  return (
    <>
      <LoaderScreen visible={!appReady} />
      <div className="app-root" style={{ opacity: appReady ? 1 : 0, transition: "opacity 0.5s ease" }}>

        {notif && <div className="toast">✓ {notif}</div>}

        <div className={`sms-push ${smsPush ? "show" : "hide"}`}>
          <div className="sms-ico">💬</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Messages</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>now</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}><strong style={{ color: "var(--primary)" }}>PulseRATE:</strong> Appointment confirmed!</div>
          </div>
        </div>

        {bookingDoctor && selectedHospital && <BookingModal doctor={bookingDoctor} hospital={selectedHospital} user={user} onClose={() => setBookingDoctor(null)} onBooked={() => { fetchMyAppointments(); setSmsPush(true); setTimeout(() => setSmsPush(false), 5000); }} />}

        {/* ═══ NAVBAR ═══ */}
        <nav className="navbar">
          <div className="navbar-inner">
            <div className="nav-brand" onClick={() => go("home")}>
              <img src="/pulserate-logo.png?v=2" alt="PulseRATE" />
              <div className="nav-brand-text">Pulse<span className="rate">RATE</span></div>
            </div>
            <div className="nav-spacer" />
            {[
              ["🏥", "Hospitals", "list"],
              ["👨‍⚕️", "Doctors", "doctors"],
              ["🧪", "Compare", "compare"],
              ["🗺️", "Map", "map"],
              ["🤖", "AI Checkup", "ai-checkup"],
              ...(user && !isDoctor ? [["📊", "My Health", "health-history"]] : []),
              ...(isDoctor ? [["👨‍⚕️", "Dashboard", "doctor-dash"]] : []),
              ["🚨", "SOS", "emergency"],
              ["💡", "Tips", "tips"],
              ...(user ? [["📋", "Appts", "appointments"]] : []),
              ...(isAdmin ? [["🛡️", "Admin", "admin"]] : []),
            ].map(([ico, label, v]) => (
              <span key={v} className={`nav-item ${view === v ? "active" : ""}`} onClick={() => { go(v); if (v === "ai-checkup") fetchAiModels(); if (v === "health-history") fetchHealthHistory(); if (v === "admin") fetchAdminStats(); if (v === "doctors") fetchAllDoctors(); }}>
                {ico} {label}
              </span>
            ))}
            <button className="theme-btn" onClick={() => setIsDark(d => !d)} title={isDark ? "Light Mode" : "Dark Mode"}>
              {isDark ? "☀️" : "🌙"}
            </button>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4 }}>
                <div className="user-chip">👤 {user.displayName || user.email}</div>
                <button className="btn-logout" onClick={handleLogout}>Logout</button>
              </div>
            ) : (
              <button className="btn-login" onClick={() => setShowAuth(true)}>Sign In</button>
            )}
          </div>
        </nav>

        <div className="main-content">

          {/* ═══ HOME ═══ */}
          {view === "home" && <div>
            <div className="hero">
              {user && <div className="welcome-badge">👋 Welcome back, {user.displayName || "User"}!</div>}
              <div className="hero-label">India's AI-Powered Healthcare Platform</div>
              <h1 className="hero-title">
                {typedText}<span className="typing-cursor" />
              </h1>
              <p className="hero-desc">Search real hospitals powered by Google Places. Book doctors, compare prices, and get AI health predictions — all in one platform.</p>

              <div className="search-row">
                <div className="search-wrap">
                  <span className="ico">📍</span>
                  <input value={cityInput} onChange={e => setCityInput(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchHospitals(cityInput)} placeholder="Enter city (e.g. Mumbai, Delhi)" className="search-field" />
                </div>
                <button onClick={() => fetchHospitals(cityInput)} disabled={loadingHospitals} className="hero-search-btn">
                  {loadingHospitals ? "Searching..." : "Search Hospitals"}
                </button>
              </div>

              <div className="search-row">
                <div className="search-wrap">
                  <span className="ico">🔍</span>
                  <input value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput); go("list"); } }} placeholder="Search hospital by name..." className="search-field" />
                </div>
                <button onClick={() => { setSearch(searchInput); go("list"); }} className="hero-search-btn" style={{ background: "#fff", color: "#1e293b" }}>Search</button>
              </div>

              <div className="city-pills">
                {["Mumbai", "Bangalore", "Chennai", "Hyderabad", "Pune"].map(c => (
                  <span key={c} className="city-pill" onClick={() => { setCityInput(c); fetchHospitals(c); }}>{c}</span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="stats-row">
              {[
                [hospitals.length || 20, "+", "Hospitals Found", "var(--primary)"],
                [120, "+", "Doctors Available", "var(--success)"],
                [6, "", "Tests to Compare", "var(--warning)"],
                ["24/7", "", "Emergency Support", "var(--danger)"],
              ].map(([v, suf, l, c], i) => (
                <div key={l} className="stat-card">
                  <div className="stat-val" style={{ color: c }}>
                    {typeof v === "number" ? <AnimCounter target={v} suffix={suf} /> : v}
                  </div>
                  <div className="stat-lbl">{l}</div>
                </div>
              ))}
            </div>

            {!user && <div className="signin-banner">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🔐 Sign in to Book Appointments</div>
                <div style={{ opacity: 0.85, fontSize: 14 }}>Create a free account to book doctors instantly</div>
              </div>
              <button onClick={() => setShowAuth(true)} className="btn btn-white btn-lg">Sign Up Free →</button>
            </div>}

            {loadingHospitals && <div className="empty" style={{ marginBottom: 20 }}><div className="empty-ico">🔍</div><div className="empty-title" style={{ color: "var(--primary)" }}>Fetching hospitals from Google...</div></div>}
            {apiError && <div className="err-box">⚠️ {apiError}</div>}

            {!loadingHospitals && hospitals.length > 0 && <>
              <div className="sec-header">
                <h2 className="sec-title">🏥 Hospitals — {cityInput}</h2>
                <span className="sec-link" onClick={() => go("list")}>View All {hospitals.length} →</span>
              </div>
              <div className="hosp-grid">
                {hospitals.slice(0, 4).map(h => (
                  <div key={h.id} className="card card-hover" onClick={() => go("detail", h)} style={{ cursor: "pointer" }}>
                    <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-light)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{h.name}</div>
                          <Badge color="blue">{h.type}</Badge>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--warning)" }}>{h.rating} ⭐</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{h.reviews.toLocaleString()} reviews</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "14px 20px" }}>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 5 }}>📍 {h.address}</div>
                      {h.phone && h.phone !== "N/A" && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>📞 {h.phone}</div>}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{h.specialities.slice(0, 3).map(sp => <Badge key={sp} color="gray">{sp}</Badge>)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>}

            <div className="sec-header"><h2 className="sec-title">🗺️ Hospitals on Map</h2></div>
            {hospitals.length > 0 && <RealMap hospitals={hospitals.slice(0, 10)} onSelect={h => go("detail", h)} />}
            <div style={{ textAlign: "center", marginTop: 14, marginBottom: 24 }}>
              <button onClick={() => go("map")} className="btn btn-primary btn-lg">Open Full Map →</button>
            </div>

            <div className="banner">
              <div><div className="banner-title">🩺 Browse 100+ Specialists</div><div className="banner-desc">Find and book top-rated doctors across all fields</div></div>
              <button onClick={() => go("doctors")} className="btn btn-primary">Find Doctors →</button>
            </div>
            <div className="banner">
              <div><div className="banner-title">💊 Compare Test Prices</div><div className="banner-desc">Find the most affordable tests across hospitals</div></div>
              <button onClick={() => go("compare")} className="btn btn-success">Compare Now →</button>
            </div>
          </div>}

          {/* ═══ LIST ═══ */}
          {view === "list" && <div>
            <div className="sec-header"><h2 className="sec-title">Hospitals in {cityInput} ({hospitals.length})</h2></div>
            <div className="filter-bar">
              <div className="filter-wrap"><span className="ico-sm">🔍</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hospitals..." className="f-input" /></div>
              <select value={specFilter} onChange={e => setSpecFilter(e.target.value)} className="f-select" style={{ maxWidth: 180 }}>{SPECIALITIES.map(sp => <option key={sp}>{sp}</option>)}</select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="f-select" style={{ maxWidth: 180 }}><option value="rating">Sort: Best Rated</option><option value="reviews">Sort: Most Reviewed</option></select>
            </div>
            {loadingHospitals && <div className="empty"><div className="empty-ico">🔍</div><div className="empty-title" style={{ color: "var(--primary)" }}>Loading hospitals...</div></div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filtered.map(h => (
                <div key={h.id} className="card card-hover" onClick={() => go("detail", h)} style={{ cursor: "pointer" }}>
                  <div style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "start" }}>
                    <div style={{ width: 50, height: 50, borderRadius: 12, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🏥</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{h.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 5 }}>📍 {h.address}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Badge color="blue">{h.type}</Badge>
                            {h.openNow && <Badge color="green">Open Now</Badge>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginBottom: 4 }}><Stars rating={h.rating} size={14} /><span style={{ fontWeight: 700, fontSize: 15 }}>{h.rating}</span></div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{h.reviews.toLocaleString()} reviews</div>
                          <button onClick={e => { e.stopPropagation(); go("detail", h); }} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>View & Book</button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 5, flexWrap: "wrap" }}>{h.specialities.map(sp => <Badge key={sp} color="gray">{sp}</Badge>)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!loadingHospitals && filtered.length === 0 && <div className="empty"><div className="empty-ico">🔍</div><div className="empty-title">No hospitals found</div></div>}
            </div>
          </div>}

          {/* ═══ DETAIL ═══ */}
          {view === "detail" && selectedHospital && <div>
            <button onClick={() => go("list")} className="btn btn-ghost" style={{ marginBottom: 16 }}>← Back to list</button>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, var(--primary), #1e40af)", color: "#fff", marginBottom: 20 }}>
              <div className="bg-ico">🏥</div>
              <div style={{ display: "flex", gap: 18, alignItems: "start", position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 48 }}>🏥</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{selectedHospital.name}</div>
                  <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 6 }}>📍 {selectedHospital.address}</div>
                  {selectedHospital.phone && selectedHospital.phone !== "N/A" && <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 10 }}>📞 {selectedHospital.phone}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[selectedHospital.type, selectedHospital.openNow ? "🟢 Open" : "🔴 Closed", "⏰ " + selectedHospital.timings].map(t => (
                      <span key={t} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 32, fontWeight: 900 }}>{selectedHospital.rating}</div>
                  <Stars rating={selectedHospital.rating} size={16} />
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>{selectedHospital.reviews.toLocaleString()} reviews</div>
                </div>
              </div>
            </div>

            <div className="tabs">
              {["doctors", "tests", "reviews", "location"].map(tab => (
                <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {tab === "doctors" ? "👨‍⚕️ Doctors" : tab === "tests" ? "🧪 Tests" : tab === "reviews" ? "⭐ Reviews" : "📍 Location"}
                </button>
              ))}
            </div>

            {activeTab === "doctors" && <div>
              {selectedHospital.doctors.map(doc => (
                <div key={doc.id} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ padding: "16px 20px", display: "flex", gap: 14, alignItems: "center" }}>
                    <div className="doc-av">👨‍⚕️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{doc.name}</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 5 }}><Badge color="blue">{doc.spec}</Badge><Badge color="orange">Available: {doc.available}</Badge></div>
                      <Stars rating={doc.rating} />
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)", marginBottom: 4 }}>₹{doc.fee}</div>
                      <button onClick={() => { if (!user) { setShowAuth(true); return; } setBookingDoctor(doc); }} className="btn btn-primary btn-sm">{user ? "Book Now" : "🔐 Login"}</button>
                    </div>
                  </div>
                </div>
              ))}
              {!user && <div style={{ background: "var(--warning-light)", borderRadius: "var(--radius-md)", padding: "14px 18px", textAlign: "center", marginTop: 10 }}>
                <div style={{ fontSize: 14, color: "var(--warning)", marginBottom: 8 }}>🔐 Login to book appointments</div>
                <button onClick={() => setShowAuth(true)} className="btn btn-primary btn-sm">Login / Sign Up</button>
              </div>}
            </div>}

            {activeTab === "tests" && <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ background: "var(--bg-surface)", padding: "12px 20px", fontWeight: 700, fontSize: 14, borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <span>Test Name</span><span style={{ textAlign: "right" }}>Price (₹)</span>
              </div>
              {selectedHospital.tests.map((t, i) => (
                <div key={t.name} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "12px 20px", borderBottom: i < selectedHospital.tests.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                  <span style={{ fontWeight: 600 }}>🧪 {t.name}</span>
                  <span style={{ textAlign: "right", fontWeight: 800, color: "var(--success)", fontSize: 15 }}>₹{t.price}</span>
                </div>
              ))}
            </div>}

            {activeTab === "reviews" && <div>
              <div className="card" style={{ padding: 18, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Write a Review</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(s => <span key={s} onClick={() => setReviewRating(s)} style={{ fontSize: 24, cursor: "pointer", color: s <= reviewRating ? "#f59e0b" : "#d1d5db" }}>★</span>)}
                </div>
                <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Share your experience..." className="form-input" style={{ minHeight: 70, resize: "vertical", marginBottom: 10 }} />
                <button onClick={() => submitReview(selectedHospital.id)} className="btn btn-primary btn-sm">Submit Review</button>
              </div>
              {loadingReviews && <div style={{ textAlign: "center", padding: 18, color: "var(--text-muted)" }}>Loading reviews...</div>}
              {hospitalReviews.length > 0 ? hospitalReviews.map(r => (
                <div key={r.id} className="card" style={{ padding: "14px 18px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>👤 {r.userName}</div>
                    <div><Stars rating={r.rating} size={13} /> <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 3 }}>{r.rating}/5</span></div>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{r.text}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
              )) : (!loadingReviews && <div className="empty" style={{ padding: 24 }}><div style={{ color: "var(--text-muted)" }}>No reviews yet.</div></div>)}
            </div>}

            {activeTab === "location" && <div>
              <RealMap hospitals={[selectedHospital]} onSelect={() => { }} />
              <div className="card" style={{ padding: "14px 18px", marginTop: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>📍 {selectedHospital.name}</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>{selectedHospital.address}</div>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHospital.lat},${selectedHospital.lng}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: "block", textAlign: "center" }}>🗺️ Get Directions</a>
              </div>
            </div>}
          </div>}

          {/* ═══ COMPARE ═══ */}
          {view === "compare" && <div>
            <h2 className="sec-title" style={{ marginBottom: 6 }}>🧪 Test Price Comparison</h2>
            <p style={{ margin: "0 0 20px", color: "var(--text-muted)" }}>Select tests to compare across hospitals</p>
            <div className="card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Select Tests</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ALL_TESTS.map(t => <button key={t} onClick={() => toggleTest(t)} className={`tpill ${selectedTests.includes(t) ? "on" : ""}`}>{selectedTests.includes(t) ? "✓ " : ""}{t}</button>)}
              </div>
            </div>
            {selectedTests.length > 0 && hospitals.length > 0 && <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="cmp-table">
                  <thead><tr><th>Test</th>{hospitals.slice(0, 5).map(h => <th key={h.id} style={{ textAlign: "center", minWidth: 120 }}>{h.name.split(" ").slice(0, 2).join(" ")}</th>)}</tr></thead>
                  <tbody>{selectedTests.map(test => {
                    const prices = hospitals.slice(0, 5).map(h => h.tests.find(t => t.name === test)?.price).filter(Boolean);
                    const mn = Math.min(...prices), mx = Math.max(...prices);
                    return <tr key={test}>
                      <td style={{ fontWeight: 700 }}>🧪 {test}</td>
                      {hospitals.slice(0, 5).map(h => { const td = h.tests.find(t => t.name === test); if (!td) return <td key={h.id} style={{ textAlign: "center", color: "var(--text-muted)" }}>—</td>; return <td key={h.id} style={{ textAlign: "center" }}><div className={`price ${td.price === mn ? "low" : td.price === mx ? "high" : ""}`}>₹{td.price}</div>{td.price === mn && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--success)" }}>✓ CHEAPEST</div>}</td>; })}
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <div style={{ padding: "12px 18px", background: "var(--bg-surface)", fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>Green</span> = Cheapest · <span style={{ color: "var(--danger)", fontWeight: 700 }}>Red</span> = Most Expensive
              </div>
            </div>}
          </div>}

          {/* ═══ MAP ═══ */}
          {view === "map" && <div>
            <h2 className="sec-title" style={{ marginBottom: 6 }}>🗺️ Hospital Map — {cityInput}</h2>
            <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>Click any marker for details</p>
            {hospitals.length > 0 && <RealMap hospitals={hospitals.slice(0, 15)} onSelect={h => go("detail", h)} />}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 16 }}>
              {hospitals.slice(0, 6).map(h => (
                <div key={h.id} className="card card-hover" onClick={() => go("detail", h)} style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏥</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{h.name}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>⭐ {h.rating} · {h.reviews.toLocaleString()}</div></div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="btn btn-outline btn-sm">Directions</a>
                </div>
              ))}
            </div>
          </div>}

          {/* ═══ APPOINTMENTS ═══ */}
          {view === "appointments" && <div>
            <h2 className="sec-title" style={{ marginBottom: 6 }}>📋 My Appointments</h2>
            <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>Track and manage your bookings</p>
            {loadingAppts && <div className="empty"><div className="empty-ico">📋</div><div className="empty-title" style={{ color: "var(--primary)" }}>Loading appointments...</div></div>}
            {!loadingAppts && myAppointments.length === 0 && <div className="empty"><div className="empty-ico">📅</div><div className="empty-title">No Appointments Yet</div><div className="empty-desc">Book your first appointment</div><button onClick={() => go("list")} className="btn btn-primary btn-lg">Find Hospitals →</button></div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {myAppointments.map(apt => (
                <div key={apt.id} className="appt-card">
                  <div className="appt-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>👨‍⚕️ {apt.doctorName}</div>
                        <div style={{ display: "flex", gap: 6 }}><Badge color="blue">{apt.doctorSpec}</Badge><Badge color={apt.status === "Confirmed" ? "green" : apt.status === "Cancelled" ? "red" : "orange"}>{apt.status}</Badge></div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--primary)" }}>₹{apt.fee}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Fee</div>
                      </div>
                    </div>
                    <div className="appt-grid">
                      {[["🏥 Hospital", apt.hospitalName], ["📅 Date", apt.date], ["🕐 Time", apt.time], ["👤 Patient", apt.patientName]].map(([k, v]) => (
                        <div key={k} className="appt-grid-item"><div className="k">{k}</div><div className="v">{v}</div></div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ID: {apt.id} · {new Date(apt.bookedAt).toLocaleDateString("en-IN")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {apt.status === "Confirmed" && <button onClick={() => setCallRoom(apt.id)} className="btn btn-outline btn-sm">📹 Call</button>}
                        {apt.status === "Confirmed" && <button onClick={() => cancelAppointment(apt.id)} className="btn btn-sm" style={{ background: "var(--danger-light)", color: "var(--danger)", border: "1px solid #fecaca" }}>Cancel</button>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* ═══ EMERGENCY ═══ */}
          {view === "emergency" && <div>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, #dc2626, #be185d)", color: "#fff", textAlign: "center" }}>
              <div className="bg-ico">🚨</div>
              <div style={{ fontSize: 48, marginBottom: 10, position: "relative", zIndex: 1, animation: "heartbeat 2s infinite" }}>🆘</div>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, position: "relative", zIndex: 1 }}>Emergency Services</h1>
              <p style={{ margin: 0, opacity: 0.85, fontSize: 14, position: "relative", zIndex: 1 }}>One tap to call. Stay calm, help is coming.</p>
            </div>
            <div className="emer-grid">
              {EMERGENCY_CONTACTS.map(ec => (
                <div key={ec.number} className="emer-card">
                  <div className="emer-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${ec.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{ec.icon}</div>
                      <div><div style={{ fontWeight: 700, fontSize: 15 }}>{ec.name}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ec.desc}</div></div>
                    </div>
                  </div>
                  <div className="emer-bot">
                    <div className="emer-num" style={{ color: ec.color }}>{ec.number}</div>
                    <a href={`tel:${ec.number}`} className="call-link" style={{ background: ec.color }}>📞 Call</a>
                  </div>
                </div>
              ))}
            </div>
            <div className="banner" style={{ marginTop: 20, justifyContent: "center", flexDirection: "column", textAlign: "center", gap: 10 }}>
              <div className="banner-title">🏥 Need a Hospital?</div>
              <button onClick={() => go("map")} className="btn btn-success btn-lg">Find Nearest Hospital →</button>
            </div>
          </div>}

          {/* ═══ TIPS ═══ */}
          {view === "tips" && <div>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, #059669, #0d9488)", color: "#fff" }}>
              <div className="bg-ico">💡</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.7, marginBottom: 12, position: "relative", zIndex: 1 }}>PULSERATE TIPS</div>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, position: "relative", zIndex: 1 }}>Health Tips & Awareness</h1>
              <p style={{ margin: 0, opacity: 0.85, fontSize: 14, maxWidth: 460, position: "relative", zIndex: 1 }}>Curated tips for a healthier, happier life.</p>
            </div>
            <div className="cat-pills">
              {["All", "Prevention", "Nutrition", "Mental Health", "First Aid", "Fitness", "Hygiene", "Sleep", "Hydration"].map(c => (
                <button key={c} onClick={() => setTipsFilter(c)} className={`cat-pill ${tipsFilter === c ? "on" : ""}`}>{c}</button>
              ))}
            </div>
            <div className="tips-grid">
              {HEALTH_TIPS.filter(t => tipsFilter === "All" || t.category === tipsFilter).map(tip => (
                <div key={tip.id} className="tip-card">
                  <div className="tip-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontSize: 24 }}>{tip.icon}</span><Badge color="gray">{tip.category}</Badge></div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{tip.title}</div>
                  </div>
                  <div className="tip-body">
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 10 }}>{tip.desc}</div>
                    <div className="tip-hl">💡 {tip.tip}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* ═══ AI CHECKUP ═══ */}
          {view === "ai-checkup" && <div>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5, #6366f1)", color: "#fff" }}>
              <div className="bg-ico">🧠</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.7, marginBottom: 12, position: "relative", zIndex: 1 }}>AI-POWERED SCREENING</div>
              <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800, position: "relative", zIndex: 1 }}>🤖 AI Health Checkup</h1>
              <p style={{ margin: "0 0 16px", opacity: 0.85, fontSize: 14, maxWidth: 500, position: "relative", zIndex: 1 }}>Instant AI predictions for Heart Disease, Cancer, and Diabetes using ML models trained on real data.</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                {[["3", "ML Models"], ["99%+", "Accuracy"], ["<1s", "Speed"], ["Free", "Always"]].map(([v, l]) => (
                  <div key={l} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 16px", textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{v}</div><div style={{ fontSize: 10, opacity: 0.7 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "var(--warning-light)", border: "1px solid #fde68a", borderRadius: "var(--radius-md)", padding: "12px 18px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div><div style={{ fontWeight: 700, fontSize: 13, color: "var(--warning)" }}>Disclaimer</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>AI screening only. Always consult a doctor.</div></div>
            </div>

            {aiModelsLoading && <div className="empty"><div className="empty-ico">🧠</div><div className="empty-title" style={{ color: "var(--primary)" }}>Loading AI Models...</div></div>}
            {!aiModelsLoading && !aiModels && <div className="empty"><div className="empty-ico">🔌</div><div className="empty-title">ML Server Not Connected</div><div className="empty-desc">Start: <code style={{ background: "var(--bg-surface)", padding: "3px 10px", borderRadius: 6, fontSize: 13, fontFamily: "var(--font-mono)" }}>cd healthconnect-ml && python app.py</code></div><button onClick={fetchAiModels} className="btn btn-primary">Retry 🔄</button></div>}

            {aiModels && <>
              {!aiDisease && <div>
                <h2 className="sec-title" style={{ marginBottom: 14 }}>Select a Health Check</h2>
                <div className="ai-grid">
                  {[["heart", "❤️", "Heart Disease", "Analyze 13 cardiac parameters", "#dc2626"], ["cancer", "🎗️", "Breast Cancer", "Evaluate 30 tumor measurements", "#be185d"], ["diabetes", "🩺", "Diabetes", "Assess 8 diagnostic measures", "#7c3aed"]].map(([key, ico, title, desc, color]) => (
                    <div key={key} className="ai-pick" onClick={() => { setAiDisease(key); setAiResult(null); setAiForm({}); }}>
                      <div className="ai-pick-top" style={{ background: `${color}08` }}>
                        <div className="ai-pick-emoji">{ico}</div>
                        <div className="ai-pick-name" style={{ color }}>{title}</div>
                      </div>
                      <div style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10 }}>{desc}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Badge color="gray">{aiModels[key]?.model_used}</Badge>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>AUC: {aiModels[key]?.test_auc}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>}

              {aiDisease && aiModels[aiDisease] && <>
                <button onClick={() => { setAiDisease(null); setAiResult(null); setAiForm({}); }} className="btn btn-ghost" style={{ marginBottom: 16 }}>← Back</button>
                <div style={{ display: "grid", gridTemplateColumns: aiResult ? "1fr 1fr" : "1fr", gap: 20 }}>
                  <div className="card" style={{ overflow: "hidden" }}>
                    <div style={{ background: aiDisease === "heart" ? "linear-gradient(135deg,#dc2626,#ea580c)" : aiDisease === "cancer" ? "linear-gradient(135deg,#be185d,#7c3aed)" : "linear-gradient(135deg,#7c3aed,#4f46e5)", padding: "16px 20px", color: "#fff" }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{aiModels[aiDisease].icon} {aiModels[aiDisease].name}</div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>Fill in values and click Predict</div>
                    </div>
                    <div style={{ padding: "18px 20px", maxHeight: "58vh", overflowY: "auto" }}>
                      <div style={{ display: "grid", gridTemplateColumns: aiModels[aiDisease].features.length > 10 ? "1fr 1fr" : "1fr", gap: 12 }}>
                        {aiModels[aiDisease].features.map(f => (
                          <div key={f.name}>
                            <label className="form-label">{f.label}</label>
                            {f.type === "select" ? (
                              <select value={aiForm[f.name] || ""} onChange={e => setAiForm(p => ({ ...p, [f.name]: parseFloat(e.target.value) }))} className="form-input" style={{ cursor: "pointer" }}>
                                <option value="">Select...</option>
                                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <input type="number" step={f.step || 1} min={f.min} max={f.max} value={aiForm[f.name] || ""} onChange={e => setAiForm(p => ({ ...p, [f.name]: parseFloat(e.target.value) || 0 }))} placeholder={f.placeholder || ""} className="form-input" />
                            )}
                            {f.hint && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{f.hint}</div>}
                          </div>
                        ))}
                      </div>
                      <button onClick={runPrediction} disabled={aiLoading} className="btn btn-lg btn-primary" style={{ width: "100%", marginTop: 18 }}>
                        {aiLoading ? "🧠 Analyzing..." : "🔬 Run AI Prediction"}
                      </button>
                    </div>
                  </div>

                  {aiResult && <div id="ai-report" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="card" style={{ overflow: "hidden" }}>
                      <div style={{ padding: "24px", textAlign: "center", color: "#fff", background: aiResult.risk_level === "HIGH" ? "linear-gradient(135deg,#dc2626,#be185d)" : aiResult.risk_level === "MODERATE" ? "linear-gradient(135deg,#d97706,#ea580c)" : "linear-gradient(135deg,#059669,#0d9488)" }}>
                        <div style={{ fontSize: 52, marginBottom: 6, animation: "heartbeat 2s infinite" }}>{aiResult.risk_level === "HIGH" ? "🔴" : aiResult.risk_level === "MODERATE" ? "🟡" : "🟢"}</div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{aiResult.label}</div>
                        <div style={{ fontSize: 14, opacity: 0.9 }}>{aiResult.risk_level} RISK</div>
                      </div>
                      <div style={{ padding: "18px 22px" }}>
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 5 }}><span>Probability</span><span>{(aiResult.probability * 100).toFixed(1)}%</span></div>
                          <div className="prob-track"><div className="prob-fill" style={{ width: `${aiResult.probability * 100}%`, background: aiResult.risk_level === "HIGH" ? "linear-gradient(90deg,#dc2626,#be185d)" : aiResult.risk_level === "MODERATE" ? "linear-gradient(90deg,#d97706,#ea580c)" : "linear-gradient(90deg,#059669,#0d9488)" }} /></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {[["Confidence", `${(aiResult.confidence * 100).toFixed(1)}%`], ["Model", aiResult.model_used]].map(([k, v]) => (
                            <div key={k} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", padding: "10px 12px", textAlign: "center", border: "1px solid var(--border-light)" }}>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 1 }}>{k}</div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="card" style={{ padding: "16px 20px" }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 Recommendation</div>
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>{aiResult.recommendation}</div>
                    </div>
                    <div style={{ background: "var(--danger-light)", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>⚠️ AI screening only. Consult a doctor.</div>
                    {(aiResult.risk_level === "HIGH" || aiResult.risk_level === "MODERATE") && <button onClick={() => bookSpecialist(aiDisease)} className="btn btn-primary btn-lg" style={{ width: "100%" }}>🏥 Book a Specialist</button>}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => { setAiResult(null); setAiForm({}); }} className="btn btn-outline" style={{ flex: 1 }}>🔄 New</button>
                      <button onClick={() => downloadPDF("ai-report", "PulseRATE_Report.pdf")} className="btn btn-success" style={{ flex: 1 }}>⬇️ PDF</button>
                    </div>
                  </div>}
                </div>
              </>}
            </>}
          </div>}

          {/* ═══ HEALTH HISTORY ═══ */}
          {view === "health-history" && <div>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, #059669, #0891b2)", color: "#fff" }}>
              <div className="bg-ico">📊</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.7, marginBottom: 12, position: "relative", zIndex: 1 }}>HEALTH ANALYTICS</div>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, position: "relative", zIndex: 1 }}>📊 My Health History</h1>
              <p style={{ margin: 0, opacity: 0.85, fontSize: 14, position: "relative", zIndex: 1 }}>Track your AI health screenings over time.</p>
            </div>
            {healthHistory.length > 0 && <div className="stats-row" style={{ marginBottom: 20 }}>
              {[["Total Tests", healthHistory.length, "🧪", "var(--primary)"], ["Heart", healthHistory.filter(h => h.disease === "heart").length, "❤️", "var(--danger)"], ["Cancer", healthHistory.filter(h => h.disease === "cancer").length, "🎗️", "#be185d"], ["Diabetes", healthHistory.filter(h => h.disease === "diabetes").length, "🩺", "#7c3aed"]].map(([l, v, i, c]) => (
                <div key={l} className="stat-card"><div style={{ fontSize: 24, marginBottom: 4 }}>{i}</div><div className="stat-val" style={{ color: c }}>{v}</div><div className="stat-lbl">{l}</div></div>
              ))}
            </div>}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={() => { go("ai-checkup"); fetchAiModels(); }} className="btn btn-primary">🤖 New Checkup</button>
              <button onClick={fetchHealthHistory} className="btn btn-outline">🔄 Refresh</button>
            </div>
            {loadingHistory && <div className="empty"><div className="empty-ico">⏳</div><div className="empty-title" style={{ color: "var(--primary)" }}>Loading...</div></div>}
            {!loadingHistory && healthHistory.length === 0 && <div className="empty"><div className="empty-ico">📋</div><div className="empty-title">No Records</div><div className="empty-desc">Run your first AI checkup to start tracking.</div><button onClick={() => { go("ai-checkup"); fetchAiModels(); }} className="btn btn-primary">Start Checkup</button></div>}
            {!loadingHistory && healthHistory.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {healthHistory.map((item, idx) => {
                const r = item.result || {};
                const dColors = { heart: "#dc2626", cancer: "#be185d", diabetes: "#7c3aed" };
                const dIcons = { heart: "❤️", cancer: "🎗️", diabetes: "🩺" };
                const dNames = { heart: "Heart Disease", cancer: "Breast Cancer", diabetes: "Diabetes" };
                const rColors = { HIGH: "#dc2626", MODERATE: "#d97706", LOW: "#059669" };
                const ds = item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown";
                return (
                  <div key={item.id || idx} className="tl-card" style={{ borderLeftColor: dColors[item.disease] || "var(--text-muted)" }}>
                    <div className="tl-body">
                      <div style={{ fontSize: 32 }}>{dIcons[item.disease] || "🔬"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{dNames[item.disease] || "Unknown"}</div>
                          <span className="badge" style={{ background: `${rColors[r.risk_level] || "#94a3b8"}15`, color: rColors[r.risk_level] || "#94a3b8" }}>{r.risk_level} RISK</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.label} — {(r.probability * 100).toFixed(1)}%</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>📅 {ds} · {r.model_used}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${rColors[r.risk_level] || "#94a3b8"}12`, border: `2px solid ${rColors[r.risk_level] || "#94a3b8"}30`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: rColors[r.risk_level] }}>
                          {(r.probability * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="tl-foot"><div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>💡 {r.recommendation}</div></div>
                  </div>
                );
              })}
            </div>}
          </div>}

          {/* ═══ DOCTOR DASHBOARD ═══ */}
          {view === "doctor-dash" && isDoctor && <div>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, #059669, #047857)", color: "#fff" }}>
              <div className="bg-ico">👨‍⚕️</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.7, marginBottom: 12, position: "relative", zIndex: 1 }}>SPECIALIST PORTAL</div>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, position: "relative", zIndex: 1 }}>Welcome back, Doctor</h1>
              <p style={{ margin: 0, opacity: 0.85, fontSize: 14, position: "relative", zIndex: 1 }}>Manage consultations and telemedicine calls.</p>
            </div>
            <div className="stats-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
              {[["Today", myAppointments.filter(a => a.date === "Today").length, "📅", "var(--success)"], ["Total", myAppointments.length, "📋", "var(--primary)"], ["Rating", "4.9/5", "⭐", "var(--warning)"]].map(([l, v, i, c]) => (
                <div key={l} className="stat-card"><div style={{ fontSize: 28, marginBottom: 6 }}>{i}</div><div className="stat-val" style={{ color: c }}>{v}</div><div className="stat-lbl">{l}</div></div>
              ))}
            </div>
            <h2 className="sec-title" style={{ marginBottom: 14 }}>Upcoming Consultations</h2>
            {myAppointments.length === 0 ? <div className="empty"><div className="empty-ico">📅</div><div className="empty-title">No appointments</div></div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {myAppointments.map(apt => (
                  <div key={apt.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <div className="doc-av">👤</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>Patient: {apt.patientName}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>🕒 {apt.time} · {apt.date} · Age: {apt.patientAge}</div>
                        <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, marginTop: 3 }}>Reason: {apt.reason}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setCallRoom(apt.id)} className="btn btn-success btn-sm">📹 Join Call</button>
                      <button onClick={() => { fetchHealthHistory(); go("health-history"); }} className="btn btn-outline btn-sm">📋 Records</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {/* ═══ ADMIN ═══ */}
          {view === "admin" && isAdmin && <div>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)", color: "#fff" }}>
              <div className="bg-ico">🛡️</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.7, marginBottom: 12, position: "relative", zIndex: 1 }}>ADMINISTRATION</div>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, position: "relative", zIndex: 1 }}>🛡️ Admin Dashboard</h1>
              <p style={{ margin: 0, opacity: 0.85, fontSize: 14, position: "relative", zIndex: 1 }}>Platform statistics and oversight.</p>
            </div>
            {loadingAdmin && <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>Loading...</div>}
            {!loadingAdmin && adminStats && <div>
              <div className="stats-row" style={{ marginBottom: 24 }}>
                {[["Appointments", adminStats.totalAppointments, "📋", "var(--primary)"], ["Confirmed", adminStats.confirmedAppointments, "✅", "var(--success)"], ["Cancelled", adminStats.cancelledAppointments, "❌", "var(--danger)"], ["Reviews", adminStats.totalReviews, "⭐", "var(--warning)"]].map(([l, v, i, c]) => (
                  <div key={l} className="stat-card"><div style={{ fontSize: 24, marginBottom: 6 }}>{i}</div><div className="stat-val" style={{ color: c }}>{v}</div><div className="stat-lbl">{l}</div></div>
                ))}
              </div>
              <h2 className="sec-title" style={{ marginBottom: 14 }}>Top Hospitals</h2>
              <div style={{ display: "flex", gap: 14 }}>
                {adminStats.topHospitals?.map((h, i) => (
                  <div key={i} className="card" style={{ padding: "14px 18px", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{h._id}</div>
                    <div style={{ color: "var(--success)", fontWeight: 700, marginTop: 3 }}>{h.count} Bookings</div>
                  </div>
                ))}
              </div>
            </div>}
          </div>}

          {/* ═══ DOCTORS ═══ */}
          {view === "doctors" && <div>
            <div className="sub-hero" style={{ background: "linear-gradient(135deg, #2563eb, #1e40af)", color: "#fff" }}>
              <div className="bg-ico">👨‍⚕️</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, opacity: 0.7, marginBottom: 12, position: "relative", zIndex: 1 }}>DOCTOR DISCOVERY</div>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, position: "relative", zIndex: 1 }}>Find Top Specialists</h1>
              <p style={{ margin: 0, opacity: 0.85, fontSize: 14, position: "relative", zIndex: 1 }}>100+ verified doctors across India's leading hospitals.</p>
            </div>
            <div className="filter-bar">
              <div className="filter-wrap"><span className="ico-sm">🔍</span><input value={docSearch} onChange={e => setDocSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchAllDoctors()} placeholder="Search doctors..." className="f-input" /></div>
              <select value={docSpecFilter} onChange={e => setDocSpecFilter(e.target.value)} className="f-select" style={{ maxWidth: 170 }}>{SPECIALITIES.map(sp => <option key={sp}>{sp}</option>)}</select>
              <button onClick={fetchAllDoctors} className="btn btn-primary btn-sm">Search</button>
              <div style={{ height: 24, width: 1, background: "var(--border)" }} />
              <button onClick={() => setDocMapView(!docMapView)} className={`btn btn-sm ${docMapView ? "btn-primary" : "btn-outline"}`}>{docMapView ? "📋 List" : "🗺️ Map"}</button>
            </div>
            {loadingAllDocs && <div className="empty"><div className="empty-ico">🔍</div><div className="empty-title" style={{ color: "var(--primary)" }}>Searching...</div></div>}
            {!loadingAllDocs && docMapView && (
              <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", height: 550 }}>
                <MapContainer center={[allDoctors[0]?.lat || 28.6139, allDoctors[0]?.lng || 77.209]} zoom={11} style={{ height: "100%", width: "100%" }}>
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  {allDoctors.map((d, i) => (
                    <Marker key={i} position={[d.lat, d.lng]}>
                      <Popup>
                        <div style={{ fontFamily: "var(--font-body)", minWidth: 180 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{d.name}</div>
                          <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 600, marginBottom: 4 }}>{d.spec}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>🏥 {d.hospitalName}</div>
                          <div style={{ fontSize: 13, marginBottom: 8 }}>⭐ {d.rating} · {d.exp} yrs</div>
                          <button onClick={() => { setBookingDoctor(d); setSelectedHospital({ id: Math.floor(d.id / 1000), name: d.hospitalName }); }} style={{ width: "100%", background: "#2563eb", color: "#fff", padding: "7px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" }}>Book</button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
            {!loadingAllDocs && !docMapView && (
              <div className="doc-grid">
                {allDoctors.map((d, i) => (
                  <div key={i} className="doc-card">
                    <div className="doc-av">{d.img}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 3 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{d.name}</div>
                        <div style={{ fontWeight: 800, color: "var(--success)" }}>₹{d.fee}</div>
                      </div>
                      <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: 13, marginBottom: 6 }}>{d.spec}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>🏥 {d.hospitalName}</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                        <span style={{ background: "var(--bg-surface)", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>🎓 {d.exp} yrs</span>
                        <span style={{ background: "var(--bg-surface)", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "var(--warning)", border: "1px solid var(--border-light)" }}>⭐ {d.rating}</span>
                      </div>
                      <button onClick={() => { setBookingDoctor(d); setSelectedHospital({ id: Math.floor(d.id / 1000), name: d.hospitalName, color: COLORS[i % COLORS.length] }); }} className="btn btn-primary" style={{ width: "100%" }}>Book Consultation</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loadingAllDocs && allDoctors.length === 0 && <div className="empty"><div className="empty-ico">🔬</div><div className="empty-title">No Doctors Found</div><div className="empty-desc">Try a different specialty.</div></div>}
          </div>}
        </div>

        {/* ═══ TELEMEDICINE ═══ */}
        {callRoom && <div className="vc-overlay">
          <div className="vc-box">
            <div className="vc-head">
              <div style={{ fontWeight: 700, fontSize: 15 }}>📹 Telemedicine: {callRoom}</div>
              <button onClick={() => setCallRoom(null)} className="btn btn-danger btn-sm">End Call</button>
            </div>
            <div style={{ flex: 1, background: "var(--bg-body)" }}>
              <iframe src={`https://meet.jit.si/HC_${callRoom}`} allow="camera; microphone; fullscreen" style={{ width: "100%", height: "100%", border: "none" }} title="Video Call" />
            </div>
          </div>
        </div>}

        {/* ═══ FOOTER ═══ */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-grid">
              <div>
                <div className="footer-brand">
                  <img src="/pulserate-logo.png?v=2" alt="PulseRATE" />
                  <div className="footer-brand-text">Pulse<span className="rate">RATE</span></div>
                </div>
                <div className="footer-desc">India's trusted AI-powered healthcare platform. Find, compare, and book the best care.</div>
              </div>
              <div>
                <div className="footer-title">Quick Links</div>
                {[["🏥 Hospitals", "list"], ["👨‍⚕️ Doctors", "doctors"], ["🧪 Compare", "compare"], ["🗺️ Map", "map"], ["💡 Tips", "tips"]].map(([l, v]) => (
                  <div key={v} className="footer-link" onClick={() => { go(v); if (v === "doctors") fetchAllDoctors(); }}>{l}</div>
                ))}
              </div>
              <div>
                <div className="footer-title">Emergency</div>
                {[["🚑 Ambulance", "102"], ["👮 Police", "100"], ["🚒 Fire", "101"], ["🆘 Universal", "112"]].map(([l, n]) => (
                  <div key={n} className="footer-link">{l}: <strong style={{ color: "var(--primary)" }}>{n}</strong></div>
                ))}
              </div>
              <div>
                <div className="footer-title">Contact</div>
                <div className="footer-desc">📧 support@pulserate.in<br />📍 New Delhi, India<br />🕐 24/7 Support</div>
              </div>
            </div>
            <div className="footer-bot">
              <div className="footer-copy">© 2026 PulseRATE. All rights reserved. Made with ❤️ in India.</div>
              <div className="footer-socials">
                {["Twitter", "LinkedIn", "GitHub", "Instagram"].map(s => <span key={s} className="footer-social">{s}</span>)}
              </div>
            </div>
          </div>
        </footer>

        <ChatbotWidget />
      </div>
    </>
  );
}
