const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MySQL Cloud/Local Connection Setting
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ahmed_woredas_payroll',
    port: process.env.DB_PORT || 3306
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Successfully connected to the central SQL database!');
    }
});

// User Login
app.post('/api/login', (req, res) => {
    const { username, password_hash } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password_hash = ?', [username, password_hash], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) {
            res.json({ message: 'Login successful', user: results[0] });
        } else {
            res.status(401).json({ message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል አልተገኘም!' });
        }
    });
});

// Fetch Woredas
app.get('/api/woredas', (req, res) => {
    db.query('SELECT * FROM woredas', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add Woreda
app.post('/api/woredas', (req, res) => {
    const { name, allowed_budget_year } = req.body;
    db.query('INSERT INTO woredas (name, allowed_budget_year) VALUES (?, ?)', [name, allowed_budget_year], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Woreda added successfully', id: results.insertId });
    });
});

// Fetch Sectors
app.get('/api/sectors', (req, res) => {
    db.query('SELECT * FROM sectors', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Fetch Woreda Admins
app.get('/api/admins', (req, res) => {
    db.query('SELECT id, username, full_name, role, woreda_id FROM users WHERE role = "Woreda_Admin"', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Register Woreda Admin
app.post('/api/register-admin', (req, res) => {
    const { username, password_hash, full_name, woreda_id } = req.body;
    db.query('INSERT INTO users (username, password_hash, full_name, role, woreda_id) VALUES (?, ?, ?, "Woreda_Admin", ?)', 
    [username, password_hash, full_name, woreda_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Woreda Admin registered successfully' });
    });
});

// Fetch Offices
app.get('/api/offices', (req, res) => {
    const { woreda_id } = req.query;
    let query = 'SELECT * FROM offices';
    let params = [];
    if (woreda_id) {
        query += ' WHERE woreda_id = ?';
        params.push(woreda_id);
    }
    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add Office
app.post('/api/offices', (req, res) => {
    const { name, code, woreda_id, sector_id } = req.body;
    db.query('INSERT INTO offices (name, code, woreda_id, sector_id) VALUES (?, ?, ?, ?)', [name, code, woreda_id, sector_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Office added successfully' });
    });
});

// Fetch Employees
app.get('/api/employees', (req, res) => {
    db.query('SELECT * FROM employees', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add Employee
app.post('/api/employees', (req, res) => {
    const { first_name, last_name, job_title, office_id, woreda_id, employment_type, basic_salary, status } = req.body;
    db.query('INSERT INTO employees (first_name, last_name, job_title, office_id, woreda_id, employment_type, basic_salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [first_name, last_name, job_title, office_id, woreda_id, employment_type, basic_salary, status], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Employee added successfully' });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});