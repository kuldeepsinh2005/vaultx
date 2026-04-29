
---

# VaultX: Zero-Knowledge Encrypted Cloud Storage

## ⚠️ The Problem: The "Provider-Trust" Paradox
In the current cloud ecosystem (Google Drive, Dropbox, iCloud), data is typically encrypted **at rest** using keys managed by the provider. This creates a "Trust Paradox":
1.  **Privacy Risk:** If the provider’s internal security is compromised, or if they are legally compelled, your data can be decrypted.
2.  **Security Risk:** The server acts as a single point of failure where both the "Lock" (Data) and the "Key" (Password/AES Key) reside.

**VaultX solves this by shifting the "Trust Anchor" from the server to the client's own device.**

---

## 💻 Frontend Architecture: The "Security Engine"
The VaultX frontend is more than just a UI; it is a **cryptographic engine** that handles all sensitive computations locally.

### 1. Zero-Knowledge Key Derivation
Instead of sending passwords to the server, we utilize the **Web Crypto API** to implement **PBKDF2 (Password-Based Key Derivation Function 2)**. 
* **The Process:** We combine the user's password with a unique salt and run **250,000 iterations** to derive a 256-bit Master Key. 
* **The Benefit:** The server never receives the password. Even if our database is leaked, an attacker cannot derive the file encryption keys.



### 2. Multi-Threaded Data Pipeline
To prevent the UI from freezing during heavy 256-bit encryption, we implemented **Web Workers**. 
* **Main Thread:** Handles the React UI, animations, and state management.
* **Worker Thread:** Handles the intensive math of **AES-GCM encryption**. 
* **Efficiency:** We use **Transferable Objects** to move data between threads without duplicating memory, allowing for smooth performance even with large files.

### 3. Parallel Download & Assembly
We maximize network throughput using **HTTP Range Requests**. 
* The frontend requests multiple 10MB chunks of a file simultaneously. 
* These chunks are collected in a **C++-backed Blob object** off-heap, decrypted in the worker, and served as a local download.

---

## ⚙️ Backend Architecture: The "Stateless Orchestrator"
The backend is designed to be a high-performance, stateless bridge between the user and the cloud infrastructure.

### 1. S3 Multipart Management
Handling large files directly through a Node.js server can cause memory bottlenecks. We solved this by implementing **Multipart Upload Orchestration**:
1.  **Initiation:** The backend requests a set of **Presigned URLs** from AWS S3.
2.  **Direct-to-Cloud:** The frontend uploads encrypted chunks directly to S3 using these URLs, bypassing the backend to reduce server load and latency.
3.  **Finalization:** Once all parts are received, the backend verifies the metadata and "closes" the upload on S3.



### 2. Event-Driven Billing (Webhook Architecture)
To ensure system integrity, we integrated **Stripe** via an event-driven architecture.
* **Signature Verification:** Our backend captures raw request buffers from Stripe and verifies the cryptographic signature to prevent spoofing.
* **Service Restriction Middleware:** A custom middleware checks for unpaid balances in MongoDB before allowing `POST` or `DELETE` operations, protecting the business model from abuse.

### 3. Infrastructure & DevOps
* **Dockerization:** We use a multi-container setup (Frontend, Backend, MongoDB) to ensure environment parity between development and production.
* **AWS SSM Integration:** All sensitive keys (Stripe Secrets, AWS Credentials) are pulled dynamically from **AWS Systems Manager Parameter Store** at runtime, ensuring no secrets are stored in the source code.

---

## 🛠️ Security Matrix
| Security Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Identity** | JWT (HttpOnly Cookies) | Prevents XSS-based token theft. |
| **At Rest** | AES-256-GCM | Provides Confidentiality & Integrity. |
| **In Transit** | TLS 1.3 | Protects against Man-in-the-Middle attacks. |
| **Data Integrity** | GCM Auth Tags | Detects any unauthorized modification of stored files. |



---

## 🚀 Impact & Future Scope
VaultX demonstrates that high-security data storage does not have to come at the cost of performance. 

**Future Roadmap:**
* **Shamir's Secret Sharing:** Splitting the master key into "shards" for secure account recovery without provider access.
* **Searchable Symmetric Encryption (SSE):** Allowing users to search their encrypted file metadata without the server ever seeing the keywords.
* **Progressive Web App (PWA):** Enabling offline decryption and local "Vault" access.

---

## 👤 Author
**Dabhi Kuldeepsinh Ajitsinh** *Computer Engineering Department, Dharmsinh Desai University.*

---