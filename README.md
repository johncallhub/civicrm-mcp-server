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

- **get_contacts** - Search and retrieve contacts with custom fields
- **create_contact** - Create new contacts with custom field support
- **update_contact** - Update existing contacts including custom fields
- **list_custom_fields** - List all custom fields for any entity type
- **get_activities** - Retrieve activities with custom fields
- **create_activity** - Create new activities with custom fields
- **get_contributions** - View donations/contributions with custom fields
- **create_contribution** - Record new donations with custom fields
- **get_events** - List CiviCRM events
- **get_memberships** - View memberships
- **system_info** - Check CiviCRM status

## ✨ Enhanced Custom Field Support

- **Automatic Discovery**: Automatically loads and maps all custom fields
- **Human-Friendly Names**: Use field labels instead of technical API names
- **Multiple Entity Support**: Works with Contact, Activity, Contribution custom fields
- **Smart Mapping**: Converts human-readable field names to API field names
- **Complete Integration**: Custom fields included in all get/create/update operations

## 💬 Usage Examples

### Basic Operations
- "Show me all contacts from Acme Corporation"
- "Create a new contact for Jane Doe with email jane@example.com"
- "List all donations over $1000 from this year"
- "Schedule a meeting with contact ID 123"

### Custom Field Examples
- "List all custom fields for contacts"
- "Show me contacts including their membership level custom field"
- "Create a contact with custom field 'Volunteer Interest' set to 'Environmental'"
- "Update contact ID 456 and set their 'Preferred Communication' to 'Email'"
- "Find all activities with custom field 'Follow-up Required' set to 'Yes'"
- "Record a donation with custom field 'Campaign Source' as 'Newsletter'"

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
