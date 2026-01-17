# 🌍 EcoCycle - Full-Stack Recycling Management Platform (MERN)

EcoCycle is a complete platform designed to incentivise recycling by providing citizens with a visual dashboard, gamified rewards, and scheduled waste pickup, while giving administrators the tools for full system oversight.

## ✨ Key Features Implemented

* **Multi-Role Authentication:** Separate logic and dashboards for Citizen, Collector, and Admin.
* **Secure Admin Gateway:** Uses a private code (`ECOADMIN`) check for registration.
* **Dynamic Citizen Dashboard:** Fetches live points (100 free points upon signup) and waste logging statistics from the database.
* **Waste Logging & Points System:** Citizens can log waste by type/weight, and the system automatically awards points (10 pts/KG).
* **Admin Waste Management:** Dedicated dashboard (`/admin/waste`) to view, filter, accept, or reject pending citizen requests.

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS | Modern, fast UI with professional styling. |
| **Backend** | Node.js, Express.js | Secure, scalable REST API. |
| **Database** | MongoDB, Mongoose | Flexible, non-relational data store. |

