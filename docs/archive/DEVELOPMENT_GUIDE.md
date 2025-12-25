# 🛠️ DAWG Development Guide

**Last Updated:** 2025-01-XX  
**Version:** 2.0.0

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Development Workflows](#development-workflows)
5. [Coding Standards](#coding-standards)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Contributing](#contributing)

---

## Getting Started

### Prerequisites

- **Node.js:** v18 or higher
- **npm:** v9 or higher
- **Git:** Latest version
- **Code Editor:** VS Code (recommended)

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd dawg

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## Development Setup

### Environment Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   - Copy `.env.example` to `.env`
   - Configure environment variables

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

4. **Open in Browser:**
   - Navigate to `http://localhost:5173`

### Development Tools

- **Vite:** Build tool and dev server
- **ESLint:** Code linting
- **Prettier:** Code formatting
- **TypeScript:** Type checking (gradual migration)

---

## Project Structure

```
dawg/
├── client/                    # Frontend application
│   ├── src/                  # Source code
│   │   ├── components/       # React components
│   │   ├── features/         # Feature modules
│   │   ├── lib/              # Core libraries
│   │   ├── store/            # State management
│   │   └── styles/           # Stylesheets
│   ├── public/               # Static assets
│   └── dist/                 # Build output
│
├── docs/                     # Documentation
│   ├── MASTER_PLAN.md        # Master plan
│   ├── ARCHITECTURE.md       # Architecture docs
│   ├── FEATURES.md           # Feature docs
│   ├── features/             # Feature-specific docs
│   ├── bugs/                 # Bug tracking
│   ├── optimizations/        # Performance docs
│   └── archive/              # Historical docs
│
└── package.json              # Dependencies
```

### Key Directories

#### `client/src/features/`
Feature modules (Piano Roll, Channel Rack, Mixer, etc.)

#### `client/src/lib/`
Core libraries (Audio Engine, Plugin System, etc.)

#### `client/src/store/`
State management (Zustand stores)

#### `client/src/components/`
Reusable React components

---

## Development Workflows

### Feature Development

1. **Create Feature Branch:**
   ```bash
   git checkout -b feature/feature-name
   ```

2. **Develop Feature:**
   - Write code
   - Add tests
   - Update documentation

3. **Test Feature:**
   ```bash
   npm run test
   ```

4. **Commit Changes:**
   ```bash
   git add .
   git commit -m "feat: add feature-name"
   ```

5. **Push and Create PR:**
   ```bash
   git push origin feature/feature-name
   ```

### Plugin Development

1. **Create Plugin:**
   - Extend `BaseAudioPlugin`
   - Implement plugin logic
   - Add UI components

2. **Test Plugin:**
   - Test audio processing
   - Test UI interactions
   - Test preset management

3. **Document Plugin:**
   - Add plugin documentation
   - Update plugin list
   - Add examples

See [PLUGIN_DEVELOPMENT_QUICKSTART.md](./PLUGIN_DEVELOPMENT_QUICKSTART.md) for details.

### Bug Fixing

1. **Identify Bug:**
   - Reproduce the bug
   - Document the issue
   - Create bug report

2. **Fix Bug:**
   - Locate the issue
   - Implement fix
   - Add tests

3. **Test Fix:**
   - Verify fix works
   - Run test suite
   - Check for regressions

4. **Document Fix:**
   - Update bug tracker
   - Add fix documentation
   - Update changelog

---

## Coding Standards

### Code Style

#### JavaScript/TypeScript
- **ESLint:** Configured for React + JavaScript
- **Prettier:** Code formatting
- **TypeScript:** For new features (gradual migration)

#### React Components
- **Functional Components:** Use functional components
- **Hooks:** Use React hooks for state management
- **Props:** Type props with PropTypes or TypeScript

#### CSS
- **CSS Modules:** Use CSS modules for component styles
- **Tailwind CSS:** Use Tailwind for utility classes
- **Naming:** Use BEM-like naming convention

### Naming Conventions

#### Files
- **Components:** `PascalCase.jsx` (e.g., `PianoRoll.jsx`)
- **Utilities:** `camelCase.js` (e.g., `audioUtils.js`)
- **Constants:** `UPPER_SNAKE_CASE.js` (e.g., `CONSTANTS.js`)

#### Variables
- **Variables:** `camelCase` (e.g., `audioContext`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_VOICES`)
- **Components:** `PascalCase` (e.g., `PianoRoll`)

#### Functions
- **Functions:** `camelCase` (e.g., `createInstrument`)
- **Event Handlers:** `handleEventName` (e.g., `handleClick`)
- **Hooks:** `useHookName` (e.g., `useAudioContext`)

### Code Organization

#### Component Structure
```javascript
// 1. Imports
import React from 'react';
import './Component.css';

// 2. Component
export default function Component({ prop1, prop2 }) {
  // 3. Hooks
  const [state, setState] = useState();
  
  // 4. Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // 5. Handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // 6. Render
  return (
    <div className="component">
      {/* JSX */}
    </div>
  );
}
```

#### File Organization
- **One component per file**
- **Related utilities in same directory**
- **Shared utilities in `lib/utils/`**
- **Feature-specific code in `features/`**

---

## Testing

### Unit Tests
- **Framework:** Jest (planned)
- **Location:** `__tests__/` directories
- **Coverage:** Target 80%+ coverage

### Integration Tests
- **Framework:** (planned)
- **Location:** `tests/integration/`
- **Scope:** Feature integration testing

### E2E Tests
- **Framework:** (planned)
- **Location:** `tests/e2e/`
- **Scope:** End-to-end user workflows

### Manual Testing
- **Test Checklist:** See testing documentation
- **Browser Testing:** Chrome, Firefox, Safari
- **Device Testing:** Desktop, tablet (planned)

---

## Debugging

### Debug Tools

#### Browser DevTools
- **Console:** Log messages and errors
- **Network:** Monitor network requests
- **Performance:** Profile performance
- **Memory:** Monitor memory usage

#### React DevTools
- **Component Tree:** Inspect component hierarchy
- **Props/State:** Inspect component props and state
- **Profiler:** Profile component performance

#### Audio Debugging
- **AudioContext:** Inspect audio context state
- **AudioNodes:** Monitor audio node connections
- **Performance:** Monitor audio processing performance

### Debug Logging

#### Debug Logger
- **Location:** `client/src/lib/utils/debugLogger.js`
- **Usage:** `logger.debug('message', data)`
- **Levels:** debug, info, warn, error

#### Console Logging
- **Development:** Use `console.log` for debugging
- **Production:** Remove console logs
- **Error Handling:** Use error boundaries

### Performance Debugging

#### Performance Monitoring
- **Location:** `client/src/lib/core/PerformanceMonitor.js`
- **Metrics:** CPU, memory, FPS
- **Reporting:** Performance reports

#### Profiling
- **Chrome DevTools:** Use Performance tab
- **React Profiler:** Use React DevTools Profiler
- **Audio Profiler:** Use AudioContext profiling

---

## Contributing

### Contribution Guidelines

1. **Fork Repository:**
   - Fork the repository
   - Create feature branch

2. **Develop Feature:**
   - Write code
   - Add tests
   - Update documentation

3. **Submit PR:**
   - Create pull request
   - Describe changes
   - Reference issues

4. **Code Review:**
   - Address review comments
   - Update code as needed
   - Merge when approved

### Commit Messages

#### Format
```
type(scope): subject

body

footer
```

#### Types
- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation
- **style:** Code style
- **refactor:** Code refactoring
- **test:** Tests
- **chore:** Maintenance

#### Examples
```
feat(piano-roll): add slide note support

Add FL Studio-style slide notes with pitch glide functionality.

Closes #123
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes
```

---

## Resources

### Documentation
- **[Master Plan](./MASTER_PLAN.md)** - Overall project status
- **[Architecture](./ARCHITECTURE.md)** - System architecture
- **[Features](./FEATURES.md)** - Feature documentation
- **[API Reference](./API_REFERENCE.md)** - API documentation

### Development
- **[Plugin Development](./PLUGIN_DEVELOPMENT_QUICKSTART.md)** - Plugin development guide
- **[Debug Logger Guide](./DEBUG_LOGGER_GUIDE.md)** - Debug logging system
- **[Bug Tracker](./bugs/BUG_TRACKER.md)** - Bug tracking

### External Resources
- **[React Documentation](https://react.dev/)**
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)**
- **[Zustand Documentation](https://zustand-demo.pmnd.rs/)**

---

**Last Updated:** 2025-01-XX  
**Maintained by:** DAWG Development Team

