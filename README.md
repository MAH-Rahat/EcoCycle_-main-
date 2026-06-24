<img width="1904" height="957" alt="Screenshot 2026-06-24 172639" src="https://github.com/user-attachments/assets/f49406a3-462d-4397-b860-208add04fc8f" />
<img width="1919" height="958" alt="Screenshot 2026-06-24 172745" src="https://github.com/user-attachments/assets/5a0acc8b-99b4-4d4b-a0c1-731b3426045d" />
<img width="1919" height="955" alt="Screenshot 2026-06-24 172738" src="https://github.com/user-attachments/assets/88ed2a8c-c69d-404d-b1e0-c634ca7147ab" />

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

