# API Runner Pro

A scalable, web-based API testing and automation platform designed for batch execution. API Runner Pro allows you to run large sets of API requests dynamically by feeding data from a CSV file. It functions similarly to Postman's Collection Runner but is optimized for batch processing with fine-grained control over concurrency and rate limiting.

## Features
- **Dynamic Variables**: Use `{{ColumnName}}` anywhere in your URLs, Headers, or JSON Bodies to dynamically replace values with data from your CSV.
- **Batch CSV Processing**: Upload a CSV file, and the tool will execute a request for every single row.
- **Concurrency Control**: Define how many requests should be sent at the exact same time (e.g., 10 concurrent requests).
- **Rate Limiting**: Add an artificial delay (in milliseconds) between requests to prevent overloading target APIs.
- **Detailed Reporting**: Download a full CSV report of the execution run, complete with HTTP status codes, execution duration, success/failure status, and response snippets.
- **Docker Ready**: Pre-configured with Nginx and Uvicorn to be deployed easily on any server using Docker Compose.

---

## 🚀 Quickstart: Running Locally (Development)

The project is split into a React frontend (`client`) and a FastAPI backend (`server`). You'll need Node.js and Python installed.

### 1. Start the Backend
The backend runs on Python/FastAPI.
```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Frontend
The frontend is a Vite + React application.
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🐳 Deployment (Production)

To host this application on a server (VPS, Cloud Provider), the easiest method is using **Docker**. This ensures you don't have to manually manage Node or Python environments.

1. Clone your repository on your server.
2. Ensure Docker and Docker Compose are installed.
3. Run the following command from the root of the project:
```bash
docker-compose up -d --build
```
This will start both the frontend and backend in detached mode. The frontend will be available on port `80` (Standard HTTP) and will automatically reverse-proxy API requests to the backend container.

---

## 📖 How to Use the CSV Runner

### 1. Prepare your CSV
Create a CSV file with headers. For example:
```csv
id,name,role
1,Alice,admin
2,Bob,user
```

### 2. Configure the Request
In the UI, set up your HTTP request. You can inject your CSV data using double curly braces matching your CSV headers.

**URL Example:**
`https://api.example.com/v1/users/{{id}}`

**Headers Example:**
```json
{
  "Authorization": "Bearer YOUR_TOKEN",
  "X-User-Role": "{{role}}"
}
```

**Body Example:**
```json
{
  "username": "{{name}}",
  "permissions": "{{role}}"
}
```

### 3. Run and Download
- Upload your CSV in the "CSV Runner" tab.
- Set your **Concurrency Limit** (e.g., 5 to process 5 rows simultaneously).
- Set your **Rate Limit** (e.g., 500ms to wait half a second between starting new requests).
- Click **Run Batch**.
- Once finished, you will see a summary. Click **Download Report** to get a CSV containing the original data appended with the execution results.
