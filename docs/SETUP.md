# CiviCRM MCP Server - Detailed Setup Guide

A comprehensive Model Context Protocol (MCP) server for CiviCRM that provides AI assistants with direct access to your CiviCRM data and functionality.

## Features

- **Complete CiviCRM Integration**: Access contacts, activities, contributions, events, memberships, and more
- **Modern API v4 Support**: Uses CiviCRM's latest and most powerful API
- **Secure Local Connection**: Runs locally and connects directly to your CiviCRM instance
- **Rich Functionality**: 10+ specialized tools for common CiviCRM operations
- **Type-Safe**: Built with TypeScript for reliability and excellent developer experience

## Available Tools

1. **get_contacts** - Search and retrieve contacts with filtering options
2. **create_contact** - Create new individual, organization, or household contacts
3. **update_contact** - Update existing contact information
4. **get_activities** - Retrieve activities with filtering by contact, type, status
5. **create_activity** - Create new activities (meetings, calls, emails, etc.)
6. **get_contributions** - View donations and financial contributions
7. **create_contribution** - Record new donations or payments
8. **get_events** - List CiviCRM events with filtering options
9. **get_memberships** - View membership records and status
10. **system_info** - Get CiviCRM system status and version information

## Installation

### Prerequisites

- Node.js 18+ installed
- A running CiviCRM instance (local or accessible)
- CiviCRM API key and site key

### Quick Install

1. **Create project directory:**
```bash
mkdir civicrm-mcp-server
cd civicrm-mcp-server
```

2. **Save the server code:**
   - Copy the TypeScript code into `src/index.ts`
   - Copy the package.json content into `package.json`

3. **Install dependencies:**
```bash
npm install
```

4. **Build the server:**
```bash
npm run build
```

### CiviCRM Configuration

1. **Get your API credentials:**
   - Log into CiviCRM as an administrator
   - Go to **Contacts** → Find your contact record
   - Navigate to the **API Key** tab and generate an API key
   - Note your site key from `civicrm.settings.php` or contact your system administrator

2. **Test API access:**
   Visit your CiviCRM API Explorer at: `https://your-civicrm-site.com/civicrm/api4`

### Claude Desktop Configuration

Add this configuration to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "civicrm": {
      "command": "node",
      "args": ["/path/to/civicrm-mcp-server/dist/index.js"],
      "env": {
        "CIVICRM_BASE_URL": "https://your-civicrm-site.com",
        "CIVICRM_API_KEY": "your-api-key-here",
        "CIVICRM_SITE_KEY": "your-site-key-here"
      }
    }
  }
}
```

**Important:** Replace the placeholders with your actual values:
- `CIVICRM_BASE_URL`: Your CiviCRM website URL
- `CIVICRM_API_KEY`: The API key you generated
- `CIVICRM_SITE_KEY`: Your site key (optional for v4 API)

### Alternative: Environment Variables

You can also set these as system environment variables instead of in the config:

```bash
export CIVICRM_BASE_URL="https://your-civicrm-site.com"
export CIVICRM_API_KEY="your-api-key-here"
export CIVICRM_SITE_KEY="your-site-key-here"
```

## Usage Examples

Once configured, you can interact with your CiviCRM data through Claude. Here are some example requests:

### Contact Management
- "Show me all contacts with the email domain @example.org"
- "Create a new individual contact named John Smith with email john@example.com"
- "Find all organization contacts"
- "Update contact ID 123 with a new phone number"

### Activities
- "Show me all meetings scheduled for contact ID 456"
- "Create a phone call activity for today with contact 789"
- "List all completed activities from the last month"

### Contributions
- "Show me all donations from contact 123"
- "Record a $500 donation from contact 456 received today"
- "List all pending contributions"

### Events & Memberships
- "Show me all active events"
- "List memberships expiring this month"
- "Find all workshop-type events"

### System Information
- "Check CiviCRM system status"
- "What version of CiviCRM is running?"

## Advanced Configuration

### Custom CiviCRM Installation Paths

If your CiviCRM uses non-standard paths, you may need to modify the API endpoints in the code:

```typescript
// For custom API paths, modify these lines in the CiviCRMClient class:
const url = `/your-custom-path/ajax/api4/${entity}/${action}`;  // APIv4
const url = '/your-custom-path/ajax/rest';  // APIv3 fallback
```

### Multiple CiviCRM Instances

You can configure multiple CiviCRM servers by creating separate entries in your config:

```json
{
  "mcpServers": {
    "civicrm-prod": {
      "command": "node",
      "args": ["/path/to/civicrm-mcp-server/dist/index.js"],
      "env": {
        "CIVICRM_BASE_URL": "https://prod.example.com",
        "CIVICRM_API_KEY": "prod-api-key"
      }
    },
    "civicrm-test": {
      "command": "node",
      "args": ["/path/to/civicrm-mcp-server/dist/index.js"],
      "env": {
        "CIVICRM_BASE_URL": "https://test.example.com",
        "CIVICRM_API_KEY": "test-api-key"
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **"CIVICRM_API_KEY environment variable is required"**
   - Ensure you've set the API key in your environment or config file
   - Verify the API key is correct and active

2. **"CiviCRM API v4 Error: Unauthorized"**
   - Check that your API key has sufficient permissions
   - Verify the CiviCRM user associated with the API key has appropriate roles

3. **"Connection refused" or "Network error"**
   - Verify the CIVICRM_BASE_URL is correct and accessible
   - Check if your CiviCRM site requires authentication or VPN access
   - Ensure CiviCRM is running and the web server is accessible

4. **"Tool execution failed"**
   - Check CiviCRM error logs for detailed error messages
   - Verify the requested entity/action exists in your CiviCRM version
   - Some operations may require specific CiviCRM permissions

### Debug Mode

To enable debug output, you can modify the server to log API calls:

```bash
# Set debug environment variable
export CIVICRM_DEBUG=true
```

### Testing the Connection

You can test the server manually:

```bash
# Start the server in development mode
npm run dev

# Test with MCP Inspector (if available)
# Or check CiviCRM logs for API calls
```

## Security Considerations

- **API Key Security**: Store API keys securely and never commit them to version control
- **Network Security**: Use HTTPS for all CiviCRM connections in production
- **Permissions**: Follow the principle of least privilege - only grant necessary API permissions
- **Local Access**: This server is designed for local use; avoid exposing it to public networks

## Extending the Server

### Adding New Tools

To add new CiviCRM functionality:

1. Add the tool definition to the `ListToolsRequestSchema` handler
2. Implement the tool logic in the `CallToolRequestSchema` handler
3. Use the `civiClient.apiV4()` method to interact with CiviCRM

Example new tool:

```typescript
// Add to tools list
{
  name: 'get_cases',
  description: 'Retrieve CiviCase records',
  inputSchema: {
    type: 'object',
    properties: {
      contact_id: { type: 'number', description: 'Filter by contact ID' },
      case_type: { type: 'string', description: 'Filter by case type' }
    }
  }
}

// Add to tool handler
case 'get_cases': {
  const { contact_id, case_type } = args as any;
  let where: any[] = [];
  
  if (contact_id) {
    where.push(['contact_id', '=', contact_id]);
  }
  if (case_type) {
    where.push(['case_type_id:name', '=', case_type]);
  }

  const result = await civiClient.apiV4('Case', 'get', {
    select: ['id', 'subject', 'case_type_id:name', 'status_id:name', 'start_date'],
    where,
    limit: 25
  });

  return {
    content: [{
      type: 'text',
      text: `Found ${result.length} case(s):\n\n` +
        result.map((case_record: any) => 
          `ID: ${case_record.id}\nSubject: ${case_record.subject}\n...`
        ).join('\n')
    }]
  };
}
```

## Contributing

This is a custom implementation. To contribute:

1. Fork or copy the code
2. Make your improvements
3. Test thoroughly with your CiviCRM instance
4. Share your enhancements with the community

## License

MIT License - Feel free to use, modify, and distribute.

## Support

For CiviCRM-specific issues:
- Check the [CiviCRM Documentation](https://docs.civicrm.org/)
- Visit the [CiviCRM Community](https://civicrm.org/support)
- Use the [CiviCRM API Explorer](https://docs.civicrm.org/dev/en/latest/api/) for testing

For MCP-related issues:
- Check the [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- Review [Claude Desktop MCP setup](https://docs.anthropic.com/claude/docs)
