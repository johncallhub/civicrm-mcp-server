# CiviCRM MCP Server

A comprehensive Model Context Protocol (MCP) server for CiviCRM that provides AI assistants like Claude Desktop with direct access to your CiviCRM data and functionality.

## 🚀 Quick Install

### Option 1: Install from GitHub
```bash
npm install -g git+https://github.com/johnjacob/civicrm-mcp-server.git
```

### Option 2: Install from npm (if published)
```bash
npm install -g civicrm-mcp-server
```

### Option 3: Clone and Build
```bash
git clone https://github.com/johnjacob/civicrm-mcp-server.git
cd civicrm-mcp-server
npm install
npm run build
```

## 📋 Prerequisites

- Node.js 18+ installed
- A running CiviCRM instance (local or accessible)
- CiviCRM API key

## ⚙️ Configuration

### 1. Get CiviCRM API Credentials
- Log into CiviCRM as administrator
- Go to **Contacts** → Find your contact → **API Key** tab
- Generate an API key

### 2. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "civicrm": {
      "command": "civicrm-mcp-server",
      "env": {
        "CIVICRM_BASE_URL": "https://your-civicrm-site.com",
        "CIVICRM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Global install config path:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## 🛠️ Available Tools

- **get_contacts** - Search and retrieve contacts
- **create_contact** - Create new contacts
- **update_contact** - Update existing contacts
- **get_activities** - Retrieve activities
- **create_activity** - Create new activities
- **get_contributions** - View donations/contributions
- **create_contribution** - Record new donations
- **get_events** - List CiviCRM events
- **get_memberships** - View memberships
- **system_info** - Check CiviCRM status

## 💬 Usage Examples

Ask Claude things like:
- "Show me all contacts from Acme Corporation"
- "Create a new contact for Jane Doe with email jane@example.com"
- "List all donations over $1000 from this year"
- "Schedule a meeting with contact ID 123"

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/johnjacob/civicrm-mcp-server.git
cd civicrm-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## 📚 Documentation

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Issues

Report issues at: https://github.com/johnjacob/civicrm-mcp-server/issues

## ⭐ Support

If this helps you, please star the repository!
