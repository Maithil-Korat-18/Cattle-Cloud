# 🐄 Cattle-Cloud — Smart Dairy Farm Management System

**Cattle-Cloud** is a full-stack web application designed to help dairy farmers manage their cattle, milk production, feed usage, and farm finances efficiently from a single platform.

It provides **real-time analytics, stock tracking, and financial insights** with a clean and modern UI.

---

## 🚀 Features

### 🐄 Cattle Management

* Add, update, and manage cattle records
* Store tag number, breed, and profile details
* Individual cattle performance tracking

### 🥛 Milk Production Tracking

* Daily milk entry per cattle
* Automatic income calculation
* Production history and trend analysis

### 🌿 Feed Management

* Record feed given to cattle
* Maintain feed stock inventory
* Low stock alerts system
* Feed cost calculation
* Feed usage analytics

### 💰 Financial Management

* Track income from milk sales
* Record daily expenses
* Calculate net profit automatically
* Cash flow analysis (Revenue vs Expense)
* Transaction history with filters

### 📊 Analytics Dashboard

* Milk production graphs
* Feed usage charts
* Revenue vs expense visualization
* Cattle-wise performance comparison

### 📄 Report Generation

* Generate PDF reports for:

  * Feed usage
  * Financial summary
  * Transaction history
  * Stock inventory

---

## 🛠️ Tech Stack

### Backend

* Python (Flask)
* MySQL Database
* REST API Architecture

### Frontend

* HTML5 + CSS3
* Tailwind CSS
* JavaScript (Vanilla)
* Chart.js (Graphs)

### Libraries

* jsPDF (PDF reports)
* jsPDF-AutoTable
* Material Icons

---

## 📂 Project Structure

```
Cattle-Cloud/
│
├── app.py
├── db.py
├── login.py
├── mail_utils.py
│
├── routes/
│   ├── cattle.py
│   ├── cattle_detail.py
│   ├── dashboard.py
│   ├── milk_records.py
│   ├── feed.py
│   └── expenses.py
│
├── templates/
│   ├── dashboard.html
│   ├── cattle.html
│   ├── cattle_detail.html
│   ├── milk_records.html
│   ├── landing.html
│   ├── login.html
│   ├── feed.html
│   └── expenses.html
│
├── static/
│   ├── css/
│   ├── js/
│   └── images/
│
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Clone Repository

```
git clone https://github.com/your-username/cattle-cloud.git
cd cattle-cloud 
```

### 2. Create Virtual Environment

```
python -m venv venv
venv\Scripts\activate      (Windows)
source venv/bin/activate   (Linux/Mac)
```

### 3. Install Requirements

```
pip install -r requirements.txt
```

### 4. Setup MySQL Database

Create database:

```
CREATE DATABASE cattle_cloud;
```

Update your `db.py` file:

```
host="localhost"
user="root"
password=""
database="cattle_cloud"
```

### 5. Run Application

```
python app.py
```

Open in browser:

```
http://localhost:5000
```

---

## 📊 Modules Overview

| Module     | Description                 |
| ---------- | --------------------------- |
| Dashboard  | Farm analytics overview     |
| Cattle     | Manage herd details         |
| Production | Milk tracking               |
| Feed       | Feed usage & stock          |
| Finances   | Income & expense management |

---

## 🎯 Key Highlights

✔ Modern and clean UI
✔ Fully responsive design
✔ Real-time charts and insights
✔ Secure session-based system
✔ Easy data filtering by date
✔ Downloadable PDF reports

---

## 🔮 Future Improvements

* 📱 Mobile App (Android)
* ☁️ Cloud Backup & Sync
* 🤖 AI-based milk prediction
* 📡 IoT cattle tracking integration
* 🧾 Invoice system for milk buyers

---

## 👨‍💻 Author

**Maithil**
B.Tech Computer Engineering Student

---

## 📜 License

This project is created for **educational purposes**.
You are free to use and modify it.

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub and share it!

---
