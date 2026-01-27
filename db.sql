CREATE DATABASE IF NOT EXISTS USE cattle_management;
USE cattle_management;
-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 27, 2026 at 07:36 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--

--

-- --------------------------------------------------------

--
-- Table structure for table `cattle`
--

CREATE TABLE `cattle` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `breed` varchar(50) NOT NULL,
  `age` int(11) NOT NULL,
  `health` varchar(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cattle`
--

INSERT INTO `cattle` (`id`, `user_id`, `name`, `breed`, `age`, `health`, `created_at`) VALUES
(1, 6, 'Rosie', 'Jersey', 4, 'Excellent', '2026-01-27 17:27:25'),
(2, 6, 'Daisy', 'Holstein', 5, 'Excellent', '2026-01-27 17:30:45'),
(3, 1, 'Sita', 'Jersey', 5, 'Fair', '2026-01-27 18:03:05');

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `category` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `expenses`
--

INSERT INTO `expenses` (`id`, `user_id`, `date`, `category`, `amount`, `created_at`) VALUES
(1, 6, '2026-01-27', 'Feed', 200.00, '2026-01-27 17:32:07'),
(2, 6, '2026-01-28', 'Medicine', 200.00, '2026-01-27 18:01:34'),
(3, 1, '2026-01-27', 'Labor', 5000.00, '2026-01-27 18:05:36');

-- --------------------------------------------------------

--
-- Table structure for table `milk_records`
--

CREATE TABLE `milk_records` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `cattle_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `milk_liters` decimal(10,2) NOT NULL,
  `rate` decimal(10,2) NOT NULL,
  `income` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `milk_records`
--

INSERT INTO `milk_records` (`id`, `user_id`, `cattle_id`, `date`, `milk_liters`, `rate`, `income`, `created_at`) VALUES
(1, 6, 1, '2026-01-27', 5.00, 50.00, 250.00, '2026-01-27 17:30:04'),
(2, 6, 1, '2026-01-27', 10.00, 50.00, 500.00, '2026-01-27 17:30:27'),
(3, 6, 2, '2026-01-27', 5.00, 50.00, 250.00, '2026-01-27 17:31:28'),
(4, 6, 2, '2026-01-27', 5.00, 10.00, 50.00, '2026-01-27 17:36:10'),
(5, 1, 3, '2026-01-27', 5.00, 40.50, 202.50, '2026-01-27 18:05:17');

-- --------------------------------------------------------

--
-- Table structure for table `otp_data`
--

CREATE TABLE `otp_data` (
  `id` int(11) NOT NULL,
  `email` varchar(150) NOT NULL,
  `otp` varchar(6) NOT NULL,
  `purpose` enum('registration','reset') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `otp_data`
--

INSERT INTO `otp_data` (`id`, `email`, `otp`, `purpose`, `created_at`) VALUES
(10, 'cattlesense1@gmail.com', '694274', 'reset', '2026-01-02 14:48:25'),
(11, 'sdafg@gmail.com', '642095', 'registration', '2026-01-02 14:49:06'),
(18, 'cattlesense4@gmail.com', '828339', 'registration', '2026-01-25 06:44:08');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password`, `created_at`) VALUES
(1, 'Maithil', '9087654321', 'maithilkorat@gmail.com', '$2b$12$tDcravw/DkRNktic93JKQ.tdooP/vwnXUsHnM3oYADUs1GALaLKgu', '2025-12-28 17:49:27'),
(2, 'Mair', '9876543211', 'cattlesense1@gmail.com', '$2b$12$JedCQlnDJRM1YJQkfEmPHO4z6OU4bTHZMKNsLllZTPF6M7phLQQhS', '2026-01-02 14:47:06'),
(4, 'sfahg', '9876543212', 'patelvaishali2006@gmail.com', '$2b$12$MMnGPIShWxZQI4d0TqyWzeubynhl.Pkocz4ERHpmxDUcy3xkYU1IO', '2026-01-04 08:03:46'),
(5, 'Virat Kohli', '9876543234', 'cattlesense2@gmail.com', '$2b$12$MobFXPBklBbdlSEuxHZt9.EMAJWIfCIbv42ARq2o6B4ZQ8qYMuz0.', '2026-01-04 13:34:07'),
(6, 'Korat Maithil', '7823678687', 'maithilkorat2006@gmail.com', '$2b$12$JC9MpsP968VYF8yrs3zE1u3tBwXJaqiTAFxizjLwrZZWxrbpPS81K', '2026-01-25 13:48:39');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cattle`
--
ALTER TABLE `cattle`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_date` (`user_id`,`date`);

--
-- Indexes for table `milk_records`
--
ALTER TABLE `milk_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_date` (`user_id`,`date`),
  ADD KEY `idx_cattle_date` (`cattle_id`,`date`);

--
-- Indexes for table `otp_data`
--
ALTER TABLE `otp_data`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `cattle`
--
ALTER TABLE `cattle`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `expenses`
--
ALTER TABLE `expenses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `milk_records`
--
ALTER TABLE `milk_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `otp_data`
--
ALTER TABLE `otp_data`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `cattle`
--
ALTER TABLE `cattle`
  ADD CONSTRAINT `cattle_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `milk_records`
--
ALTER TABLE `milk_records`
  ADD CONSTRAINT `milk_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `milk_records_ibfk_2` FOREIGN KEY (`cattle_id`) REFERENCES `cattle` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
