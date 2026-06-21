const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'asha-saathi-secret-key';

app.use(cors());
app.use(express.json());

// Mock database
const users = [
  {
    id: 1,
    phone: '9999900001',
    password: 'password123',
    name: 'Sunita Devi',
    role: 'ASHA',
    location: 'Rampur'
  },
  {
    id: 2,
    phone: '9999900003',
    password: 'password123',
    name: 'Dr. Anjali Sharma',
    role: 'ANM Supervisor',
    location: 'District Hospital'
  }
];

app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;

  // Basic validation
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  // Find user
  const user = users.find(u => u.phone === phone && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid phone number or password' });
  }

  // Generate token
  const token = jwt.sign(
    { id: user.id, phone: user.phone, role: user.role },
    SECRET_KEY,
    { expiresIn: '24h' }
  );

  // Return success response without the password
  const { password: _, ...userProfile } = user;
  
  res.json({
    message: 'Login successful',
    token,
    user: userProfile
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
