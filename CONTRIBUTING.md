# Contributing to FERA AI

Thank you for your interest in contributing to FERA AI! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style Guide](#code-style-guide)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/ai-chatbot-project.git`
3. Add upstream remote: `git remote add upstream https://github.com/parkjaeuk0210/ai-chatbot-project.git`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## 💻 Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Run linter and formatter:
   ```bash
   npm run lint
   npm run format
   ```

## 📝 Code Style Guide

### TypeScript/JavaScript

- Use TypeScript for new files
- Follow ESLint rules (run `npm run lint`)
- Use Prettier for formatting (run `npm run format`)

#### Naming Conventions

- **Files**: Use kebab-case (e.g., `chat-manager.ts`)
- **Classes**: Use PascalCase (e.g., `ChatManager`)
- **Functions/Variables**: Use camelCase (e.g., `sendMessage`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
- **Types/Interfaces**: Use PascalCase with descriptive names (e.g., `ChatMessage`)

#### Code Examples

```typescript
// Good
export interface ChatMessage {
  role: 'user' | 'model';
  parts: MessagePart[];
  timestamp?: number;
}

export class ChatManager {
  private messages: ChatMessage[] = [];
  
  async sendMessage(content: string): Promise<void> {
    // Implementation
  }
}

// Constants
export const MAX_MESSAGE_LENGTH = 50000;
export const SUPPORTED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
```

### CSS/Styling

- Use Tailwind CSS utilities when possible
- Create custom CSS only when necessary
- Follow mobile-first approach
- Ensure dark mode compatibility

### File Organization

```
src/
├── api/                 # API endpoints
│   └── middleware/      # Express middleware
├── js/                  # Frontend code
│   ├── components/      # UI components
│   ├── services/        # API services
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript types
├── css/                # Stylesheets
└── tests/              # Test files
```

## 📋 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```bash
# Feature
feat(chat): add file upload support for PDF documents

# Bug fix
fix(auth): resolve rate limiting issue for authenticated users

# Documentation
docs(api): update API documentation with new endpoints

# Refactoring
refactor(utils): optimize image compression algorithm
```

## 🔄 Pull Request Process

1. **Update your fork**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Make changes and commit**:
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```

4. **Run tests and linting**:
   ```bash
   npm run lint
   npm run type-check
   npm run format:check
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature
   ```

6. **Create Pull Request**:
   - Go to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill in the PR template
   - Submit for review

### PR Requirements

- [ ] Code follows style guidelines
- [ ] Tests pass (if applicable)
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts
- [ ] Description explains changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] All tests pass

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style
- [ ] Self-reviewed code
- [ ] Updated documentation
- [ ] No console errors/warnings
```

## 🐛 Reporting Issues

### Before Creating an Issue

1. Check existing issues
2. Try latest version
3. Search documentation

### Issue Template

```markdown
## Bug Report

### Description
Clear description of the bug

### Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Environment
- OS: [e.g., Windows 11]
- Browser: [e.g., Chrome 120]
- Node version: [e.g., 20.10.0]

### Screenshots
If applicable

### Additional Context
Any other relevant information
```

## 🧪 Testing Guidelines

### Writing Tests

```typescript
// Example test structure
describe('ChatManager', () => {
  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      // Test implementation
    });
    
    it('should handle errors gracefully', async () => {
      // Test implementation
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📚 Additional Resources

- [Project README](README.md)
- [API Documentation](API.md)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Getting Help

- Open an issue for bugs
- Start a discussion for features
- Join our community chat (coming soon)

Thank you for contributing to FERA AI! 🎉