const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_JSON_PATH = path.join(__dirname, 'db.json');

// Global connection pool for MySQL
let pool = null;
let useMySQL = false;

// Mock database data for fallback JSON mode
const initialJsonData = {
    users: [
        { id: 1, email: "admin@jobmarket.com", password: "admin", role: "Admin", name: "System Administrator", resume_path: null, skills: null, experience: null, title: null, created_at: new Date().toISOString() },
        { id: 2, email: "recruiter@google.com", password: "recruiter", role: "Recruiter", name: "Sundar Pichai", resume_path: null, skills: null, experience: null, title: null, created_at: new Date().toISOString() },
        { id: 3, email: "recruiter@microsoft.com", password: "recruiter", role: "Recruiter", name: "Satya Nadella", resume_path: null, skills: null, experience: null, title: null, created_at: new Date().toISOString() },
        { id: 4, email: "seeker@gmail.com", password: "user", role: "User", name: "John Doe", resume_path: null, skills: "HTML, CSS, JavaScript, Node.js", experience: "2 years", title: "Full Stack Engineer", created_at: new Date().toISOString() }
    ],
    companies: [
        { id: 1, recruiter_id: 2, name: "Google LLC", description: "Google is a global technology leader focused on improving the ways people connect with information.", website: "https://google.com", location: "Mountain View, CA", logo: "", created_at: new Date().toISOString() },
        { id: 2, recruiter_id: 3, name: "Microsoft Corp", description: "Microsoft enables digital transformation for the era of an intelligent cloud and an intelligent edge.", website: "https://microsoft.com", location: "Redmond, WA", logo: "", created_at: new Date().toISOString() }
    ],
    jobs: [
        { id: 1, company_id: 1, title: "Software Engineer - Google Cloud", category: "Engineering", location: "Mountain View, CA", salary: "$150,000 - $180,000", experience_level: "Mid-Level", description: "Join the Google Cloud team to design and implement highly scalable infrastructure services. You will write high-quality Node.js/Go services, participate in system design, and collaborate with globally distributed product teams.", requirements: "Bachelor's degree in Computer Science, 3+ years experience with backend systems, strong understanding of cloud architectures.", status: "Active", created_at: new Date().toISOString() },
        { id: 2, company_id: 2, title: "Frontend Developer - Teams UI", category: "Frontend", location: "Remote", salary: "$120,000 - $145,000", experience_level: "Junior", description: "We are looking for a passionate UI engineer to work on Microsoft Teams. You will build user-friendly dashboard interfaces using standard HTML, CSS, and modern framework techniques, focusing on accessibility and speed.", requirements: "1+ years experience in frontend development, proficiency in HTML5, CSS3, JavaScript, and responsive design layouts.", status: "Active", created_at: new Date().toISOString() },
        { id: 3, company_id: 1, title: "Technical Product Manager", category: "Management", location: "New York, NY", salary: "$160,000 - $210,000", experience_level: "Senior", description: "As a Product Manager at Google, you will lead the design and deployment of security-focused authentication platforms. You will partner with engineers, recruiters, and administrators to roll out key portal upgrades.", requirements: "5+ years PM experience, tech background in software engineering, excellent cross-functional collaboration skills.", status: "Active", created_at: new Date().toISOString() }
    ],
    applications: [
        { id: 1, job_id: 1, user_id: 4, status: "Pending", resume_text: "John Doe - Resume\nSkills: Javascript, Node, HTML, CSS.\nExperience: Built job seeker dashboard portals, handled API database migrations.", applied_at: new Date().toISOString() }
    ]
};

// Initialize JSON database file if it does not exist
function initJsonDb() {
    if (!fs.existsSync(DB_JSON_PATH)) {
        fs.writeFileSync(DB_JSON_PATH, JSON.stringify(initialJsonData, null, 2));
        console.log("Initialized local JSON database file at db.json");
    }
}

// Read JSON database
function readJsonDb() {
    initJsonDb();
    const data = fs.readFileSync(DB_JSON_PATH, 'utf-8');
    return JSON.parse(data);
}

// Write JSON database
function writeJsonDb(data) {
    fs.writeFileSync(DB_JSON_PATH, JSON.stringify(data, null, 2));
}

// Initialize MySQL or fallback
async function connectDb() {
    if (process.env.DB_TYPE === 'mysql') {
        try {
            pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASS || '',
                database: process.env.DB_NAME || 'job_market',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            // Try connecting to verify
            const conn = await pool.getConnection();
            conn.release();
            useMySQL = true;
            console.log("Successfully connected to MySQL Database!");
        } catch (err) {
            console.warn("MySQL connection failed. Falling back to local JSON database (db.json). Error:", err.message);
            useMySQL = false;
            initJsonDb();
        }
    } else {
        console.log("DB_TYPE set to 'json' (or not configured). Using local JSON database (db.json).");
        useMySQL = false;
        initJsonDb();
    }
}

// Ensure database helper can be run asynchronously
async function query(sql, params) {
    if (useMySQL) {
        const [results] = await pool.execute(sql, params);
        return results;
    } else {
        throw new Error("Query method only supported in MySQL mode. Use standard API wrappers.");
    }
}

// --- DATABASE API WRAPPERS ---

const db = {
    connectDb,
    isMySQL: () => useMySQL,

    // --- USERS ---
    async getUsers() {
        if (useMySQL) {
            const [rows] = await pool.execute('SELECT * FROM users');
            return rows;
        } else {
            return readJsonDb().users;
        }
    },

    async getUserById(id) {
        if (useMySQL) {
            const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
            return rows[0] || null;
        } else {
            const users = readJsonDb().users;
            return users.find(u => u.id === parseInt(id)) || null;
        }
    },

    async getUserByEmail(email) {
        if (useMySQL) {
            const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
            return rows[0] || null;
        } else {
            const users = readJsonDb().users;
            return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
        }
    },

    async createUser(userData) {
        if (useMySQL) {
            const [result] = await pool.execute(
                'INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)',
                [userData.email, userData.password, userData.role, userData.name]
            );
            return result.insertId;
        } else {
            const data = readJsonDb();
            const newId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
            const newUser = {
                id: newId,
                email: userData.email,
                password: userData.password,
                role: userData.role,
                name: userData.name,
                resume_path: null,
                skills: null,
                experience: null,
                title: null,
                created_at: new Date().toISOString()
            };
            data.users.push(newUser);
            writeJsonDb(data);
            return newId;
        }
    },

    async updateUser(id, userData) {
        if (useMySQL) {
            const fields = [];
            const params = [];
            for (const key of ['name', 'email', 'password', 'resume_path', 'skills', 'experience', 'title']) {
                if (userData[key] !== undefined) {
                    fields.push(`${key} = ?`);
                    params.push(userData[key]);
                }
            }
            if (fields.length === 0) return true;
            params.push(id);
            await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
            return true;
        } else {
            const data = readJsonDb();
            const idx = data.users.findIndex(u => u.id === parseInt(id));
            if (idx === -1) return false;
            
            data.users[idx] = {
                ...data.users[idx],
                ...userData
            };
            writeJsonDb(data);
            return true;
        }
    },

    async deleteUser(id) {
        if (useMySQL) {
            // Delete dependent records first to handle foreign keys properly
            const [user] = await pool.execute('SELECT role FROM users WHERE id = ?', [id]);
            if (user && user[0]) {
                if (user[0].role === 'Recruiter') {
                    // Find company and delete its jobs
                    const [companies] = await pool.execute('SELECT id FROM companies WHERE recruiter_id = ?', [id]);
                    for (const comp of companies) {
                        await pool.execute('DELETE FROM jobs WHERE company_id = ?', [comp.id]);
                        await pool.execute('DELETE FROM companies WHERE id = ?', [comp.id]);
                    }
                } else if (user[0].role === 'User') {
                    await pool.execute('DELETE FROM applications WHERE user_id = ?', [id]);
                }
            }
            await pool.execute('DELETE FROM users WHERE id = ?', [id]);
            return true;
        } else {
            const data = readJsonDb();
            const uid = parseInt(id);
            const user = data.users.find(u => u.id === uid);
            if (!user) return false;

            if (user.role === 'Recruiter') {
                const comps = data.companies.filter(c => c.recruiter_id === uid);
                const compIds = comps.map(c => c.id);
                // remove jobs
                data.jobs = data.jobs.filter(j => !compIds.includes(j.company_id));
                // remove companies
                data.companies = data.companies.filter(c => c.recruiter_id !== uid);
            } else if (user.role === 'User') {
                data.applications = data.applications.filter(a => a.user_id !== uid);
            }
            data.users = data.users.filter(u => u.id !== uid);
            writeJsonDb(data);
            return true;
        }
    },

    // --- COMPANIES ---
    async getCompanies() {
        if (useMySQL) {
            const [rows] = await pool.execute('SELECT * FROM companies');
            return rows;
        } else {
            return readJsonDb().companies;
        }
    },

    async getCompanyById(id) {
        if (useMySQL) {
            const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [id]);
            return rows[0] || null;
        } else {
            const companies = readJsonDb().companies;
            return companies.find(c => c.id === parseInt(id)) || null;
        }
    },

    async getCompanyByRecruiterId(recruiterId) {
        if (useMySQL) {
            const [rows] = await pool.execute('SELECT * FROM companies WHERE recruiter_id = ?', [recruiterId]);
            return rows[0] || null;
        } else {
            const companies = readJsonDb().companies;
            return companies.find(c => c.recruiter_id === parseInt(recruiterId)) || null;
        }
    },

    async createCompany(compData) {
        if (useMySQL) {
            const [result] = await pool.execute(
                'INSERT INTO companies (recruiter_id, name, description, website, location, logo) VALUES (?, ?, ?, ?, ?, ?)',
                [compData.recruiter_id, compData.name, compData.description || '', compData.website || '', compData.location || '', compData.logo || '']
            );
            return result.insertId;
        } else {
            const data = readJsonDb();
            const newId = data.companies.length > 0 ? Math.max(...data.companies.map(c => c.id)) + 1 : 1;
            const newComp = {
                id: newId,
                recruiter_id: parseInt(compData.recruiter_id),
                name: compData.name,
                description: compData.description || '',
                website: compData.website || '',
                location: compData.location || '',
                logo: compData.logo || '',
                created_at: new Date().toISOString()
            };
            data.companies.push(newComp);
            writeJsonDb(data);
            return newId;
        }
    },

    async updateCompany(id, compData) {
        if (useMySQL) {
            const fields = [];
            const params = [];
            for (const key of ['name', 'description', 'website', 'location', 'logo']) {
                if (compData[key] !== undefined) {
                    fields.push(`${key} = ?`);
                    params.push(compData[key]);
                }
            }
            if (fields.length === 0) return true;
            params.push(id);
            await pool.execute(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`, params);
            return true;
        } else {
            const data = readJsonDb();
            const idx = data.companies.findIndex(c => c.id === parseInt(id));
            if (idx === -1) return false;
            
            data.companies[idx] = {
                ...data.companies[idx],
                ...compData
            };
            writeJsonDb(data);
            return true;
        }
    },

    // --- JOBS ---
    async getJobs(filters = {}) {
        if (useMySQL) {
            let sql = `
                SELECT jobs.*, companies.name AS company_name, companies.location AS company_location, companies.logo AS company_logo 
                FROM jobs 
                JOIN companies ON jobs.company_id = companies.id
                WHERE 1=1
            `;
            const params = [];

            if (filters.search) {
                sql += ' AND (jobs.title LIKE ? OR jobs.description LIKE ? OR companies.name LIKE ?)';
                const term = `%${filters.search}%`;
                params.push(term, term, term);
            }
            if (filters.category) {
                sql += ' AND jobs.category = ?';
                params.push(filters.category);
            }
            if (filters.location) {
                sql += ' AND (jobs.location LIKE ? OR companies.location LIKE ?)';
                const loc = `%${filters.location}%`;
                params.push(loc, loc);
            }
            if (filters.experience_level) {
                sql += ' AND jobs.experience_level = ?';
                params.push(filters.experience_level);
            }
            if (filters.company_id) {
                sql += ' AND jobs.company_id = ?';
                params.push(filters.company_id);
            }
            if (filters.status) {
                sql += ' AND jobs.status = ?';
                params.push(filters.status);
            }

            sql += ' ORDER BY jobs.created_at DESC';
            const [rows] = await pool.execute(sql, params);
            return rows;
        } else {
            const data = readJsonDb();
            let results = data.jobs.map(j => {
                const comp = data.companies.find(c => c.id === j.company_id) || {};
                return {
                    ...j,
                    company_name: comp.name || 'Unknown Company',
                    company_location: comp.location || 'Unknown Location',
                    company_logo: comp.logo || ''
                };
            });

            if (filters.search) {
                const term = filters.search.toLowerCase();
                results = results.filter(j => 
                    j.title.toLowerCase().includes(term) || 
                    j.description.toLowerCase().includes(term) || 
                    j.company_name.toLowerCase().includes(term)
                );
            }
            if (filters.category) {
                results = results.filter(j => j.category === filters.category);
            }
            if (filters.location) {
                const loc = filters.location.toLowerCase();
                results = results.filter(j => 
                    j.location.toLowerCase().includes(loc) || 
                    j.company_location.toLowerCase().includes(loc)
                );
            }
            if (filters.experience_level) {
                results = results.filter(j => j.experience_level === filters.experience_level);
            }
            if (filters.company_id) {
                results = results.filter(j => j.company_id === parseInt(filters.company_id));
            }
            if (filters.status) {
                results = results.filter(j => j.status === filters.status);
            }

            return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
    },

    async getJobById(id) {
        if (useMySQL) {
            const sql = `
                SELECT jobs.*, companies.name AS company_name, companies.description AS company_description, 
                       companies.website AS company_website, companies.location AS company_location, companies.logo AS company_logo
                FROM jobs 
                JOIN companies ON jobs.company_id = companies.id
                WHERE jobs.id = ?
            `;
            const [rows] = await pool.execute(sql, [id]);
            return rows[0] || null;
        } else {
            const data = readJsonDb();
            const job = data.jobs.find(j => j.id === parseInt(id));
            if (!job) return null;
            const comp = data.companies.find(c => c.id === job.company_id) || {};
            return {
                ...job,
                company_name: comp.name || 'Unknown Company',
                company_description: comp.description || '',
                company_website: comp.website || '',
                company_location: comp.location || '',
                company_logo: comp.logo || ''
            };
        }
    },

    async createJob(jobData) {
        if (useMySQL) {
            const [result] = await pool.execute(
                'INSERT INTO jobs (company_id, title, category, location, salary, experience_level, description, requirements, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [jobData.company_id, jobData.title, jobData.category, jobData.location, jobData.salary, jobData.experience_level, jobData.description, jobData.requirements || '', jobData.status || 'Active']
            );
            return result.insertId;
        } else {
            const data = readJsonDb();
            const newId = data.jobs.length > 0 ? Math.max(...data.jobs.map(j => j.id)) + 1 : 1;
            const newJob = {
                id: newId,
                company_id: parseInt(jobData.company_id),
                title: jobData.title,
                category: jobData.category,
                location: jobData.location,
                salary: jobData.salary,
                experience_level: jobData.experience_level,
                description: jobData.description,
                requirements: jobData.requirements || '',
                status: jobData.status || 'Active',
                created_at: new Date().toISOString()
            };
            data.jobs.push(newJob);
            writeJsonDb(data);
            return newId;
        }
    },

    async updateJob(id, jobData) {
        if (useMySQL) {
            const fields = [];
            const params = [];
            for (const key of ['title', 'category', 'location', 'salary', 'experience_level', 'description', 'requirements', 'status']) {
                if (jobData[key] !== undefined) {
                    fields.push(`${key} = ?`);
                    params.push(jobData[key]);
                }
            }
            if (fields.length === 0) return true;
            params.push(id);
            await pool.execute(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`, params);
            return true;
        } else {
            const data = readJsonDb();
            const idx = data.jobs.findIndex(j => j.id === parseInt(id));
            if (idx === -1) return false;
            
            data.jobs[idx] = {
                ...data.jobs[idx],
                ...jobData
            };
            writeJsonDb(data);
            return true;
        }
    },

    async deleteJob(id) {
        if (useMySQL) {
            await pool.execute('DELETE FROM applications WHERE job_id = ?', [id]);
            await pool.execute('DELETE FROM jobs WHERE id = ?', [id]);
            return true;
        } else {
            const data = readJsonDb();
            const jid = parseInt(id);
            data.applications = data.applications.filter(a => a.job_id !== jid);
            data.jobs = data.jobs.filter(j => j.id !== jid);
            writeJsonDb(data);
            return true;
        }
    },

    // --- APPLICATIONS ---
    async getApplications(filters = {}) {
        if (useMySQL) {
            let sql = `
                SELECT applications.*, jobs.title AS job_title, jobs.category AS job_category, jobs.location AS job_location,
                       users.name AS applicant_name, users.email AS applicant_email, users.skills AS applicant_skills, 
                       users.experience AS applicant_experience, users.title AS applicant_title, users.resume_path AS applicant_resume_path,
                       companies.name AS company_name, companies.id AS company_id, companies.recruiter_id
                FROM applications
                JOIN jobs ON applications.job_id = jobs.id
                JOIN users ON applications.user_id = users.id
                JOIN companies ON jobs.company_id = companies.id
                WHERE 1=1
            `;
            const params = [];

            if (filters.user_id) {
                sql += ' AND applications.user_id = ?';
                params.push(filters.user_id);
            }
            if (filters.recruiter_id) {
                sql += ' AND companies.recruiter_id = ?';
                params.push(filters.recruiter_id);
            }
            if (filters.job_id) {
                sql += ' AND applications.job_id = ?';
                params.push(filters.job_id);
            }

            sql += ' ORDER BY applications.applied_at DESC';
            const [rows] = await pool.execute(sql, params);
            return rows;
        } else {
            const data = readJsonDb();
            let results = data.applications.map(a => {
                const job = data.jobs.find(j => j.id === a.job_id) || {};
                const user = data.users.find(u => u.id === a.user_id) || {};
                const comp = data.companies.find(c => c.id === job.company_id) || {};
                return {
                    ...a,
                    job_title: job.title || 'Unknown Job',
                    job_category: job.category || 'N/A',
                    job_location: job.location || 'N/A',
                    applicant_name: user.name || 'Unknown User',
                    applicant_email: user.email || '',
                    applicant_skills: user.skills || '',
                    applicant_experience: user.experience || '',
                    applicant_title: user.title || '',
                    applicant_resume_path: user.resume_path || null,
                    company_name: comp.name || 'Unknown Company',
                    company_id: comp.id || null,
                    recruiter_id: comp.recruiter_id || null
                };
            });

            if (filters.user_id) {
                results = results.filter(a => a.user_id === parseInt(filters.user_id));
            }
            if (filters.recruiter_id) {
                results = results.filter(a => a.recruiter_id === parseInt(filters.recruiter_id));
            }
            if (filters.job_id) {
                results = results.filter(a => a.job_id === parseInt(filters.job_id));
            }

            return results.sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at));
        }
    },

    async createApplication(appData) {
        if (useMySQL) {
            // Check if application already exists
            const [existing] = await pool.execute(
                'SELECT id FROM applications WHERE job_id = ? AND user_id = ?',
                [appData.job_id, appData.user_id]
            );
            if (existing && existing.length > 0) {
                throw new Error("You have already applied for this job.");
            }

            const [result] = await pool.execute(
                'INSERT INTO applications (job_id, user_id, status, resume_text) VALUES (?, ?, ?, ?)',
                [appData.job_id, appData.user_id, appData.status || 'Pending', appData.resume_text || '']
            );
            return result.insertId;
        } else {
            const data = readJsonDb();
            const jid = parseInt(appData.job_id);
            const uid = parseInt(appData.user_id);
            
            const existing = data.applications.find(a => a.job_id === jid && a.user_id === uid);
            if (existing) {
                throw new Error("You have already applied for this job.");
            }

            const newId = data.applications.length > 0 ? Math.max(...data.applications.map(a => a.id)) + 1 : 1;
            const newApp = {
                id: newId,
                job_id: jid,
                user_id: uid,
                status: appData.status || 'Pending',
                resume_text: appData.resume_text || '',
                applied_at: new Date().toISOString()
            };
            data.applications.push(newApp);
            writeJsonDb(data);
            return newId;
        }
    },

    async updateApplicationStatus(id, status) {
        if (useMySQL) {
            await pool.execute('UPDATE applications SET status = ? WHERE id = ?', [status, id]);
            return true;
        } else {
            const data = readJsonDb();
            const idx = data.applications.findIndex(a => a.id === parseInt(id));
            if (idx === -1) return false;
            
            data.applications[idx].status = status;
            writeJsonDb(data);
            return true;
        }
    },

    // --- STATISTICS FOR ADMIN ---
    async getAdminStats() {
        if (useMySQL) {
            const [[{ users }]] = await pool.execute('SELECT COUNT(*) as users FROM users WHERE role = "User"');
            const [[{ recruiters }]] = await pool.execute('SELECT COUNT(*) as recruiters FROM users WHERE role = "Recruiter"');
            const [[{ jobs }]] = await pool.execute('SELECT COUNT(*) as jobs FROM jobs');
            const [[{ applications }]] = await pool.execute('SELECT COUNT(*) as applications FROM applications');
            
            return { users, recruiters, jobs, applications };
        } else {
            const data = readJsonDb();
            const users = data.users.filter(u => u.role === 'User').length;
            const recruiters = data.users.filter(u => u.role === 'Recruiter').length;
            const jobs = data.jobs.length;
            const applications = data.applications.length;
            
            return { users, recruiters, jobs, applications };
        }
    }
};

module.exports = db;
