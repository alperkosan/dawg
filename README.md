# DAWG - Digital Audio Workstation 🎵

DAWG is a high-performance, web-based Digital Audio Workstation designed for collaboration. It combines a React-based frontend with a custom Wasm/Rust audio engine and a Fastify-based backend.

## 📚 Engineering Documentation

Comprehensive technical documentation is available in the **[System Index](docs/system_index/index.md)**.

### 🚀 Key Reports
- **[Audio Engine Specs](docs/system_index/audio_engine_report.md)**: Deep dive into the Wasm DSP and threading consistency.
- **[Client Architecture](docs/system_index/client_architecture.md)**: React feature structure and state management.
- **[Server Architecture](docs/system_index/server_architecture.md)**: Database schema and API endpoints.
- **[DSP Protocol](docs/system_index/audio_engine/02_dsp_protocol.md)**: Low-level message schema for Worklets.

## 📂 Project Structure

- **`/client`**: Frontend application (React + Vite).
- **`/server`**: Backend API (Fastify + Node.js).
- **`/api`**: Vercel Serverless entry point.
- **`/docs`**: System documentation and archives.

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (or Neon connection string)

### Client
```bash
cd client
npm install
npm run dev
```

### Server
```bash
cd server
npm install
npm run dev
```

## 🤝 Contribution

Please refer to the [File Index](docs/system_index/file_index.md) to understand the role of each significant file in the repository before making changes.
