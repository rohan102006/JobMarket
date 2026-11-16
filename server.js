const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Create public directories if they do not exist
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static frontend files
app.use(express.static(publicDir));

// Multer storage configuration for resume file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /pdf|doc|docx|txt/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Resumes must be in PDF, Word (DOC/DOCX), or Text format.'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware for authentication validation
const authMiddleware = async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized: Missing user credentials." });
    }
    try {
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(401).json({ error: "Unauthorized: Invalid user session." });
        }
        req.user = user;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Middleware to restrict access by role
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: `Forbidden: Access restricted to roles: ${allowedRoles.join(', ')}.` });
        }
        next();
    };
};

// --- API ENDPOINTS ---

// Auth - Register
app.post('/api/auth/register', async (req, res) => {
    const { email, password, role, name } = req.body;
    if (!email || !password || !role || !name) {
        return res.status(400).json({ error: "Please fill in all required fields." });
    }
    if (!['User', 'Recruiter'].includes(role)) {
        return res.status(400).json({ error: "Invalid role selected." });
    }

    try {
        const existing = await db.getUserByEmail(email);
        if (existing) {
            return res.status(400).json({ error: "Email is already registered." });
        }

        const userId = await db.createUser({ email, password, role, name });

        // If recruiter, automatically create a default company profile
        if (role === 'Recruiter') {
            await db.createCompany({
                recruiter_id: userId,
                name: `${name}'s Company`,
                description: "Describe your company here...",
                website: "https://",
                location: "Remote",
                logo: ""
            });
        }

        res.status(201).json({ success: true, message: "Account created successfully!", userId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth - Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ error: "Please fill in all credentials." });
    }

    try {
        const user = await db.getUserByEmail(email);
        if (!user || user.password !== password || user.role !== role) {
            return res.status(401).json({ error: "Invalid email, password, or role selection." });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth - Get current user profile
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        // Return profile detail
        res.json(req.user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth - Update user profile (Job Seeker / Admin details)
app.put('/api/profile', authMiddleware, async (req, res) => {
    const { name, email, password, skills, experience, title } = req.body;
    try {
        const updateData = {};
        if (name) updateData.name = name;
        if (email) {
            const existing = await db.getUserByEmail(email);
            if (existing && existing.id !== req.user.id) {
                return res.status(400).json({ error: "Email is already in use by another account." });
            }
            updateData.email = email;
        }
        if (password) updateData.password = password;
        
        // Seeker specific profile updates
        if (req.user.role === 'User') {
            if (skills !== undefined) updateData.skills = skills;
            if (experience !== undefined) updateData.experience = experience;
            if (title !== undefined) updateData.title = title;
        }

        await db.updateUser(req.user.id, updateData);
        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth - Resume Upload (Job Seeker only)
app.post('/api/profile/upload-resume', authMiddleware, roleMiddleware(['User']), upload.single('resume'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Please upload a valid file." });
    }

    try {
        const resumePath = '/uploads/' + req.file.filename;
        await db.updateUser(req.user.id, { resume_path: resumePath });
        res.json({ success: true, message: "Resume uploaded successfully!", resumePath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Company - Get company profile (For recruiters)
app.get('/api/company', authMiddleware, roleMiddleware(['Recruiter']), async (req, res) => {
    try {
        const company = await db.getCompanyByRecruiterId(req.user.id);
        if (!company) {
            return res.status(404).json({ error: "Company profile not found." });
        }
        res.json(company);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Company - Update company details (For recruiters)
app.put('/api/company', authMiddleware, roleMiddleware(['Recruiter']), async (req, res) => {
    const { name, description, website, location, logo } = req.body;
    try {
        const company = await db.getCompanyByRecruiterId(req.user.id);
        if (!company) {
            // Create profile if missing for some reason
            const newId = await db.createCompany({
                recruiter_id: req.user.id,
                name,
                description,
                website,
                location,
                logo
            });
            return res.json({ success: true, message: "Company profile created!", companyId: newId });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (website !== undefined) updateData.website = website;
        if (location !== undefined) updateData.location = location;
        if (logo !== undefined) updateData.logo = logo;

        await db.updateCompany(company.id, updateData);
        res.json({ success: true, message: "Company profile updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Jobs - Get all jobs with filters
app.get('/api/jobs', async (req, res) => {
    const { search, category, location, experience_level, company_id, status } = req.query;
    try {
        const jobs = await db.getJobs({ search, category, location, experience_level, company_id, status });
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Jobs - Get single job
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const job = await db.getJobById(req.params.id);
        if (!job) {
            return res.status(404).json({ error: "Job opening not found." });
        }
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Jobs - Create job (Recruiter only)
app.post('/api/jobs', authMiddleware, roleMiddleware(['Recruiter']), async (req, res) => {
    const { title, category, location, salary, experience_level, description, requirements } = req.body;
    if (!title || !category || !location || !salary || !experience_level || !description) {
        return res.status(400).json({ error: "Please fill in all required job fields." });
    }

    try {
        const company = await db.getCompanyByRecruiterId(req.user.id);
        if (!company) {
            return res.status(400).json({ error: "Please complete your Company Profile before posting a job." });
        }

        const jobId = await db.createJob({
            company_id: company.id,
            title,
            category,
            location,
            salary,
            experience_level,
            description,
            requirements
        });

        res.status(201).json({ success: true, message: "Job vacancy posted successfully!", jobId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Jobs - Update job (Recruiter only)
app.put('/api/jobs/:id', authMiddleware, roleMiddleware(['Recruiter']), async (req, res) => {
    const { title, category, location, salary, experience_level, description, requirements, status } = req.body;
    try {
        const job = await db.getJobById(req.params.id);
        if (!job) {
            return res.status(404).json({ error: "Job not found." });
        }

        const company = await db.getCompanyByRecruiterId(req.user.id);
        if (!company || job.company_id !== company.id) {
            return res.status(403).json({ error: "Forbidden: You are not authorized to update this job." });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (category) updateData.category = category;
        if (location) updateData.location = location;
        if (salary) updateData.salary = salary;
        if (experience_level) updateData.experience_level = experience_level;
        if (description) updateData.description = description;
        if (requirements !== undefined) updateData.requirements = requirements;
        if (status) updateData.status = status;

        await db.updateJob(req.params.id, updateData);
        res.json({ success: true, message: "Job post updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Jobs - Delete job (Recruiter / Admin)
app.delete('/api/jobs/:id', authMiddleware, roleMiddleware(['Recruiter', 'Admin']), async (req, res) => {
    try {
        const job = await db.getJobById(req.params.id);
        if (!job) {
            return res.status(404).json({ error: "Job not found." });
        }

        if (req.user.role === 'Recruiter') {
            const company = await db.getCompanyByRecruiterId(req.user.id);
            if (!company || job.company_id !== company.id) {
                return res.status(403).json({ error: "Forbidden: You do not own this job posting." });
            }
        }

        await db.deleteJob(req.params.id);
        res.json({ success: true, message: "Job opening removed successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Applications - Submit application (Job Seeker only)
app.post('/api/jobs/:id/apply', authMiddleware, roleMiddleware(['User']), async (req, res) => {
    const { resume_text } = req.body;
    try {
        const job = await db.getJobById(req.params.id);
        if (!job || job.status !== 'Active') {
            return res.status(400).json({ error: "This job opening is inactive or no longer exists." });
        }

        const jobId = parseInt(req.params.id);
        const appId = await db.createApplication({
            job_id: jobId,
            user_id: req.user.id,
            resume_text: resume_text || `Applied using profile details.\nExperience: ${req.user.experience || 'N/A'}\nSkills: ${req.user.skills || 'N/A'}`
        });

        res.status(201).json({ success: true, message: "Application submitted successfully!", applicationId: appId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Applications - List applications (Seeker, Recruiter, Admin views)
app.get('/api/applications', authMiddleware, async (req, res) => {
    try {
        const filters = {};
        if (req.user.role === 'User') {
            filters.user_id = req.user.id;
        } else if (req.user.role === 'Recruiter') {
            filters.recruiter_id = req.user.id;
        }
        // Admin gets all by default, no filters

        const apps = await db.getApplications(filters);
        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Applications - Update Status (Recruiter only)
app.put('/api/applications/:id/status', authMiddleware, roleMiddleware(['Recruiter']), async (req, res) => {
    const { status } = req.body;
    if (!['Pending', 'Interviewing', 'Offered', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value." });
    }

    try {
        // Verify application ownership (does this recruiter own the company that posted the job?)
        const apps = await db.getApplications({ recruiter_id: req.user.id });
        const appMatches = apps.some(a => a.id === parseInt(req.params.id));
        if (!appMatches) {
            return res.status(403).json({ error: "Forbidden: You do not manage this applicant's application." });
        }

        await db.updateApplicationStatus(req.params.id, status);
        res.json({ success: true, message: `Applicant status set to: ${status}!` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - Statistics
app.get('/api/admin/stats', authMiddleware, roleMiddleware(['Admin']), async (req, res) => {
    try {
        const stats = await db.getAdminStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - List Users
app.get('/api/admin/users', authMiddleware, roleMiddleware(['Admin']), async (req, res) => {
    try {
        const allUsers = await db.getUsers();
        const seekers = allUsers.filter(u => u.role === 'User');
        res.json(seekers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - Delete Seeker
app.delete('/api/admin/users/:id', authMiddleware, roleMiddleware(['Admin']), async (req, res) => {
    try {
        const user = await db.getUserById(req.params.id);
        if (!user || user.role !== 'User') {
            return res.status(404).json({ error: "Job seeker not found." });
        }
        await db.deleteUser(req.params.id);
        res.json({ success: true, message: "Job seeker deleted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - List Recruiters
app.get('/api/admin/recruiters', authMiddleware, roleMiddleware(['Admin']), async (req, res) => {
    try {
        const allUsers = await db.getUsers();
        const recruiters = allUsers.filter(u => u.role === 'Recruiter');
        
        // Attach company detail
        const reps = [];
        for (const rec of recruiters) {
            const comp = await db.getCompanyByRecruiterId(rec.id) || {};
            reps.push({
                id: rec.id,
                name: rec.name,
                email: rec.email,
                company_name: comp.name || 'N/A',
                company_location: comp.location || 'N/A',
                created_at: rec.created_at
            });
        }
        res.json(reps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - Delete Recruiter
app.delete('/api/admin/recruiters/:id', authMiddleware, roleMiddleware(['Admin']), async (req, res) => {
    try {
        const user = await db.getUserById(req.params.id);
        if (!user || user.role !== 'Recruiter') {
            return res.status(404).json({ error: "Recruiter not found." });
        }
        await db.deleteUser(req.params.id);
        res.json({ success: true, message: "Recruiter and associated jobs deleted." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend routing fallback (helps SPA-like refresh actions if needed)
app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

// Catch errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message });
});

// Database and Server Launch
db.connectDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Job Market server successfully started and running on http://localhost:${PORT}`);
    });
});
