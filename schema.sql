-- MySQL Database Schema for Job Market Portal
CREATE DATABASE IF NOT EXISTS job_market;
USE job_market;

-- Table for Users (Admin, Recruiter, Job Seeker)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Recruiter', 'User') NOT NULL,
    name VARCHAR(255) NOT NULL,
    resume_path VARCHAR(255) DEFAULT NULL,
    skills TEXT DEFAULT NULL,
    experience VARCHAR(100) DEFAULT NULL,
    title VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Companies (Recruiter profiles)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recruiter_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    location VARCHAR(255),
    logo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table for Job Openings
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    salary VARCHAR(100) NOT NULL,
    experience_level VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Table for Applications
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('Pending', 'Interviewing', 'Offered', 'Rejected') DEFAULT 'Pending',
    resume_text TEXT DEFAULT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
