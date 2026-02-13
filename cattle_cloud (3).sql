-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 08, 2026 at 04:23 PM
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
-- Database: `cattle_cloud`
--

-- --------------------------------------------------------

--
-- Table structure for table `cattle`
--

CREATE TABLE `cattle` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `tag_no` varchar(50) DEFAULT NULL,
  `name` varchar(50) DEFAULT NULL,
  `breed` varchar(50) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `gender` enum('Male','Female') DEFAULT 'Female',
  `health` enum('Good','Fair','Poor') DEFAULT 'Good',
  `purchase_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cattle`
--

INSERT INTO `cattle` (`id`, `user_id`, `tag_no`, `name`, `breed`, `age`, `gender`, `health`, `purchase_date`, `created_at`) VALUES
(1, 1, NULL, 'Luna', 'Gir', 5, 'Female', 'Good', NULL, '2026-02-05 13:23:20'),
(2, 1, NULL, 'Bella', 'Jersey', 5, 'Female', 'Poor', NULL, '2026-02-05 15:00:46'),
(3, 1, 'C01', 'Daisy', 'Holstein', 6, 'Male', 'Good', '2026-02-05', '2026-02-05 15:01:10');

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date` date DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `amount` decimal(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `expenses`
--

INSERT INTO `expenses` (`id`, `user_id`, `date`, `category`, `description`, `amount`, `created_at`) VALUES
(1, 1, '2026-02-05', 'Feed', NULL, 200.00, '2026-02-05 13:24:04');

-- --------------------------------------------------------

--
-- Table structure for table `feed_stock`
--

CREATE TABLE `feed_stock` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `feed_name` varchar(100) DEFAULT NULL,
  `quantity` decimal(8,2) DEFAULT NULL,
  `min_quantity` decimal(8,2) DEFAULT NULL,
  `cost_per_kg` decimal(6,2) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `feed_stock`
--

INSERT INTO `feed_stock` (`id`, `user_id`, `feed_name`, `quantity`, `min_quantity`, `cost_per_kg`, `updated_at`) VALUES
(1, 1, 'Fodder', 10.00, 6.00, 15.00, '2026-02-08 10:02:26'),
(2, 1, 'Whaet', 5.00, 4.00, 50.00, '2026-02-08 05:13:37');

-- --------------------------------------------------------

--
-- Table structure for table `feed_usage`
--

CREATE TABLE `feed_usage` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `feed_id` int(11) NOT NULL,
  `cattle_id` int(11) DEFAULT NULL,
  `quantity_used` decimal(10,2) NOT NULL,
  `usage_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `feed_usage`
--

INSERT INTO `feed_usage` (`id`, `user_id`, `feed_id`, `cattle_id`, `quantity_used`, `usage_date`, `created_at`) VALUES
(1, 1, 1, 3, 5.00, '2026-02-06', '2026-02-06 18:51:56'),
(2, 1, 3, NULL, 4.00, '2026-02-08', '2026-02-08 10:05:11');

-- --------------------------------------------------------

--
-- Table structure for table `health_records`
--

CREATE TABLE `health_records` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `cattle_id` int(11) NOT NULL,
  `issue` varchar(100) DEFAULT NULL,
  `treatment` varchar(255) DEFAULT NULL,
  `vet_name` varchar(100) DEFAULT NULL,
  `next_checkup` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `health_records`
--

INSERT INTO `health_records` (`id`, `user_id`, `cattle_id`, `issue`, `treatment`, `vet_name`, `next_checkup`, `created_at`) VALUES
(1, 1, 1, 'Poor', 'Under', 'Dr.Myself', '2026-02-07', '2026-02-06 06:34:39'),
(2, 1, 1, 'Fever', 'Under', 'Myself', '2026-02-07', '2026-02-06 06:37:44'),
(3, 1, 1, 'Fever', 'Under', 'self', '2026-02-07', '2026-02-06 06:39:32'),
(4, 1, 3, 'Sick', 'under', 'Myself', '2026-02-08', '2026-02-06 18:54:19');

-- --------------------------------------------------------

--
-- Table structure for table `milk_records`
--

CREATE TABLE `milk_records` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `cattle_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `morning_liters` decimal(5,2) DEFAULT 0.00,
  `evening_liters` decimal(5,2) DEFAULT 0.00,
  `milk_liters` decimal(5,2) GENERATED ALWAYS AS (`morning_liters` + `evening_liters`) STORED,
  `rate` decimal(6,2) NOT NULL,
  `income` decimal(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `milk_records`
--

INSERT INTO `milk_records` (`id`, `user_id`, `cattle_id`, `date`, `morning_liters`, `evening_liters`, `rate`, `income`, `created_at`) VALUES
(2, 1, 1, '2026-02-05', 8.50, 7.50, 0.00, 0.00, '2026-02-05 14:25:54'),
(3, 1, 1, '2026-02-06', 8.50, 9.50, 0.00, 0.00, '2026-02-05 14:26:43'),
(4, 1, 1, '2026-02-04', 7.50, 5.00, 50.00, 625.00, '2026-02-05 14:33:10'),
(5, 1, 1, '2026-02-03', 6.50, 7.50, 41.50, 581.00, '2026-02-05 14:33:47'),
(6, 1, 3, '2026-02-06', 5.50, 8.50, 33.00, 462.00, '2026-02-06 16:40:54'),
(7, 1, 3, '2026-02-01', 7.00, 5.00, 35.00, 420.00, '2026-02-06 16:52:39'),
(8, 1, 3, '2026-02-02', 10.50, 11.50, 40.00, 880.00, '2026-02-06 16:53:07'),
(9, 1, 3, '2026-02-06', 1.50, 2.50, 15.00, 60.00, '2026-02-06 16:55:47'),
(10, 1, 3, '2026-02-07', 1.50, 2.50, 15.00, 60.00, '2026-02-06 16:56:07'),
(11, 1, 3, '2026-02-07', 10.50, 9.50, 45.00, 900.00, '2026-02-08 06:16:34'),
(12, 1, 3, '2026-02-03', 5.50, 6.50, 45.00, 540.00, '2026-02-08 06:17:16'),
(13, 1, 3, '2026-02-04', 7.50, 8.50, 40.00, 640.00, '2026-02-08 06:17:55'),
(14, 1, 3, '2026-02-05', 7.50, 6.50, 45.00, 630.00, '2026-02-08 06:18:27'),
(15, 1, 3, '2026-02-08', 8.50, 4.50, 45.00, 585.00, '2026-02-08 06:18:44');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` enum('info','warning','alert','success') DEFAULT NULL,
  `message` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `phone`, `password`, `created_at`) VALUES
(1, 'Maithil Korat', 'maithilkorat@gmail.com', '8160312843', '$2b$12$dY5qXWCaHZLLXbWECwLbTe1f/qQDpzwPknIT9tKKdhI1elVU3PJA6', '2026-02-05 13:22:34');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cattle`
--
ALTER TABLE `cattle`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tag_no` (`tag_no`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `feed_stock`
--
ALTER TABLE `feed_stock`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `feed_usage`
--
ALTER TABLE `feed_usage`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `health_records`
--
ALTER TABLE `health_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `cattle_id` (`cattle_id`);

--
-- Indexes for table `milk_records`
--
ALTER TABLE `milk_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `cattle_id` (`cattle_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `feed_stock`
--
ALTER TABLE `feed_stock`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `feed_usage`
--
ALTER TABLE `feed_usage`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `health_records`
--
ALTER TABLE `health_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `milk_records`
--
ALTER TABLE `milk_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `otp_data`
--
ALTER TABLE `otp_data`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
  ADD CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `feed_stock`
--
ALTER TABLE `feed_stock`
  ADD CONSTRAINT `feed_stock_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `health_records`
--
ALTER TABLE `health_records`
  ADD CONSTRAINT `health_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `health_records_ibfk_2` FOREIGN KEY (`cattle_id`) REFERENCES `cattle` (`id`);

--
-- Constraints for table `milk_records`
--
ALTER TABLE `milk_records`
  ADD CONSTRAINT `milk_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `milk_records_ibfk_2` FOREIGN KEY (`cattle_id`) REFERENCES `cattle` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
