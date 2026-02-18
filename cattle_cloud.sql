-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 17, 2026 at 02:48 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

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
(2, 1, 'None', 'Bella', 'Jersey', 5, 'Female', 'Fair', NULL, '2026-02-05 15:00:46'),
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
(1, 1, '2026-02-05', 'Feed', NULL, 200.00, '2026-02-05 13:24:04'),
(2, 1, '2026-02-14', 'Maintenance', 'reparing cost', 1000.00, '2026-02-14 13:37:57'),
(3, 1, '2026-02-14', 'Equipment', 'Dori', 200.00, '2026-02-14 14:20:16'),
(4, 1, '2025-12-30', 'Feed', 'Silage ', 600.00, '2026-02-14 14:44:57'),
(5, 1, '2026-02-14', 'Feed', 'Fodder', 12.00, '2026-02-14 15:04:01'),
(6, 1, '2026-02-14', 'Feed', 'Feed Stock Purchase - Green Fodder (200.0 kg)', 2000.00, '2026-02-14 17:31:12'),
(7, 1, '2026-02-14', 'Utilities', 'nothing much', 500.00, '2026-02-14 17:36:13'),
(8, 1, '2026-02-14', 'Feed', 'Feed Stock Purchase - Fodder (200.0 kg)', 2000.00, '2026-02-14 17:53:56'),
(9, 1, '2026-02-15', 'Feed', 'Feed Stock Purchase - Whaet (500.0 kg)', 3750.00, '2026-02-14 19:33:12'),
(10, 1, NULL, 'Health', 'Vet: ZZXV — dsG (Daisy)', 3400.00, '2026-02-17 12:17:27'),
(11, 1, NULL, 'Health', 'Vet: wrvwds — cwdrv (Bella)', 400.00, '2026-02-17 12:18:22'),
(12, 1, '2026-02-17', 'Feed', 'Feed Stock Purchase - corn (400.0 kg)', 8000.00, '2026-02-17 13:15:32');

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
(1, 1, 'Fodder', 202.00, 5.00, 10.00, '2026-02-14 17:53:56'),
(2, 1, 'Whaet', 437.00, 5.00, 7.50, '2026-02-17 13:14:20'),
(4, 1, 'Halwa', 278.00, 5.00, 50.00, '2026-02-17 12:11:02'),
(5, 1, 'Silage', 393.00, 50.00, 10.00, '2026-02-15 14:45:29'),
(6, 1, 'Green Fodder', 185.00, 20.00, 10.00, '2026-02-14 17:38:02'),
(7, 1, 'corn', 277.00, 20.00, 20.00, '2026-02-17 13:16:37');

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
(2, 1, 3, NULL, 4.00, '2026-02-08', '2026-02-08 10:05:11'),
(3, 1, 4, NULL, 200.00, '2026-02-14', '2026-02-14 14:58:41'),
(4, 1, 4, 2, 10.00, '2026-02-14', '2026-02-14 15:01:48'),
(5, 1, 2, NULL, 4.00, '2026-02-14', '2026-02-14 15:02:35'),
(6, 1, 1, 1, 4.00, '2026-02-14', '2026-02-14 15:05:18'),
(7, 1, 1, 3, 4.00, '2026-02-14', '2026-02-14 15:07:34'),
(8, 1, 5, NULL, 15.00, '2026-02-15', '2026-02-14 17:17:50'),
(9, 1, 6, NULL, 15.00, '2026-02-09', '2026-02-14 17:38:02'),
(10, 1, 5, NULL, 85.00, '2026-02-08', '2026-02-14 17:38:29'),
(11, 1, 5, 3, 7.00, '2026-02-15', '2026-02-15 14:45:29'),
(12, 1, 4, 2, 12.00, '2026-02-17', '2026-02-17 12:11:02'),
(13, 1, 2, 3, 14.00, '2026-02-17', '2026-02-17 13:13:47'),
(14, 1, 2, 1, 31.00, '2026-02-17', '2026-02-17 13:14:04'),
(15, 1, 2, 2, 19.00, '2026-02-17', '2026-02-17 13:14:20'),
(16, 1, 7, NULL, 123.00, '2026-01-21', '2026-02-17 13:16:37');

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
  `treatment_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `health_records`
--

INSERT INTO `health_records` (`id`, `user_id`, `cattle_id`, `issue`, `treatment`, `vet_name`, `next_checkup`, `treatment_cost`, `created_at`) VALUES
(1, 1, 1, 'Poor', 'Under', 'Dr.Myself', '2026-02-07', 0.00, '2026-02-06 06:34:39'),
(2, 1, 1, 'Fever', 'Under', 'Myself', '2026-02-07', 0.00, '2026-02-06 06:37:44'),
(3, 1, 1, 'Fever', 'Under', 'self', '2026-02-07', 0.00, '2026-02-06 06:39:32'),
(4, 1, 3, 'Sick', 'under', 'Myself', '2026-02-08', 0.00, '2026-02-06 18:54:19'),
(5, 1, 3, 'sdgasdg', 'sdg', 'asdg', NULL, 0.00, '2026-02-14 18:12:57'),
(6, 1, 1, 'Nothing', 'TUjhe kya lena dena', 'mai khud ', NULL, 0.00, '2026-02-14 19:10:08'),
(7, 1, 3, 'Alert dekhna ka liya', 'aisa', 'kya', '2026-02-15', 0.00, '2026-02-14 19:35:41'),
(8, 1, 3, 'kuchi', 'gsd', 'jdgha', '2026-02-18', 0.00, '2026-02-17 11:46:32'),
(9, 1, 3, 'dsG', 'Scv', 'ZZXV', '2026-02-18', 3400.00, '2026-02-17 12:17:27'),
(10, 1, 2, 'cwdrv', 'vwrev', 'wrvwds', NULL, 400.00, '2026-02-17 12:18:22');

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
(15, 1, 3, '2026-02-08', 8.50, 4.50, 45.00, 585.00, '2026-02-08 06:18:44'),
(22, 1, 2, '2026-02-15', 6.70, 5.00, 43.00, 503.10, '2026-02-15 14:05:45'),
(23, 1, 3, '2026-02-14', 5.00, 8.00, 42.00, 546.00, '2026-02-15 14:44:24'),
(24, 1, 3, '2026-02-15', 8.70, 7.00, 42.50, 667.25, '2026-02-15 14:45:01'),
(26, 1, 3, '2026-02-16', 5.50, 6.50, 41.25, 495.00, '2026-02-17 11:25:58'),
(27, 1, 2, '0000-00-00', 8.00, 4.00, 43.00, 516.00, '2026-02-17 12:50:42'),
(28, 1, 3, '0000-00-00', 5.50, 7.50, 42.00, 546.00, '2026-02-17 12:53:17'),
(29, 1, 2, '2026-02-17', 5.00, 5.00, 42.00, 420.00, '2026-02-17 12:54:12'),
(31, 1, 3, '2026-02-17', 7.50, 1.40, 10.00, 89.00, '2026-02-17 13:27:32');

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `feed_stock`
--
ALTER TABLE `feed_stock`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `feed_usage`
--
ALTER TABLE `feed_usage`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `health_records`
--
ALTER TABLE `health_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `milk_records`
--
ALTER TABLE `milk_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

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
