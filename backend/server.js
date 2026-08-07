require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { analyzeSpokenTriage } = require('./llm/openrouter');

const User = require('./models/User');
const Patient = require('./models/Patient');
const Triage = require('./models/Triage');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'asha-saathi-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/asha_mitra';
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());

let isMongoConnected = false;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 3000
}).then(() => {
  isMongoConnected = true;
  const maskedUri = MONGODB_URI.replace(/\/\/(.*):(.*)@/, '//***:***@');
  console.log('✅ Connected to MongoDB database:', maskedUri);
}).catch(err => {
  isMongoConnected = false;
  console.warn('⚠️ MongoDB connection not active, operating with local JSON storage fallback.');
});

// JSON File Fallback Helpers
function getJsonUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading json users:', err);
  }
  return [];
}

function saveJsonUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving json users:', err);
  }
}

// Auto-seed Demo Users for Judges (ASHA Worker & Doctor)
async function initDemoData() {
  const DEMO_USERS = [
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

  try {
    // 1. Seed JSON file
    const jsonUsers = getJsonUsers();
    let jsonUpdated = false;
    DEMO_USERS.forEach(demoUser => {
      if (!jsonUsers.some(u => u.phone === demoUser.phone)) {
        jsonUsers.push(demoUser);
        jsonUpdated = true;
      }
    });
    if (jsonUpdated || jsonUsers.length === 0) {
      saveJsonUsers(jsonUsers);
      console.log('✅ Demo accounts seeded into users.json fallback storage.');
    }

    // 2. Seed Mongo DB if connected
    if (isMongoConnected) {
      for (const demoUser of DEMO_USERS) {
        const existing = await User.findOne({ phone: demoUser.phone });
        if (!existing) {
          const newUser = new User({
            name: demoUser.name,
            phone: demoUser.phone,
            password: demoUser.password,
            role: demoUser.role,
            location: demoUser.location,
            coordinates: demoUser.coordinates,
            geoLocation: {
              type: 'Point',
              coordinates: [demoUser.coordinates.longitude, demoUser.coordinates.latitude]
            }
          });
          await newUser.save();
          console.log(`✅ Demo user created in MongoDB: ${demoUser.name} (${demoUser.role})`);
        }
      }
    }
  } catch (err) {
    console.warn('Demo user initialization error:', err.message);
  }
}

// Trigger demo data seeding
setTimeout(initDemoData, 1500);

// Google OAuth Token Verification Helper
async function verifyGoogleToken(idToken) {
  try {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    
    const response = await fetch(verifyUrl);
    if (!response.ok) {
      const errText = await response.text();
      console.error('Google token verification HTTP error:', response.status, errText);
      return null;
    }
    
    const payload = await response.json();
    
    // Perform safety checks
    // 1. Check issuer
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      console.error('Google token verification failed: Invalid issuer', payload.iss);
      return null;
    }
    
    // 2. Check audience (Client ID)
    if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
      console.error('Google token verification failed: Audience mismatch. Expected:', GOOGLE_CLIENT_ID, 'Got:', payload.aud);
      return null;
    }
    
    // 3. Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('Google token verification failed: Token expired. Expired at:', payload.exp, 'Current time:', now);
      return null;
    }
    
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch (err) {
    console.error('Error during Google token verification:', err);
    return null;
  }
}

// POST /api/auth/google - Authenticate with Google
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required.' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    if (!googleUser) {
      return res.status(401).json({ error: 'Invalid Google authentication.' });
    }

    const { googleId, email, name, picture } = googleUser;

    if (isMongoConnected) {
      // Find user by googleId or by email
      let user = await User.findOne({
        $or: [{ googleId }, { email }]
      });

      if (user) {
        // If found but doesn't have googleId linked yet (e.g. was password registered with same email)
        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
        }

        const token = jwt.sign(
          { id: user._id, phone: user.phone, role: user.role },
          SECRET_KEY,
          { expiresIn: '30d' }
        );

        const userObj = user.toObject();
        delete userObj.password;

        return res.json({
          message: 'Google login successful (MongoDB)',
          token,
          user: { ...userObj, id: userObj._id }
        });
      }

      // User not found in MongoDB -> return info to complete registration on frontend
      return res.json({
        isNewUser: true,
        googleData: { googleId, email, name, picture }
      });
    }

    // JSON Fallback mode
    const users = getJsonUsers();
    let user = users.find(u => u.googleId === googleId || (u.email && u.email.toLowerCase() === email.toLowerCase()));

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        saveJsonUsers(users);
      }

      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const { password: _, ...userProfile } = user;
      return res.json({
        message: 'Google login successful (JSON Fallback)',
        token,
        user: userProfile
      });
    }

    // User not found in JSON File -> return info to complete registration on frontend
    return res.json({
      isNewUser: true,
      googleData: { googleId, email, name, picture }
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ error: 'Server Google authentication error' });
  }
});

// POST /api/auth/google/register - Complete Registration with Google Auth
app.post('/api/auth/google/register', async (req, res) => {
  try {
    const { idToken, name, phone, role, location, coordinates } = req.body;

    if (!idToken || !name || !phone || !location) {
      return res.status(400).json({ error: 'ID Token, Name, phone, and location are required.' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    if (!googleUser) {
      return res.status(401).json({ error: 'Invalid Google authentication token.' });
    }

    const { googleId, email } = googleUser;
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');

    if (isMongoConnected) {
      // Check if googleId or email isn't already registered
      const existingGoogleUser = await User.findOne({
        $or: [{ googleId }, { email }]
      });
      if (existingGoogleUser) {
        const token = jwt.sign(
          { id: existingGoogleUser._id, phone: existingGoogleUser.phone, role: existingGoogleUser.role },
          SECRET_KEY,
          { expiresIn: '30d' }
        );
        const userObj = existingGoogleUser.toObject();
        delete userObj.password;
        return res.status(200).json({
          message: 'Google account already registered. Logged in successfully!',
          token,
          user: { ...userObj, id: userObj._id }
        });
      }

      // Check if phone number is already registered
      const existingPhoneUser = await User.findOne({ phone: cleanPhone });
      if (existingPhoneUser) {
        return res.status(409).json({ error: 'A user with this phone number is already registered.' });
      }

      const geoCoord = coordinates 
        ? [coordinates.longitude || 80.3500, coordinates.latitude || 23.8000]
        : [80.3500, 23.8000];

      const newUser = new User({
        name: name.trim(),
        phone: cleanPhone,
        googleId,
        email,
        role: role || 'ASHA Worker',
        location,
        coordinates,
        geoLocation: {
          type: 'Point',
          coordinates: geoCoord
        }
      });

      await newUser.save();

      const token = jwt.sign(
        { id: newUser._id, phone: newUser.phone, role: newUser.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const userObj = newUser.toObject();
      delete userObj.password;

      return res.status(201).json({
        message: 'Google user registered in MongoDB',
        token,
        user: { ...userObj, id: userObj._id }
      });
    }

    // JSON Fallback Mode
    const users = getJsonUsers();
    const existingGoogle = users.find(u => u.googleId === googleId || (u.email && u.email.toLowerCase() === email.toLowerCase()));
    if (existingGoogle) {
      const token = jwt.sign(
        { id: existingGoogle.id, phone: existingGoogle.phone, role: existingGoogle.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );
      const { password: _, ...userProfile } = existingGoogle;
      return res.status(200).json({
        message: 'Google account already registered. Logged in successfully!',
        token,
        user: userProfile
      });
    }

    if (users.find(u => u.phone === cleanPhone)) {
      return res.status(409).json({ error: 'A user with this phone number is already registered.' });
    }

    const newUser = {
      id: Date.now(),
      name: name.trim(),
      phone: cleanPhone,
      googleId,
      email,
      role: role || 'ASHA Worker',
      location,
      coordinates
    };

    users.push(newUser);
    saveJsonUsers(users);

    const token = jwt.sign(
      { id: newUser.id, phone: newUser.phone, role: newUser.role },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      message: 'Google user registered (JSON Fallback)',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Google Registration Error:', error);
    res.status(500).json({ error: 'Server Google registration error' });
  }
});

// POST /api/auth/register - Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, password, role, location, coordinates } = req.body;

    if (!name || !phone || !password || !location) {
      return res.status(400).json({ error: 'Name, phone, password, and location are required.' });
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanPass = password.trim();

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please provide a valid 10-digit Indian phone number starting with 6, 7, 8, or 9.' });
    }

    if (cleanPass.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (isMongoConnected) {
      const existingUser = await User.findOne({ phone: cleanPhone });
      if (existingUser) {
        if (existingUser.password === cleanPass) {
          const token = jwt.sign(
            { id: existingUser._id, phone: existingUser.phone, role: existingUser.role },
            SECRET_KEY,
            { expiresIn: '30d' }
          );
          const userObj = existingUser.toObject();
          delete userObj.password;
          return res.status(200).json({
            message: 'Account already registered. Logged in successfully!',
            token,
            user: { ...userObj, id: userObj._id }
          });
        }
        return res.status(409).json({ error: 'A user with this phone number is already registered with a different password.' });
      }

      const geoCoord = coordinates 
        ? [coordinates.longitude || 80.3500, coordinates.latitude || 23.8000]
        : [80.3500, 23.8000];

      const newUser = new User({
        name: name.trim(),
        phone: cleanPhone,
        password: cleanPass,
        role: role || 'ASHA Worker',
        location,
        coordinates,
        geoLocation: {
          type: 'Point',
          coordinates: geoCoord
        }
      });

      await newUser.save();

      const token = jwt.sign(
        { id: newUser._id, phone: newUser.phone, role: newUser.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const userObj = newUser.toObject();
      delete userObj.password;

      return res.status(201).json({
        message: 'User registered in MongoDB',
        token,
        user: { ...userObj, id: userObj._id }
      });
    }

    // JSON Fallback
    const users = getJsonUsers();
    const existingUser = users.find(u => u.phone === cleanPhone);
    if (existingUser) {
      if (existingUser.password === cleanPass) {
        const token = jwt.sign(
          { id: existingUser.id, phone: existingUser.phone, role: existingUser.role },
          SECRET_KEY,
          { expiresIn: '30d' }
        );
        const { password: _, ...userProfile } = existingUser;
        return res.status(200).json({
          message: 'Account already registered. Logged in successfully!',
          token,
          user: userProfile
        });
      }
      return res.status(409).json({ error: 'A user with this phone number is already registered with a different password.' });
    }

    const newUser = {
      id: Date.now(),
      name: name.trim(),
      phone: cleanPhone,
      password: cleanPass,
      role: role || 'ASHA Worker',
      location,
      coordinates
    };

    users.push(newUser);
    saveJsonUsers(users);

    const token = jwt.sign(
      { id: newUser.id, phone: newUser.phone, role: newUser.role },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    const { password: _, ...userProfile } = newUser;
    return res.status(201).json({
      message: 'User registered (File Fallback)',
      token,
      user: userProfile
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Server registration error' });
  }
});

// POST /api/auth/login - Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanPass = password.trim();

    if (isMongoConnected) {
      const userByPhone = await User.findOne({ phone: cleanPhone });
      if (!userByPhone) {
        return res.status(404).json({ error: 'This mobile number is not registered. Please register first.' });
      }

      if (userByPhone.password !== cleanPass) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      const token = jwt.sign(
        { id: userByPhone._id, phone: userByPhone.phone, role: userByPhone.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const userObj = userByPhone.toObject();
      delete userObj.password;

      return res.json({
        message: 'Login successful (MongoDB)',
        token,
        user: { ...userObj, id: userObj._id }
      });
    }

    // JSON Fallback
    const users = getJsonUsers();
    const userByPhone = users.find(u => u.phone === cleanPhone);
    if (!userByPhone) {
      return res.status(404).json({ error: 'This mobile number is not registered. Please register first.' });
    }

    if (userByPhone.password !== cleanPass) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = jwt.sign(
      { id: userByPhone.id, phone: userByPhone.phone, role: userByPhone.role },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    const { password: _, ...userProfile } = userByPhone;
    return res.json({
      message: 'Login successful',
      token,
      user: userProfile
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server login error' });
  }
});

// JSON File Fallback Helpers for Patients & Triage
const PATIENTS_FILE = path.join(__dirname, 'patients.json');
const TRIAGE_FILE = path.join(__dirname, 'triage.json');

function getJsonData(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return [];
}

function saveJsonData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
  }
}

// GET /api/patients - Fetch Patients
app.get('/api/patients', async (req, res) => {
  try {
    if (isMongoConnected) {
      const patients = await Patient.find().sort({ createdAt: -1 });
      const formatted = patients.map(p => {
        const obj = p.toObject();
        return { ...obj, id: obj._id.toString() };
      });
      return res.json(formatted);
    }
    const patients = getJsonData(PATIENTS_FILE);
    return res.json(patients);
  } catch (error) {
    console.error('Fetch Patients Error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// POST /api/patients - Create Patient
app.post('/api/patients', async (req, res) => {
  try {
    const { name, age, gender, village, phone, notes, createdBy } = req.body;
    if (!name || !age || !gender || !village) {
      return res.status(400).json({ error: 'Name, age, gender, and village are required.' });
    }

    if (isMongoConnected) {
      const newPatient = new Patient({
        name,
        age: Number(age),
        gender,
        village,
        phone: phone || '',
        notes: notes || '',
        createdBy: createdBy || null
      });
      await newPatient.save();
      const obj = newPatient.toObject();
      return res.status(201).json({ ...obj, id: obj._id.toString() });
    }

    const patients = getJsonData(PATIENTS_FILE);
    const newPatient = {
      id: Date.now().toString(),
      name,
      age: Number(age),
      gender,
      village,
      phone: phone || '',
      notes: notes || '',
      createdAt: new Date().toISOString()
    };
    patients.unshift(newPatient);
    saveJsonData(PATIENTS_FILE, patients);
    return res.status(201).json(newPatient);
  } catch (error) {
    console.error('Create Patient Error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// GET /api/triage - Fetch Triage History
app.get('/api/triage', async (req, res) => {
  try {
    if (isMongoConnected) {
      const records = await Triage.find().sort({ createdAt: -1 });
      const formatted = records.map(r => {
        const obj = r.toObject();
        return {
          ...obj,
          id: obj._id.toString(),
          date: obj.createdAt ? new Date(obj.createdAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata'
          }) : (obj.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
        };
      });
      return res.json(formatted);
    }
    const records = getJsonData(TRIAGE_FILE);
    return res.json(records);
  } catch (error) {
    console.error('Fetch Triage Error:', error);
    res.status(500).json({ error: 'Failed to fetch triage records' });
  }
});

// POST /api/triage - Create Triage Record
app.post('/api/triage', async (req, res) => {
  try {
    const {
      patientName, patientAge, patientGender, village, ashaName, urgency,
      symptoms, vitals, advice, transcript, translation, audioUrl,
      txHash, blockNumber, dataHash, coordinates,
      doctorVerificationStatus, verifiedBy, doctorUrgency, doctorSymptoms, doctorMessage,
      date
    } = req.body;

    if (!patientName || !ashaName || !urgency) {
      return res.status(400).json({ error: 'Patient name, ASHA name, and urgency are required.' });
    }

    const currentFormattedDate = date || new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata'
    });

    if (isMongoConnected) {
      const newTriage = new Triage({
        patientName,
        patientAge,
        patientGender,
        village,
        ashaName,
        urgency,
        symptoms: symptoms || [],
        vitals: vitals || {},
        advice: advice || '',
        transcript: transcript || '',
        translation: translation || '',
        audioUrl: audioUrl || '',
        txHash: txHash || '',
        blockNumber: blockNumber || null,
        dataHash: dataHash || '',
        coordinates: coordinates || null,
        doctorVerificationStatus: doctorVerificationStatus || 'pending',
        verifiedBy: verifiedBy || null,
        verifiedAt: verifiedBy ? new Date() : null,
        doctorUrgency: doctorUrgency || urgency,
        doctorSymptoms: doctorSymptoms || symptoms || [],
        doctorMessage: doctorMessage || ''
      });
      await newTriage.save();
      const obj = newTriage.toObject();
      return res.status(201).json({
        ...obj,
        id: obj._id.toString(),
        date: currentFormattedDate
      });
    }

    const records = getJsonData(TRIAGE_FILE);
    const newRecord = {
      id: 'triage-' + Date.now(),
      patientName, patientAge, patientGender, village, ashaName, urgency,
      symptoms: symptoms || [], vitals: vitals || {}, advice: advice || '',
      transcript: transcript || '', translation: translation || '',
      audioUrl: audioUrl || '', txHash: txHash || '', blockNumber: blockNumber || null,
      dataHash: dataHash || '', coordinates: coordinates || null,
      doctorVerificationStatus: doctorVerificationStatus || 'pending',
      verifiedBy: verifiedBy || null,
      verifiedAt: verifiedBy ? new Date().toISOString() : null,
      doctorUrgency: doctorUrgency || urgency,
      doctorSymptoms: doctorSymptoms || symptoms || [],
      doctorMessage: doctorMessage || '',
      date: currentFormattedDate
    };
    records.unshift(newRecord);
    saveJsonData(TRIAGE_FILE, records);
    return res.status(201).json(newRecord);
    records.unshift(newRecord);
    saveJsonData(TRIAGE_FILE, records);
    return res.status(201).json(newRecord);
  } catch (error) {
    console.error('Create Triage Error:', error);
    res.status(500).json({ error: 'Failed to create triage record' });
  }
});

// PUT /api/triage/:id/verify - Doctor Triage Verification & Message Route
app.put('/api/triage/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { verifiedBy, doctorUrgency, doctorSymptoms, doctorMessage } = req.body;

    if (!verifiedBy) {
      return res.status(400).json({ error: 'Doctor name (verifiedBy) is required.' });
    }

    if (isMongoConnected) {
      const triage = await Triage.findById(id);
      if (!triage) {
        return res.status(404).json({ error: 'Triage record not found' });
      }

      triage.doctorVerificationStatus = 'verified';
      triage.verifiedBy = verifiedBy;
      triage.verifiedAt = new Date();
      if (doctorUrgency) triage.doctorUrgency = doctorUrgency;
      if (doctorSymptoms) triage.doctorSymptoms = doctorSymptoms;
      if (doctorMessage !== undefined) triage.doctorMessage = doctorMessage;

      await triage.save();
      const obj = triage.toObject();
      return res.json({
        ...obj,
        id: obj._id.toString(),
        date: new Date(obj.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      });
    }

    // JSON Fallback
    const records = getJsonData(TRIAGE_FILE);
    const index = records.findIndex(r => r.id === id || r._id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Triage record not found' });
    }

    records[index] = {
      ...records[index],
      doctorVerificationStatus: 'verified',
      verifiedBy,
      verifiedAt: new Date().toISOString(),
      doctorUrgency: doctorUrgency || records[index].doctorUrgency || records[index].urgency,
      doctorSymptoms: doctorSymptoms || records[index].doctorSymptoms || records[index].symptoms,
      doctorMessage: doctorMessage !== undefined ? doctorMessage : (records[index].doctorMessage || '')
    };

    saveJsonData(TRIAGE_FILE, records);
    return res.json(records[index]);
  } catch (error) {
    console.error('Verify Triage Error:', error);
    res.status(500).json({ error: 'Failed to verify triage record' });
  }
});

// POST /api/speech-to-text - Sarvam AI Speech-to-Text Proxy
app.post('/api/speech-to-text', async (req, res) => {
  try {
    const { audio, languageCode } = req.body;
    const apiKey = process.env.SARVAM_API_KEY;

    if (!audio) {
      return res.status(400).json({ error: 'Audio payload is required.' });
    }

    if (!apiKey) {
      console.warn('⚠️ Sarvam API key missing in environment. Set SARVAM_API_KEY in backend/.env');
      return res.status(400).json({
        error: 'Sarvam API key is not configured.',
        fallback: true
      });
    }

    // Convert base64 data to Blob Buffer safely
    let base64Data = audio;
    let mimeType = 'audio/webm';
    let filename = 'audio.webm';

    if (typeof audio === 'string' && audio.includes(',')) {
      const parts = audio.split(',');
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:([^;]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1].split(';')[0]; // Extract base mimeType without codecs parameter
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) filename = 'audio.mp4';
        else if (mimeType.includes('wav')) filename = 'audio.wav';
        else if (mimeType.includes('ogg')) filename = 'audio.ogg';
        else if (mimeType.includes('mp3')) filename = 'audio.mp3';
      }
    } else if (typeof audio === 'string') {
      base64Data = audio.replace(/^data:[^;]+;base64,/, '');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const audioBlob = new Blob([buffer], { type: mimeType });

    // Build multipart/form-data for Sarvam STT API
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', 'saaras:v3');

    // Language code mapping (hi-IN, en-IN, mr-IN)
    let lang = 'hi-IN';
    if (languageCode === 'en' || languageCode === 'en-IN') lang = 'en-IN';
    else if (languageCode === 'mr' || languageCode === 'mr-IN') lang = 'mr-IN';
    else if (languageCode === 'hi' || languageCode === 'hi-IN') lang = 'hi-IN';
    else lang = 'unknown';

    formData.append('language_code', lang);

    const sarvamRes = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey
      },
      body: formData
    });

    const data = await sarvamRes.json();

    if (!sarvamRes.ok) {
      console.error('Sarvam STT API Error:', data);
      return res.status(sarvamRes.status).json({
        error: data.message || 'Sarvam AI speech recognition failed.',
        fallback: true
      });
    }

    return res.json({
      transcript: data.transcript || '',
      language_code: data.language_code || lang
    });
  } catch (error) {
    console.error('Speech-to-Text Error:', error);
    res.status(500).json({ error: 'Internal speech-to-text error', fallback: true });
  }
});

// POST /api/translate - Sarvam AI Translation Proxy (Hindi/Marathi -> English)
app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLanguageCode } = req.body;
    const apiKey = process.env.SARVAM_API_KEY;

    if (!text) {
      return res.status(400).json({ error: 'Text payload is required.' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'Sarvam API key is not configured.', fallback: true });
    }

    let srcLang = sourceLanguageCode || 'hi-IN';
    if (srcLang === 'hi') srcLang = 'hi-IN';
    if (srcLang === 'mr') srcLang = 'mr-IN';
    if (srcLang === 'en' || srcLang === 'en-IN') {
      return res.json({ translatedText: text }); // Already English
    }

    const sarvamRes = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        source_language_code: srcLang,
        target_language_code: 'en-IN',
        mode: 'formal'
      })
    });

    const data = await sarvamRes.json();

    if (!sarvamRes.ok) {
      console.error('Sarvam Translate Error:', data);
      return res.status(sarvamRes.status).json({ error: 'Translation failed', fallback: true });
    }

    return res.json({
      translatedText: data.translated_text || text,
      sourceLanguageCode: srcLang
    });
  } catch (error) {
    console.error('Translation Error:', error);
    res.status(500).json({ error: 'Internal translation error', fallback: true });
  }
});

// POST /api/analyze-triage - OpenRouter LLM Voice Triage Engine
app.post('/api/analyze-triage', async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Speech text payload is required.' });
    }

    const triageAnalysis = await analyzeSpokenTriage({ text, language });
    return res.json(triageAnalysis);
  } catch (error) {
    console.error('Speech Triage Analysis Error:', error);
    res.status(500).json({ error: 'Internal triage analysis error' });
  }
});

// GET /api/health - Server & DB status check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: isMongoConnected ? 'MongoDB Connected' : 'JSON Local Storage Active'
  });
});

// Serve static frontend files in production if built
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).json({
      status: "online",
      message: "ASHA Mitra API Server is running successfully. If you are looking for the frontend interface, please visit your deployed frontend URL.",
      endpoints: {
        health: "/api/health",
        patients: "/api/patients",
        triage: "/api/triage"
      }
    });
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

