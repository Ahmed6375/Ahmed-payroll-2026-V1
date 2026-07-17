const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MySQL Connection Setting
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'mysql-8dc52d0-ahmedalimed1405-ca35.b.aivencloud.com',
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD || 'AVNS_wCopvpSt0u7NgymQ_Gg',
    database: process.env.DB_NAME || 'defaultdb',
    port: process.env.DB_PORT || 21633
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Successfully connected to the central SQL database!');
        initDatabase();
    }
});

// ሁሉንም ሰንጠረዦች በራስ-ሰር መፍጠሪያ (users ወደ admins ተቀይሯል)
const initDatabase = () => {
  const createWoredasTable = `
    CREATE TABLE IF NOT EXISTS woredas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      allowed_budget_year INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // የአድሚኖች ሰንጠረዥ
  const createAdminsTable = `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      role VARCHAR(100), -- 'Region_Admin' ወይም 'Woreda_Admin'
      woreda_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createSectorsTable = `
    CREATE TABLE IF NOT EXISTS sectors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createOfficesTable = `
    CREATE TABLE IF NOT EXISTS offices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100),
      woreda_id INT,
      sector_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createEmployeesTable = `
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      job_title VARCHAR(255),
      office_id INT,
      woreda_id INT,
      employment_type VARCHAR(100),
      basic_salary DECIMAL(10, 2),
      status VARCHAR(100) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPayrollTable = `
    CREATE TABLE IF NOT EXISTS payrolls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      woreda_id INT NOT NULL,
      month VARCHAR(50) NOT NULL,
      year INT NOT NULL,
      status VARCHAR(50) DEFAULT 'Draft',
      prepared_by INT,
      approved_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.query(createWoredasTable, (err) => { if (err) console.error("woredas err:", err.message); });
  db.query(createAdminsTable, (err) => { if (err) console.error("admins err:", err.message); });
  db.query(createSectorsTable, (err) => { if (err) console.error("sectors err:", err.message); });
  db.query(createOfficesTable, (err) => { if (err) console.error("offices err:", err.message); });
  db.query(createEmployeesTable, (err) => { if (err) console.error("employees err:", err.message); });
  db.query(createPayrollTable, (err) => { 
    if (err) console.error("payroll err:", err.message); 
    else console.log("ሁሉም የዳታቤዝ ሰንጠረዦች (ከadmins ጋር) ዝግጁ ናቸው! 🎉");
  });
};

// ------------------- API ROUTES -------------------

// 1. Admin Login (ከ admins ሰንጠረዥ ያረጋግጣል)
app.post('/api/login', (req, res) => {
    const { username, password_hash } = req.body;
    // ቴብሉን hadmins አድርገነዋል
    db.query('SELECT * FROM hadmins WHERE username = ? AND password_hash = ?', [username, password_hash], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results && results.length > 0) {
            res.json({ message: 'Login successful', user: results[0] });
        } else {
            // እዚህ ጋር ለምርመራ እንዲረዳን ምን እንደተፈጠረ እናሳያለን
            res.status(401).json({ message: 'ተጠቃሚው አልተገኘም! Username ወይም Password በ hadmins ቴብል ውስጥ የለም።' });
        }
    });
});

// 2. Register Woreda Admin (የክልል አድሚን ብቻ ይመዘግባል)
app.post('/api/register-admin', (req, res) => {
    const { username, password_hash, full_name, woreda_id, role } = req.body;
    if (role !== 'Region_Admin') {
        return res.status(403).json({ error: "የወረዳ አድሚኖችን መመዝገብ የሚችለው የክልል አድሚን ብቻ ነው!" });
    }
    db.query('INSERT INTO admins (username, password_hash, full_name, role, woreda_id) VALUES (?, ?, ?, "Woreda_Admin", ?)', 
    [username, password_hash, full_name, woreda_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Woreda Admin registered successfully' });
    });
});

// 3. የወረዳ አድሚን መረጃ ማስተካከያ (የክልል አድሚን በስህተት የገባን ለማስተካከል)
app.put('/api/admins/:id', (req, res) => {
    const adminId = req.params.id;
    const { username, password_hash, full_name, woreda_id, current_user_role } = req.body;

    if (current_user_role !== 'Region_Admin') {
        return res.status(403).json({ error: "የአድሚን መረጃ ማስተካከል የሚችለው የክልል አድሚን ብቻ ነው!" });
    }

    db.query(
        'UPDATE admins SET username = ?, password_hash = ?, full_name = ?, woreda_id = ? WHERE id = ?',
        [username, password_hash, full_name, woreda_id, adminId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'የወረዳ አድሚን መረጃ በተሳካ ሁኔታ ተስተካክሏል!' });
        }
    );
});

// 4. የወረዳ አድሚን መሰረዣ (ሥራ ሲለቅ ወይም ሲሞት ከሲስተም ለማውጣት)
app.delete('/api/admins/:id', (req, res) => {
    const adminId = req.params.id;
    const { current_user_role } = req.body;

    if (current_user_role !== 'Region_Admin') {
        return res.status(403).json({ error: "የወረዳ አድሚንን መሰረዝ የሚችለው የክልል አድሚን ብቻ ነው!" });
    }

    db.query('DELETE FROM admins WHERE id = ?', [adminId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'የወረዳው አድሚን ከሲስተሙ ላይ ሙሉ በሙሉ ተሰርዟል!' });
    });
});

// Fetch All Admins (ለክልል አድሚን ማሳያ)
app.get('/api/admins', (req, res) => {
    db.query('SELECT id, username, full_name, role, woreda_id, created_at FROM admins', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 5. Add Sector (dropdown አጠገብ ለሚቀመጠው "Add Sector" ቁልፍ)
app.post('/api/sectors', (req, res) => {
    const { name } = req.body;
    db.query('INSERT INTO sectors (name) VALUES (?)', [name], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Sector added successfully', id: results.insertId });
    });
});

// Fetch Sectors
app.get('/api/sectors', (req, res) => {
    db.query('SELECT * FROM sectors', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 6. Get Employees (የወረዳ አድሚን የራሱን ብቻ፣ የክልል ሁሉንም ያያል)
app.get('/api/employees', (req, res) => {
    const { woreda_id, role } = req.query;
    let query = 'SELECT * FROM employees';
    let params = [];

    if (role === 'Woreda_Admin' && woreda_id) {
        query += ' WHERE woreda_id = ?';
        params.push(woreda_id);
    } else if (woreda_id) {
        query += ' WHERE woreda_id = ?';
        params.push(woreda_id);
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 7. Add Employee (የወረዳ አድሚን ብቻ ሰራተኛ ይመዘግባል)
app.post('/api/employees', (req, res) => {
    const { first_name, last_name, job_title, office_id, woreda_id, employment_type, basic_salary, status, role } = req.body;
    
    if (role === 'Region_Admin') {
         return res.status(403).json({ error: "ሰራተኞችን መመዝገብ የሚችለው የወረዳ አድሚን ብቻ ነው!" });
    }

    db.query('INSERT INTO employees (first_name, last_name, job_title, office_id, woreda_id, employment_type, basic_salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [first_name, last_name, job_title, office_id, woreda_id, employment_type, basic_salary, status], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Employee added successfully', id: results.insertId });
    });
});

// 8. ፔሮል ማዘጋጀት (የወረዳውም ሆነ የክልሉ አድሚን Draft ወይም Final ማድረግ ይችላሉ)
app.post('/api/payroll/prepare', (req, res) => {
    const { woreda_id, month, year, user_id, status } = req.body; 
    const finalStatus = status || 'Draft';
    const approvedBy = (finalStatus === 'Final') ? user_id : null;

    db.query(
        'INSERT INTO payrolls (woreda_id, month, year, status, prepared_by, approved_by) VALUES (?, ?, ?, ?, ?, ?)',
        [woreda_id, month, year, finalStatus, user_id, approvedBy],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: `ፔሮል በ ${finalStatus} ደረጃ በተሳካ ሁኔታ ተዘጋጅቷል!`, id: results.insertId });
        }
    );
});

// 9. ፔሮልን ማጽደቅ (ከ Draft ወደ Final መቀየር)
app.post('/api/payroll/approve', (req, res) => {
    const { payroll_id, user_id } = req.body;
    db.query(
        'UPDATE payrolls SET status = "Final", approved_by = ? WHERE id = ?',
        [user_id, payroll_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'ፔሮሉ ጸድቋል (Finalized ሆኗል)!' });
        }
    );
});

// 10. የጸደቀውን ፔሮል ወደ Draft መመለስ (የክልል አድሚን ብቻ!)
app.post('/api/payroll/reject-to-draft', (req, res) => {
    const { payroll_id, role } = req.body;

    if (role !== 'Region_Admin') {
        return res.status(403).json({ error: "የጸደቀውን ፔሮል ወደ ኃላ (Draft) መመለስ የሚችለው የክልል አድሚን ብቻ ነው!" });
    }

    db.query(
        'UPDATE payrolls SET status = "Draft", approved_by = NULL WHERE id = ?',
        [payroll_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'የጸደቀው ፔሮል በተሳካ ሁኔታ ወደ Draft ተመልሷል!' });
        }
    );
});

// 11. Fetch Woredas (የወረዳ አድሚን ሲገባ የራሱን ወረዳ ብቻ በ Dropdown እንዲያይ የተስተካከለ)
app.get('/api/woredas', (req, res) => {
    const { woreda_id, role } = req.query;

    let query = 'SELECT * FROM woredas';
    let params = [];

    if (role === 'Woreda_Admin' && woreda_id) {
        query += ' WHERE id = ?';
        params.push(woreda_id);
    }

    db.query(query, params, (err, results) => {
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

// 12. Fetch Offices (የወረዳ አድሚን ሲገባ የራሱን ወረዳ ፅህፈት ቤቶች ብቻ እንዲያይ የተስተካከለ)
app.get('/api/offices', (req, res) => {
    const { woreda_id, role } = req.query;
    
    let query = 'SELECT * FROM offices';
    let params = [];

    if (role === 'Woreda_Admin' && woreda_id) {
        query += ' WHERE woreda_id = ?';
        params.push(woreda_id);
    } else if (woreda_id) {
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

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
