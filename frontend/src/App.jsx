import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Home, Users, History as HistoryIcon, LogOut, ChevronRight, X, AlertCircle, CheckCircle2, AlertTriangle, Sparkles, ExternalLink, Phone, MapPin, Globe, ChevronDown
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Patients from './components/Patients';
import AddPatient from './components/AddPatient';
import History from './components/History';
import ANMDashboard from './components/ANMDashboard';
import VoiceTriageModal from './components/VoiceTriageModal';
import DoctorDashboard from './components/DoctorDashboard';
import HospitalsMap from './components/HospitalsMap';
import LandingSplash from './components/LandingSplash';
import { getNearbyHospitals, registerDynamicVillage, reverseGeocode } from './utils/hospitals';
import { useLanguage } from './context/LanguageContext';
import { formatDateTime } from './utils/dateUtils';
import './App.css';
import { API_BASE_URL } from './config';


// Pre-seeded Demo Data for Judge Evaluation
const SEED_TRIAGES = [
  {
    id: 'tr-seed-101',
    patientName: 'Ramesh Patel',
    patientAge: 45,
    gender: 'Male',
    village: 'Model Colony, Pune',
    ashaName: 'Sunita Devi',
    urgency: 'Red',
    symptoms: ['Chest pain radiating to left arm', 'High fever (102°F)', 'Shortness of breath'],
    vitalSigns: { bp: '145/95', pulse: '104 bpm', temp: '102.2 °F', spo2: '92%' },
    transcript: 'Patient experiencing heavy pressure in chest, sweating profusely and high fever since morning.',
    doctorVerificationStatus: 'pending',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    resolved: false
  },
  {
    id: 'tr-seed-102',
    patientName: 'Meena Sharma',
    patientAge: 28,
    gender: 'Female',
    village: 'Sector 4, Pune',
    ashaName: 'Sunita Devi',
    urgency: 'Yellow',
    symptoms: ['Persistent dry cough', 'Mild fever (100°F)', 'Body ache'],
    vitalSigns: { bp: '120/80', pulse: '82 bpm', temp: '100.1 °F', spo2: '97%' },
    transcript: 'Mild fever and dry cough for 2 days, no breathlessness, eating normally.',
    doctorVerificationStatus: 'pending',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    resolved: false
  },
  {
    id: 'tr-seed-103',
    patientName: 'Anil Kumar',
    patientAge: 62,
    gender: 'Male',
    village: 'Market Area, Pune',
    ashaName: 'Sunita Devi',
    urgency: 'Green',
    symptoms: ['Minor skin rash', 'Slight fatigue'],
    vitalSigns: { bp: '128/82', pulse: '76 bpm', temp: '98.6 °F', spo2: '98%' },
    transcript: 'Slight rash on left forearm after working in farm, general health good.',
    doctorVerificationStatus: 'verified',
    verifiedBy: 'Dr. Rajesh Sharma',
    doctorUrgency: 'Green',
    doctorMessage: 'Apply anti-allergic ointment twice daily. Keep area clean.',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    resolved: true
  }
];

const SEED_PATIENTS = [
  { id: 'pat-seed-1', name: 'Ramesh Patel', age: 45, gender: 'Male', phone: '9822011223', village: 'Model Colony, Pune', notes: 'Hypertension history' },
  { id: 'pat-seed-2', name: 'Meena Sharma', age: 28, gender: 'Female', phone: '9822011224', village: 'Sector 4, Pune', notes: 'Asthma history' },
  { id: 'pat-seed-3', name: 'Anil Kumar', age: 62, gender: 'Male', phone: '9822011225', village: 'Market Area, Pune', notes: 'Diabetic routine check' }
];

const DEMO_ACCOUNTS = [
  {
    id: 1001,
    name: 'Sunita Devi (ASHA Worker)',
    phone: '9876543210',
    password: 'asha123',
    role: 'ASHA Worker',
    location: 'Model Colony, Pune',
    coordinates: { latitude: 18.5283, longitude: 73.8342 }
  },
  {
    id: 1002,
    name: 'Dr. Rajesh Sharma (Medical Officer)',
    phone: '9876543211',
    password: 'doc123',
    role: 'Doctor',
    location: 'District Civil Hospital, Pune',
    coordinates: { latitude: 18.5300, longitude: 73.8380 }
  }
];

function App() {
  const { language, setLanguage, t } = useLanguage();
  const selectedLanguage = language;
  const setSelectedLanguage = setLanguage;

  // Site initial 2-second splash screen state
  const [showSplash, setShowSplash] = useState(true);

  // Authentication & User state
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('asha_user');
    return saved ? JSON.parse(saved) : null;
  });

  // User Real-time Geolocation Coordinates & Manual Lock State
  const [isLocationManual, setIsLocationManual] = useState(() => {
    return localStorage.getItem('asha_location_manual') === 'true';
  });

  const [userCoords, setUserCoords] = useState(() => {
    const saved = localStorage.getItem('asha_user_coords');
    if (saved) return JSON.parse(saved);
    const savedUser = localStorage.getItem('asha_user');
    return savedUser ? JSON.parse(savedUser).coordinates : null;
  });

  const [userLocationName, setUserLocationName] = useState(() => {
    const saved = localStorage.getItem('asha_user_location');
    if (saved) return saved;
    const savedUser = localStorage.getItem('asha_user');
    return savedUser ? JSON.parse(savedUser).location || 'Locating...' : 'Locating...';
  });

  // Registered ASHA/Doctor workers state
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    const saved = localStorage.getItem('asha_registered_users');
    return saved ? JSON.parse(saved) : DEMO_ACCOUNTS;
  });

  // Global UI State
  const [currentView, setCurrentView] = useState('home'); // home, patients, add-patient, history
  const [toast, setToast] = useState(null);

  // Data State with LocalStorage persistence (Seeded with sample data for judges)
  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem('asha_patients');
    if (saved && JSON.parse(saved).length > 0) return JSON.parse(saved);
    return SEED_PATIENTS;
  });

  const [triageHistory, setTriageHistory] = useState(() => {
    const saved = localStorage.getItem('asha_triage_history');
    if (saved && JSON.parse(saved).length > 0) return JSON.parse(saved);
    return SEED_TRIAGES;
  });

  // Search & Modal State
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null); // Detail modal for triage
  const [isTriageModalOpen, setIsTriageModalOpen] = useState(false);
  const [triagePatient, setTriagePatient] = useState(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('asha_patients', JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem('asha_triage_history', JSON.stringify(triageHistory));
  }, [triageHistory]);

  const lastGeocodedCoordsRef = useRef(null);

  // Request browser location permission & continuously geocode to human-readable area name
  useEffect(() => {
    let watchId = null;
    if (user) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (isLocationManualRef.current) {
              console.log("Real-time location watch update ignored (Manual override locked)");
              return;
            }
            const { latitude, longitude } = position.coords;
            setUserCoords({ latitude, longitude });
            console.log("Real-time location updated:", latitude, longitude);

            // Fetch human-readable village/city name when coordinates change significantly (~100m)
            const shiftThreshold = 0.001;
            const lastCoords = lastGeocodedCoordsRef.current;
            if (!lastCoords || 
                Math.abs(latitude - lastCoords.latitude) > shiftThreshold || 
                Math.abs(longitude - lastCoords.longitude) > shiftThreshold) {
              
              lastGeocodedCoordsRef.current = { latitude, longitude };
              reverseGeocode(latitude, longitude).then(areaName => {
                if (areaName) {
                  setUserLocationName(areaName);
                  // Register the resolved area name dynamically into ROAD_GRAPH
                  registerDynamicVillage(areaName, latitude, longitude);
                }
              });
            }
          },
          (error) => {
            console.warn("Real-time location watch error:", error);
            if (isLocationManualRef.current) return;
            if (user.coordinates) {
              setUserCoords(user.coordinates);
              setUserLocationName(user.location || 'Locked Location');
            }
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        );
      } else if (user.coordinates) {
        setUserCoords(user.coordinates);
        setUserLocationName(user.location || 'Locked Location');
      }
    } else {
      setUserCoords(null);
      setUserLocationName('Locating...');
      lastGeocodedCoordsRef.current = null;
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user]);

  // Restore dynamic villages on mount
  useEffect(() => {
    const savedVillages = JSON.parse(localStorage.getItem('asha_dynamic_villages') || '[]');
    savedVillages.forEach(v => {
      registerDynamicVillage(v.name, v.lat, v.lng);
    });
  }, []);

  const isLocationManualRef = useRef(isLocationManual);
  useEffect(() => {
    isLocationManualRef.current = isLocationManual;
  }, [isLocationManual]);

  const updateLocation = (coords, name, manual = false) => {
    if (coords) {
      setUserCoords(coords);
      localStorage.setItem('asha_user_coords', JSON.stringify(coords));
    }
    if (name) {
      setUserLocationName(name);
      localStorage.setItem('asha_user_location', name);
    }
    if (manual) {
      setIsLocationManual(true);
      localStorage.setItem('asha_location_manual', 'true');
    }
  };

  const resetToAutoGps = () => {
    setIsLocationManual(false);
    localStorage.removeItem('asha_location_manual');
    localStorage.removeItem('asha_user_coords');
    localStorage.removeItem('asha_user_location');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ latitude, longitude });
          reverseGeocode(latitude, longitude).then(name => {
            if (name) setUserLocationName(name);
          });
        },
        (error) => {
          console.warn("Reset GPS failed, falling back to profile location:", error);
          if (user?.coordinates) {
            setUserCoords(user.coordinates);
            setUserLocationName(user.location || 'Locked Location');
          }
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleRegister = async (newUserData) => {
    setError(null);
    setLoading(true);

    const cleanPhone = newUserData.phone ? newUserData.phone.trim().replace(/[\s-]/g, '') : '';
    const cleanPass = newUserData.password ? newUserData.password.trim() : '';
    const cleanedData = { ...newUserData, phone: cleanPhone, password: cleanPass };

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      });

      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn('Server non-JSON registration response:', response.status, text);
        data = { error: `Server response error (${response.status})` };
      }

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Preserve password in cached user profile for offline login fallback
      const registeredUser = {
        ...cleanedData,
        ...(data.user || {}),
        password: cleanPass
      };

      if (registeredUser.coordinates) {
        registerDynamicVillage(registeredUser.location, registeredUser.coordinates.latitude, registeredUser.coordinates.longitude);
        updateLocation(registeredUser.coordinates, registeredUser.location, true);
      }

      setRegisteredUsers(prev => {
        const filtered = prev.filter(u => u.phone !== registeredUser.phone);
        const updated = [registeredUser, ...filtered];
        localStorage.setItem('asha_registered_users', JSON.stringify(updated));
        return updated;
      });

      setUser(registeredUser);
      localStorage.setItem('token', data.token || ('offline-token-' + (registeredUser.id || Date.now())));
      localStorage.setItem('asha_user', JSON.stringify(registeredUser));
      showToast(data.message || 'Account registered successfully!');
    } catch (err) {
      // If server explicitly rejected due to invalid input, display error
      if (err.message && (err.message.includes('different password') || err.message.includes('valid') || err.message.includes('required'))) {
        setError(err.message);
        throw err;
      }

      // Offline / local fallback or local re-registration check
      const existingLocalUser = registeredUsers.find(u => u.phone === cleanPhone);
      if (existingLocalUser) {
        if (!existingLocalUser.password || existingLocalUser.password === cleanPass) {
          const updatedUser = { ...existingLocalUser, password: cleanPass };
          setUser(updatedUser);
          localStorage.setItem('token', 'offline-token-' + (updatedUser.id || updatedUser._id || Date.now()));
          localStorage.setItem('asha_user', JSON.stringify(updatedUser));
          if (updatedUser.coordinates) {
            registerDynamicVillage(updatedUser.location, updatedUser.coordinates.latitude, updatedUser.coordinates.longitude);
            updateLocation(updatedUser.coordinates, updatedUser.location, true);
          }
          showToast('Account already registered — Logged in successfully!');
          return;
        } else {
          const errMsg = 'A user with this phone number is already registered with a different password.';
          setError(errMsg);
          throw new Error(errMsg);
        }
      }

      const newUser = {
        id: Date.now(),
        ...cleanedData,
        password: cleanPass
      };

      if (newUser.coordinates) {
        registerDynamicVillage(newUser.location, newUser.coordinates.latitude, newUser.coordinates.longitude);
        updateLocation(newUser.coordinates, newUser.location, true);
      }

      setRegisteredUsers(prev => {
        const updated = [newUser, ...prev];
        localStorage.setItem('asha_registered_users', JSON.stringify(updated));
        return updated;
      });

      setUser(newUser);
      localStorage.setItem('token', 'offline-token-' + newUser.id);
      localStorage.setItem('asha_user', JSON.stringify(newUser));
      showToast('Account created successfully!');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async (e, overridePhone = null, overridePass = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetPhone = overridePhone || phone;
    const targetPass = overridePass || password;

    const cleanPhone = targetPhone ? targetPhone.trim().replace(/[\s-]/g, '') : '';
    const cleanPass = targetPass ? targetPass.trim() : '';

    if (!cleanPhone || !cleanPass) {
      setError('Please enter both phone number and password');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9');
      return;
    }

    setLoading(true);
    setError(null);

    // First check DEMO_ACCOUNTS for instant offline demo login
    const demoMatch = DEMO_ACCOUNTS.find(d => d.phone === cleanPhone && d.password === cleanPass);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: cleanPhone, password: cleanPass }),
      });

      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn('Server non-JSON login response:', response.status, text);
        data = { error: `Server connection error (${response.status})` };
      }

      if (!response.ok) {
        // Fallback to demoMatch or local registeredUsers if server returns error
        const foundLocal = demoMatch || registeredUsers.find(u => u.phone === cleanPhone);
        if (foundLocal) {
          if (!foundLocal.password || foundLocal.password === cleanPass) {
            const updatedUser = { ...foundLocal, password: cleanPass };
            setUser(updatedUser);
            localStorage.setItem('token', 'offline-token-' + (updatedUser.id || updatedUser._id || Date.now()));
            localStorage.setItem('asha_user', JSON.stringify(updatedUser));
            if (updatedUser.coordinates) {
              registerDynamicVillage(updatedUser.location, updatedUser.coordinates.latitude, updatedUser.coordinates.longitude);
              updateLocation(updatedUser.coordinates, updatedUser.location, true);
            }
            showToast(`Welcome! Logged in as ${updatedUser.name}`);
            return;
          } else {
            throw new Error('Incorrect password for this mobile number.');
          }
        }
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      const loggedInUser = {
        ...data.user,
        password: cleanPass
      };

      setUser(loggedInUser);
      localStorage.setItem('token', data.token);
      localStorage.setItem('asha_user', JSON.stringify(loggedInUser));

      setRegisteredUsers(prev => {
        const filtered = prev.filter(u => u.phone !== loggedInUser.phone);
        const updated = [loggedInUser, ...filtered];
        localStorage.setItem('asha_registered_users', JSON.stringify(updated));
        return updated;
      });

      if (loggedInUser.coordinates) {
        registerDynamicVillage(loggedInUser.location, loggedInUser.coordinates.latitude, loggedInUser.coordinates.longitude);
        updateLocation(loggedInUser.coordinates, loggedInUser.location, true);
      }
      showToast(`Welcome back, ${loggedInUser.name}!`);
    } catch (err) {
      // Check locally registered users or demoMatch if server call threw an exception
      const foundUser = demoMatch || registeredUsers.find(u => u.phone === cleanPhone);
      if (foundUser) {
        if (!foundUser.password || foundUser.password === cleanPass) {
          const updatedUser = { ...foundUser, password: cleanPass };
          setUser(updatedUser);
          localStorage.setItem('token', 'offline-token-' + (updatedUser.id || updatedUser._id || Date.now()));
          localStorage.setItem('asha_user', JSON.stringify(updatedUser));
          if (updatedUser.coordinates) {
            registerDynamicVillage(updatedUser.location, updatedUser.coordinates.latitude, updatedUser.coordinates.longitude);
            updateLocation(updatedUser.coordinates, updatedUser.location, true);
          }
          showToast(`Welcome! Logged in as ${updatedUser.name}`);
          return;
        } else {
          setError('Incorrect password for this mobile number.');
          return;
        }
      }
      setError(err.message || 'This mobile number is not registered. Please register first.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginSuccess = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('asha_user', JSON.stringify(userData));

    setRegisteredUsers(prev => {
      const filtered = prev.filter(u => u.phone !== userData.phone && u.googleId !== userData.googleId);
      const updated = [userData, ...filtered];
      localStorage.setItem('asha_registered_users', JSON.stringify(updated));
      return updated;
    });

    if (userData.coordinates) {
      registerDynamicVillage(userData.location, userData.coordinates.latitude, userData.coordinates.longitude);
      updateLocation(userData.coordinates, userData.location, true);
    }
    showToast('Logged in successfully via Google!');
  };

  const handleLogout = () => {
    setUser(null);
    setPhone('');
    setPassword('');
    localStorage.removeItem('token');
    localStorage.removeItem('asha_user');
    showToast('Signed out successfully.');
  };

  // Fetch Patients & Triage History directly from MongoDB Atlas Backend on User Login
  useEffect(() => {
    if (user) {
      // Fetch Patients from MongoDB
      fetch(`${API_BASE_URL}/api/patients`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (Array.isArray(data)) {
            setPatients(data);
          }
        })
        .catch(err => console.warn('Could not fetch patients from MongoDB backend, using local cache:', err));

      // Fetch Triage History from MongoDB
      fetch(`${API_BASE_URL}/api/triage`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (Array.isArray(data)) {
            setTriageHistory(data);
          }
        })
        .catch(err => console.warn('Could not fetch triage history from MongoDB backend, using local cache:', err));
    }
  }, [user]);

  const handleAddPatient = async (patientData, andStartTriage) => {
    let createdPatient = null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patientData,
          createdBy: user?.id
        })
      });
      if (response.ok) {
        createdPatient = await response.json();
      }
    } catch (err) {
      console.warn('Backend patient save offline fallback:', err);
    }

    if (!createdPatient) {
      createdPatient = {
        id: Date.now().toString(),
        ...patientData,
        village: patientData.village || userLocationName || 'Active Sector',
        phone: patientData.phone || 'Not provided'
      };
    }

    setPatients(prev => [createdPatient, ...prev]);
    showToast('Patient registered successfully!');

    if (andStartTriage) {
      setTriagePatient(createdPatient);
      setIsTriageModalOpen(true);
    } else {
      setCurrentView('patients');
    }
  };

  const handleSaveTriage = async (triageData) => {
    const payload = {
      ashaName: user.name,
      resolved: false,
      ...triageData
    };

    let newTriageRecord = null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        newTriageRecord = await response.json();
      }
    } catch (err) {
      console.warn('Backend triage save offline fallback:', err);
    }

    if (!newTriageRecord) {
      newTriageRecord = {
        id: Date.now().toString(),
        ...payload
      };
    }

    setTriageHistory(prev => [newTriageRecord, ...prev]);
    showToast('Triage assessment compiled and saved!');
    setCurrentView('history');
  };

  const handleResolveTriage = (triageId) => {
    setTriageHistory(prev => prev.map(t => (t.id === triageId || t._id === triageId) ? { ...t, resolved: true } : t));
    showToast('Critical triage alert acknowledged & resolved.');
  };

  const handleVerifyTriage = async (triageId, verificationData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/triage/${triageId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationData)
      });
      if (response.ok) {
        const updated = await response.json();
        setTriageHistory(prev => prev.map(t => (t.id === triageId || t._id === triageId) ? updated : t));
        showToast('Triage verified and message sent to ASHA Worker!');
        return;
      }
    } catch (err) {
      console.warn('Backend verification call failed, updating local state:', err);
    }

    setTriageHistory(prev => prev.map(t => {
      if (t.id === triageId || t._id === triageId) {
        return {
          ...t,
          doctorVerificationStatus: 'verified',
          verifiedBy: verificationData.verifiedBy,
          verifiedAt: new Date().toISOString(),
          doctorUrgency: verificationData.doctorUrgency || t.urgency,
          doctorSymptoms: verificationData.doctorSymptoms || t.symptoms,
          doctorMessage: verificationData.doctorMessage
        };
      }
      return t;
    }));
    showToast('Triage verified and message sent to ASHA Worker!');
  };

  // Role Checks & Stats Counters (2 Roles: ASHA Worker vs Doctor)
  const isASHA = user?.role === 'ASHA Worker' || user?.role === 'ASHA';
  const isDoctor = !isASHA;

  const displayHistory = isASHA 
    ? triageHistory.filter(t => t.ashaName === user.name) 
    : triageHistory;

  const triagesTodayCount = displayHistory.length;
  const redAlertsCount = displayHistory.filter(t => t.urgency === 'Red' && !t.resolved).length;
  const totalTriagesCount = displayHistory.length;

  if (!user) {
    return (
      <>
        {showSplash && <LandingSplash onComplete={() => setShowSplash(false)} />}
        <Login 
          phone={phone}
          setPhone={setPhone}
          password={password}
          setPassword={setPassword}
          loading={loading}
          error={error}
          handleLogin={handleLogin}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          handleRegister={handleRegister}
          handleGoogleLoginSuccess={handleGoogleLoginSuccess}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FDFBF7] dotted-bg font-sans text-slate-800">
      {showSplash && <LandingSplash onComplete={() => setShowSplash(false)} />}
      
      {/* Toast Alert Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 transform translate-y-0 ${
          toast.type === 'error' 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Responsive Sidebar for desktop layout */}
      <aside className="hidden md:flex md:w-64 bg-[#0A2540] text-white flex-col justify-between shrink-0 h-screen sticky top-0 p-5 z-20 shadow-xl">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/5">
              <Activity className="w-5 h-5 text-[#E07A5F]" />
            </div>
            <div>
              <div className="font-heading font-black text-lg text-white">{t('app_title')}</div>
              <div className="text-[8px] tracking-[0.15em] uppercase text-[#E07A5F] font-bold">{t('subtitle')}</div>
            </div>
          </div>

          {/* Language Selector */}
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-white/10 bg-white/5 font-semibold text-white focus:outline-none focus:border-[#E07A5F] cursor-pointer hover:bg-white/10 transition-colors"
            >
              <option value="en" className="bg-[#0A2540] text-white">English · English</option>
              <option value="hi" className="bg-[#0A2540] text-white">हिन्दी · Hindi</option>
              <option value="mr" className="bg-[#0A2540] text-white">मराठी · Marathi</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {isASHA ? (
              <>
                <button 
                  onClick={() => setCurrentView('home')}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                    currentView === 'home' 
                      ? 'bg-[#123152] text-white shadow-inner font-bold' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Home className="w-5 h-5" />
                    {t('home')}
                  </span>
                  {currentView === 'home' && <ChevronRight className="w-4 h-4 text-[#E07A5F]" />}
                </button>

                <button 
                  onClick={() => setCurrentView('patients')}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                    currentView === 'patients' || currentView === 'add-patient'
                      ? 'bg-[#123152] text-white shadow-inner font-bold' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Users className="w-5 h-5" />
                    {t('patients')}
                  </span>
                  {(currentView === 'patients' || currentView === 'add-patient') && <ChevronRight className="w-4 h-4 text-[#E07A5F]" />}
                </button>

                <button 
                  onClick={() => setCurrentView('history')}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                    currentView === 'history' 
                      ? 'bg-[#123152] text-white shadow-inner font-bold' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <HistoryIcon className="w-5 h-5" />
                    {t('history')}
                  </span>
                  {currentView === 'history' && <ChevronRight className="w-4 h-4 text-[#E07A5F]" />}
                </button>

                <button 
                  onClick={() => setCurrentView('map')}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                    currentView === 'map' 
                      ? 'bg-[#123152] text-white shadow-inner font-bold' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[#E07A5F]" />
                    {t('locate_hospitals')}
                  </span>
                  {currentView === 'map' && <ChevronRight className="w-4 h-4 text-[#E07A5F]" />}
                </button>
              </>
            ) : (
              /* Doctor Workspace Sidebar Link */
              <button 
                onClick={() => setCurrentView('home')}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all bg-[#123152] text-white font-bold`}
              >
                <span className="flex items-center gap-3">
                  <Home className="w-5 h-5 text-[#E07A5F]" />
                  Doctor Verification Dashboard
                </span>
                <ChevronRight className="w-4 h-4 text-[#E07A5F]" />
              </button>
            )}
          </nav>
        </div>

        {/* User Card at Sidebar Bottom */}
        <div className="space-y-3 pt-4 border-t border-white/10 shrink-0">
          <div>
            <div className="font-bold text-sm text-white">{user.name}</div>
            <div className="text-[10px] uppercase text-[#E07A5F] font-extrabold tracking-wider">
              {isASHA ? 'ASHA WORKER' : 'DOCTOR / MEDICAL OFFICER'} · {user.location}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 text-xs font-bold text-white/80 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#E07A5F]" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Mobile Header (Sticky) */}
      <header className="md:hidden bg-[#0A2540] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#E07A5F]" />
          <span className="font-heading font-extrabold text-md">{t('app_title')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none pl-8 pr-6 py-1.5 text-xs rounded-lg border border-white/10 bg-white/5 font-semibold text-white focus:outline-none cursor-pointer"
            >
              <option value="en" className="bg-[#0A2540] text-white">EN</option>
              <option value="hi" className="bg-[#0A2540] text-white">हिन्दी</option>
              <option value="mr" className="bg-[#0A2540] text-white">मराठी</option>
            </select>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-xs font-bold text-slate-300 block">{user.name}</span>
            <span className="text-[9px] uppercase text-[#E07A5F] font-black">{user.location}</span>
          </div>
        </div>
      </header>

      {/* Responsive Workspace Content Area */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto max-h-screen pb-24 md:pb-8">
        
        {/* Breadcrumb Workspace Segment */}
        <div className="mb-2">
          <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#E07A5F]">
            {isASHA ? t('workspace') : t('doctor_workspace_title')}
          </span>
        </div>

        {isASHA ? (
          /* ASHA Worker Render Mode */
          <>
            {currentView === 'home' && (
              <Dashboard 
                user={user}
                patientsCount={patients.length}
                triagesTodayCount={triagesTodayCount}
                redAlertsCount={redAlertsCount}
                totalTriagesCount={totalTriagesCount}
                triageHistory={displayHistory}
                setCurrentView={setCurrentView}
                setTriagePatient={setTriagePatient}
                setIsTriageModalOpen={setIsTriageModalOpen}
                setSelectedHistoryItem={setSelectedHistoryItem}
              />
            )}

            {currentView === 'patients' && (
              <Patients 
                patients={patients}
                setCurrentView={setCurrentView}
                setTriagePatient={setTriagePatient}
                setIsTriageModalOpen={setIsTriageModalOpen}
              />
            )}

            {currentView === 'add-patient' && (
              <AddPatient 
                handleAddPatient={handleAddPatient}
              />
            )}

            {currentView === 'history' && (
              <History 
                triageHistory={displayHistory}
                setSelectedHistoryItem={setSelectedHistoryItem}
              />
            )}

            {currentView === 'map' && (
              <HospitalsMap 
                userCoords={userCoords}
                userLocationName={userLocationName}
                setUserCoords={updateLocation}
                setUserLocationName={setUserLocationName}
                isLocationManual={isLocationManual}
                resetToAutoGps={resetToAutoGps}
                onBack={() => setCurrentView('home')}
              />
            )}
          </>
        ) : (
          /* Doctor Render Mode */
          <DoctorDashboard 
            user={user}
            patients={patients}
            triageHistory={triageHistory}
            onVerifyTriage={handleVerifyTriage}
            setSelectedHistoryItem={setSelectedHistoryItem}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Tab Bar Navigation (ASHA Workers only) */}
      {isASHA && (
        <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A2540] text-white border-t border-white/5 flex items-center justify-around py-2.5 px-3 z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.15)]">
          <button 
            onClick={() => setCurrentView('home')}
            className={`flex flex-col items-center justify-center p-1.5 transition-colors ${
              currentView === 'home' ? 'text-[#E07A5F]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">{t('home')}</span>
          </button>

          <button 
            onClick={() => setCurrentView('patients')}
            className={`flex flex-col items-center justify-center p-1.5 transition-colors ${
              currentView === 'patients' || currentView === 'add-patient' ? 'text-[#E07A5F]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">{t('patients')}</span>
          </button>

          <button 
            onClick={() => setCurrentView('history')}
            className={`flex flex-col items-center justify-center p-1.5 transition-colors ${
              currentView === 'history' ? 'text-[#E07A5F]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <HistoryIcon className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">{t('history')}</span>
          </button>

          <button 
            onClick={() => setCurrentView('map')}
            className={`flex flex-col items-center justify-center p-1.5 transition-colors ${
              currentView === 'map' ? 'text-[#E07A5F]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">{t('locate_hospitals').split(' ')[0]}</span>
          </button>

          <button 
            onClick={handleLogout}
            className="flex flex-col items-center justify-center p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">{t('logout')}</span>
          </button>
        </footer>
      )}

      {/* ANM Mobile Sticky Bottom Log Out Bar */}
      {!isASHA && (
        <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A2540] text-white border-t border-white/5 flex items-center justify-around py-2.5 px-3 z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.15)]">
          <button 
            onClick={() => setCurrentView('home')}
            className="flex flex-col items-center justify-center p-1.5 text-[#E07A5F]"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">{t('cluster_dashboard').split(' ')[0]}</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex flex-col items-center justify-center p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">{t('logout')}</span>
          </button>
        </footer>
      )}

      {/* Voice Triage Session Modal Overlay component */}
      <VoiceTriageModal 
        isOpen={isTriageModalOpen}
        onClose={() => {
          setIsTriageModalOpen(false);
          setTriagePatient(null);
        }}
        patient={triagePatient}
        onSaveTriage={handleSaveTriage}
        userCoords={userCoords}
        userLocationName={userLocationName}
        user={user}
        handleAddPatient={handleAddPatient}
      />

      {/* Triage Detail Inspector Dialog */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-[#0A2540] text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-heading font-extrabold text-lg">
                  {selectedHistoryItem.showExplorer ? t('polygon_explorer') : t('triage_summary')}
                </h3>
                <p className="text-xs text-white/70">{t('patient')}: <span className="font-semibold">{selectedHistoryItem.patientName}</span></p>
              </div>
              <button 
                onClick={() => setSelectedHistoryItem(null)} 
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {selectedHistoryItem.showExplorer ? (
                /* SIMPLIFIED SAFETY RECEIPT CARD VIEW */
                <div className="space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#E07A5F]" />
                      Tamper-Proof Digital Verification
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-black uppercase rounded">
                      {t('secured')}
                    </span>
                  </div>

                  <div className="space-y-3 font-mono text-xs text-slate-600">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase font-sans">{t('tx_hash')}</span>
                      <span className="break-all text-slate-800 font-semibold select-all">{selectedHistoryItem.txHash}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase font-sans">{t('block')}</span>
                        <span className="text-slate-800 font-bold">#{selectedHistoryItem.blockNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase font-sans">Verification Status</span>
                        <span className="text-green-600 font-bold">✓ Verified & Protected</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase font-sans">{t('data_hash')}</span>
                      <span className="break-all text-slate-800 font-semibold select-all">{selectedHistoryItem.dataHash}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase font-sans">Health Worker Reference</span>
                      <span className="text-slate-700 font-sans font-semibold">ASHA Worker: {selectedHistoryItem.ashaName || 'Sunita Devi'}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-[#FDFBF7] border border-slate-200 rounded-2xl text-xs text-slate-500">
                    <p className="leading-relaxed">
                      💡 <b>How it works:</b> ASHA Saathi automatically creates a safe digital receipt for every patient record. This ensures patient records are protected from any changes or loss, giving ASHA workers and doctors a reliable, trustworthy record.
                    </p>
                  </div>
                </div>
              ) : (
                /* REGULAR TRIAGE DETAIL VIEW WITH ATTACHED BLOCKCHAIN EXPLORER TRIGGER */
                <div className="text-left space-y-5">
                  {/* Alert Level Box */}
                  <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                    selectedHistoryItem.urgency === 'Red' 
                      ? 'bg-red-50 border-red-200 text-red-900' 
                      : selectedHistoryItem.urgency === 'Yellow'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-green-50 border-green-200 text-green-900'
                  }`}>
                    {selectedHistoryItem.urgency === 'Red' && <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />}
                    {selectedHistoryItem.urgency === 'Yellow' && <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />}
                    {selectedHistoryItem.urgency === 'Green' && <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />}
                    
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm uppercase tracking-wider">
                        {selectedHistoryItem.urgency} Urgency Classification
                      </h4>
                      <p className="text-xs leading-relaxed opacity-90 font-medium">
                        {selectedHistoryItem.advice}
                      </p>
                    </div>
                  </div>

                  {/* Doctor Verification Notice in Triage Detail Modal */}
                  {(selectedHistoryItem.doctorVerificationStatus === 'verified' || selectedHistoryItem.doctorVerificationStatus === 'modified') && (
                    <div className="bg-emerald-50 border-2 border-emerald-300 p-4 rounded-2xl space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Verified by {selectedHistoryItem.verifiedBy || 'Doctor'}
                        </span>
                        {selectedHistoryItem.doctorUrgency && selectedHistoryItem.doctorUrgency !== selectedHistoryItem.urgency && (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-black uppercase">
                            Urgency Updated to {selectedHistoryItem.doctorUrgency}
                          </span>
                        )}
                      </div>
                      {selectedHistoryItem.doctorMessage && (
                        <p className="text-xs text-emerald-950 font-bold bg-white/80 p-3 rounded-xl border border-emerald-200 leading-relaxed italic">
                          "{selectedHistoryItem.doctorMessage}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Red Alert Route Emergency Facilities Recommendation */}
                  {selectedHistoryItem.urgency === 'Red' && (
                    <div className="space-y-2.5 bg-red-50/50 p-4 rounded-2xl border border-red-100">
                      <h5 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-red-600" />
                        {t('nearby_emergency')}
                      </h5>
                      <div className="space-y-2">
                        {getNearbyHospitals(userCoords?.latitude || 28.6139, userCoords?.longitude || 77.2090).slice(0, 2).map((hosp, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-xs">
                            <div>
                              <span className="font-bold text-slate-800 block">{hosp.name}</span>
                              <span className="text-[10px] text-slate-500">{hosp.type} · {hosp.dist} km away</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <a 
                                href={`tel:${hosp.phone}`} 
                                className="p-1.5 bg-red-50 text-red-700 rounded-lg font-bold text-[10px] flex items-center gap-1 border border-red-100 hover:bg-red-100"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call</span>
                              </a>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hosp.name + ' ' + hosp.address)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-slate-50 text-slate-600 rounded-lg font-bold text-[10px] flex items-center gap-1 border border-slate-200 hover:bg-slate-100"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Map</span>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blockchain anchoring panel link */}
                  {selectedHistoryItem.txHash && (
                    <div className="bg-[#EBF4FF] border border-blue-100 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="font-bold text-blue-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-[#E07A5F]" />
                          {t('secured_polygon')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">ID: {selectedHistoryItem.txHash.substring(0, 16)}...</span>
                      </div>
                      <button 
                        onClick={() => setSelectedHistoryItem(prev => ({ ...prev, showExplorer: true }))}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shadow-sm"
                      >
                        {t('verify_on_chain')}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Patient Profile Snapshot */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider">{t('patient')}</span>
                      <span className="font-semibold text-slate-800">{selectedHistoryItem.patientName} ({selectedHistoryItem.patientDetails})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider">{t('village_label')}</span>
                      <span className="font-semibold text-slate-800">{selectedHistoryItem.village}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider">{t('language_spoken_col')}</span>
                      <span className="font-semibold text-slate-800">{selectedHistoryItem.language}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider">{t('date_time_col')}</span>
                      <span className="font-semibold text-slate-800">{formatDateTime(selectedHistoryItem.createdAt || selectedHistoryItem.date)}</span>
                    </div>
                  </div>

                  {/* Transcripts */}
                  <div className="space-y-3">
                    <div className="border-l-2 border-slate-200 pl-3">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('spoken_transcript')}</h5>
                      <p className="text-sm font-medium text-slate-700 italic mt-0.5">"{selectedHistoryItem.transcript}"</p>
                    </div>
                    <div className="border-l-2 border-[#E07A5F] pl-3">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('english_translation')}</h5>
                      <p className="text-sm font-medium text-slate-700 mt-0.5">"{selectedHistoryItem.translation}"</p>
                    </div>
                  </div>

                  {/* Doctor Verification & Message Section */}
                  {(selectedHistoryItem.doctorVerificationStatus === 'verified' || selectedHistoryItem.doctorVerificationStatus === 'modified') ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Verified by {selectedHistoryItem.verifiedBy || 'Doctor'}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          Confirmed: {selectedHistoryItem.doctorUrgency || selectedHistoryItem.urgency} Alert
                        </span>
                      </div>

                      {selectedHistoryItem.doctorMessage && (
                        <div>
                          <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">Doctor's Direct Instructions to ASHA Worker:</span>
                          <p className="text-xs text-emerald-900 font-bold leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-200/60 mt-1 italic">
                            "{selectedHistoryItem.doctorMessage}"
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                        Pending Doctor Verification
                      </span>
                      <span className="text-[10px] text-amber-700 font-bold">Sent to Doctor Dashboard</span>
                    </div>
                  )}

                  {/* Extracted Symptoms */}
                  <div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{t('extracted_symptoms')}</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedHistoryItem.doctorSymptoms && selectedHistoryItem.doctorSymptoms.length > 0 ? selectedHistoryItem.doctorSymptoms : selectedHistoryItem.symptoms || []).map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 bg-slate-100 text-[#0A2540] font-semibold rounded-md border border-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between shrink-0">
              {selectedHistoryItem.showExplorer ? (
                /* Return to triage detail details from explorer */
                <button 
                  onClick={() => setSelectedHistoryItem(prev => ({ ...prev, showExplorer: false }))}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Back to Details
                </button>
              ) : (
                <div />
              )}
              
              <button 
                onClick={() => setSelectedHistoryItem(null)}
                className="px-5 py-2.5 bg-[#0A2540] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
