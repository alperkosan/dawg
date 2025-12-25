# 📚 DAWG Documentation Hub

Welcome to the DAWG documentation. This hub provides a structured navigation through all technical documents, organized from **General → Specific**.

---

## 🗺️ Navigation

### Level 1: Quick Start
| Document | Description |
|:---|:---|
| [Project README](../README.md) | Project overview, installation, and quick start guide. |

### Level 2: System Overviews
| Document | Description |
|:---|:---|
| [🏗️ Architecture](./ARCHITECTURE.md) | High-level system design, layers, and design patterns. |
| [🎵 Features](./FEATURES.md) | Complete feature list with implementation status. |
| [⚡ Optimizations](./OPTIMIZATIONS.md) | Performance analysis and optimization history. |
| [🔬 Engineering Analysis](./ENGINEERING_ANALYSIS.md) | Critical review: what could be improved. |
| [🛠️ Improvement Roadmap](./ARCHITECTURE_IMPROVEMENT_ROADMAP.md) | **NEW** 6-phase plan to fix identified issues. |


### Level 3: Deep Dives

#### Audio Engine
| Document | Description |
|:---|:---|
| [Engine Internals](../client/src/lib/ARCHITECTURE.md) | Detailed audio engine architecture, data flow diagrams. |
| [DSP Protocol](./system_index/audio_engine/02_dsp_protocol.md) | JSON message schema for Worklet communication. |

#### Frontend (Client)
| Document | Description |
|:---|:---|
| [UI Component System](./system_index/client/02_ui_component_system.md) | Props API for Knobs, Faders, and custom controls. |
| [Piano Roll v7](../client/src/features/piano_roll_v7/interaction/README.md) | Piano Roll interaction system details. |
| [Controls Library](../client/src/components/controls/README.md) | Component usage and styling. |

#### Backend (Server)
| Document | Description |
|:---|:---|
| [Database & API](./system_index/server/02_database_schema.md) | PostgreSQL schema and Fastify API endpoints. |
| [Server Setup](../server/README.md) | Neon, Bunny CDN, and Vercel deployment. |

#### Plugins
| Document | Description |
|:---|:---|
| [Plugin Quickstart](./PLUGIN_DEVELOPMENT_QUICKSTART.md) | How to create a new audio plugin. |
| [Standardization Guide](./PLUGIN_STANDARDIZATION_GUIDE.md) | Plugin structure and API standards. |
| [Component Library](./PLUGIN_COMPONENT_LIBRARY.md) | Reusable UI components for plugins. |

---

## 📂 Directory Structure

```
docs/
├── README.md               # 👈 You are here (Documentation Hub)
├── ARCHITECTURE.md         # Level 2: System overview
├── FEATURES.md             # Level 2: Feature list
├── OPTIMIZATIONS.md        # Level 2: Performance
├── system_index/           # Level 3: Deep dives
│   ├── audio_engine/       # Audio DSP specs
│   ├── client/             # Frontend specs
│   └── server/             # Backend specs
├── features/               # Feature-specific docs
├── optimizations/          # Performance analysis
├── bugs/                   # Bug tracking
└── archive/                # Historical/completed docs
```

### 📁 Subdirectory Indexes

| Directory | Index | Description |
|:---|:---|:---|
| `features/` | [📋 Feature Index](./features/README.md) | All feature design docs (AI Instrument, Mixer, Timeline). |
| `optimizations/` | [⚡ Optimization Index](./optimizations/README.md) | Canvas, CPU, memory optimization docs. |
| `bugs/` | [🐛 Bug Tracker](./bugs/README.md) | Current bugs and analysis documents. |
| `system_index/` | [🔍 System Index](./system_index/index.md) | Deep dive specs (DSP, UI, Database). |
| `analysis/` | [📊 39 Analysis Files](./analysis/) | MIDI, Scheduling, Playback, Plugin analysis. |


---

## ⚡ Performance Quick Reference

| Component | Most Expensive Function | Cost |
|:---|:---|:---|
| **UnifiedMixer** | `process_mix()` in Wasm | ~15% CPU under load |
| **Piano Roll** | `renderNotes()` on large patterns | Canvas redraw |
| **Plugin System** | `postMessage()` to Worklet | Reduced 98% via batching |

> For detailed performance analysis, see [OPTIMIZATIONS.md](./OPTIMIZATIONS.md).

---

**Last Updated:** 2025-12-25
