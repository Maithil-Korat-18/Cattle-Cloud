
CREATE DATABASE IF NOT EXISTS cattle_project;
USE cattle_project;

CREATE TABLE IF NOT EXISTS student (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(15) UNIQUE,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255),
    user_type VARCHAR(50) DEFAULT 'user',
    is_verified TINYINT(1) DEFAULT 1,
    google_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    purpose ENUM('registration','reset') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cattle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tag_number VARCHAR(50) UNIQUE,
    breed VARCHAR(100),
    age INT,
    weight DECIMAL(6,2),
    gender ENUM('male','female'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES student(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS milk_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cattle_id INT NOT NULL,
    milk_date DATE NOT NULL,
    morning_milk DECIMAL(5,2),
    evening_milk DECIMAL(5,2),
    total_milk DECIMAL(6,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_message TEXT,
    bot_reply TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES student(id) ON DELETE CASCADE
);
