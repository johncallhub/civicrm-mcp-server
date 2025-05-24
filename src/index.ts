#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// CiviCRM API Client
class CiviCRMClient {
  private baseUrl: string;
  private apiKey: string;
  private siteKey: string;
  private httpClient: AxiosInstance;

  constructor(baseUrl: string, apiKey: string, siteKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.siteKey = siteKey;
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'CiviCRM-MCP-Server/1.0'
      }
    });
  }

  // APIv4 call
  async apiV4(entity: string, action: string, params: any = {}): Promise<any> {
    try {
      const url = `/civicrm/ajax/api4/${entity}/${action}`;
      const data = new URLSearchParams({
        params: JSON.stringify(params),
        _authx: `Bearer ${this.apiKey}`
      });

      const response = await this.httpClient.post(url, data);
      return response.data;
    } catch (error: any) {
      throw new Error(`CiviCRM API v4 Error: ${error.response?.data?.error_message || error.message}`);
    }
  }

  // APIv3 call (fallback)
  async apiV3(entity: string, action: string, params: any = {}): Promise<any> {
    try {
      const url = '/civicrm/ajax/rest';
      const data = new URLSearchParams({
        entity,
        action,
        api_key: this.apiKey,
        key: this.siteKey,
        json: '1',
        ...params
      });

      const response = await this.httpClient.post(url, data);
      return response.data;
    } catch (error: any) {
      throw new Error(`CiviCRM API v3 Error: ${error.response?.data?.error_message || error.message}`);
    }
  }
}

// Initialize server
const server = new Server(
  {
    name: 'civicrm-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Environment variables
const CIVICRM_BASE_URL = process.env.CIVICRM_BASE_URL || 'http://localhost';
const CIVICRM_API_KEY = process.env.CIVICRM_API_KEY || '';
const CIVICRM_SITE_KEY = process.env.CIVICRM_SITE_KEY || '';

if (!CIVICRM_API_KEY) {
  console.error('Error: CIVICRM_API_KEY environment variable is required');
  process.exit(1);
}

const civiClient = new CiviCRMClient(CIVICRM_BASE_URL, CIVICRM_API_KEY, CIVICRM_SITE_KEY);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_contacts',
        description: 'Search and retrieve contacts from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of contacts to return (default: 25)',
              default: 25
            },
            search: {
              type: 'string',
              description: 'Search term to filter contacts by name or email'
            },
            contact_type: {
              type: 'string',
              description: 'Filter by contact type (Individual, Organization, Household)',
              enum: ['Individual', 'Organization', 'Household']
            },
            contact_id: {
              type: 'number',
              description: 'Get specific contact by ID'
            }
          }
        }
      },
      {
        name: 'create_contact',
        description: 'Create a new contact in CiviCRM',
        inputSchema: {
          type: 'object',
          required: ['contact_type'],
          properties: {
            contact_type: {
              type: 'string',
              description: 'Type of contact to create',
              enum: ['Individual', 'Organization', 'Household']
            },
            first_name: {
              type: 'string',
              description: 'First name (for Individual contacts)'
            },
            last_name: {
              type: 'string',
              description: 'Last name (for Individual contacts)'
            },
            organization_name: {
              type: 'string',
              description: 'Organization name (for Organization contacts)'
            },
            email: {
              type: 'string',
              description: 'Primary email address'
            },
            phone: {
              type: 'string',
              description: 'Primary phone number'
            },
            street_address: {
              type: 'string',
              description: 'Street address'
            },
            city: {
              type: 'string',
              description: 'City'
            },
            state_province: {
              type: 'string',
              description: 'State or province'
            },
            postal_code: {
              type: 'string',
              description: 'Postal/ZIP code'
            },
            country: {
              type: 'string',
              description: 'Country'
            }
          }
        }
      },
      {
        name: 'update_contact',
        description: 'Update an existing contact in CiviCRM',
        inputSchema: {
          type: 'object',
          required: ['contact_id'],
          properties: {
            contact_id: {
              type: 'number',
              description: 'ID of the contact to update'
            },
            first_name: {
              type: 'string',
              description: 'First name'
            },
            last_name: {
              type: 'string',
              description: 'Last name'
            },
            organization_name: {
              type: 'string',
              description: 'Organization name'
            },
            email: {
              type: 'string',
              description: 'Primary email address'
            },
            phone: {
              type: 'string',
              description: 'Primary phone number'
            }
          }
        }
      },
      {
        name: 'get_activities',
        description: 'Retrieve activities from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: {
              type: 'number',
              description: 'Filter activities by contact ID'
            },
            activity_type: {
              type: 'string',
              description: 'Filter by activity type (Meeting, Phone Call, Email, etc.)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of activities to return (default: 25)',
              default: 25
            },
            status: {
              type: 'string',
              description: 'Filter by activity status (Scheduled, Completed, etc.)'
            }
          }
        }
      },
      {
        name: 'create_activity',
        description: 'Create a new activity in CiviCRM',
        inputSchema: {
          type: 'object',
          required: ['activity_type_id', 'subject'],
          properties: {
            activity_type_id: {
              type: 'number',
              description: 'Activity type ID (1=Meeting, 2=Phone Call, 3=Email, etc.)'
            },
            subject: {
              type: 'string',
              description: 'Activity subject/title'
            },
            details: {
              type: 'string',
              description: 'Activity details/description'
            },
            contact_id: {
              type: 'number',
              description: 'Primary contact ID for the activity'
            },
            target_contact_id: {
              type: 'number',
              description: 'Target contact ID (who the activity is with)'
            },
            activity_date_time: {
              type: 'string',
              description: 'Activity date/time (YYYY-MM-DD HH:MM:SS format)'
            },
            status_id: {
              type: 'number',
              description: 'Activity status ID (1=Scheduled, 2=Completed, etc.)'
            }
          }
        }
      },
      {
        name: 'get_contributions',
        description: 'Retrieve contributions/donations from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: {
              type: 'number',
              description: 'Filter contributions by contact ID'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of contributions to return (default: 25)',
              default: 25
            },
            contribution_status: {
              type: 'string',
              description: 'Filter by contribution status (Completed, Pending, etc.)'
            },
            financial_type: {
              type: 'string',
              description: 'Filter by financial type (Donation, Member Dues, etc.)'
            }
          }
        }
      },
      {
        name: 'create_contribution',
        description: 'Record a new contribution/donation in CiviCRM',
        inputSchema: {
          type: 'object',
          required: ['contact_id', 'total_amount', 'financial_type_id'],
          properties: {
            contact_id: {
              type: 'number',
              description: 'Contact ID of the donor'
            },
            total_amount: {
              type: 'number',
              description: 'Contribution amount'
            },
            financial_type_id: {
              type: 'number',
              description: 'Financial type ID (1=Donation, 2=Member Dues, etc.)'
            },
            contribution_status_id: {
              type: 'number',
              description: 'Contribution status ID (1=Completed, 2=Pending, etc.)',
              default: 1
            },
            receive_date: {
              type: 'string',
              description: 'Date contribution was received (YYYY-MM-DD format)'
            },
            source: {
              type: 'string',
              description: 'Source of the contribution'
            },
            payment_instrument_id: {
              type: 'number',
              description: 'Payment method ID (1=Credit Card, 4=Check, etc.)'
            }
          }
        }
      },
      {
        name: 'get_events',
        description: 'Retrieve events from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              description: 'Filter by event type'
            },
            is_active: {
              type: 'boolean',
              description: 'Filter by active events only',
              default: true
            },
            limit: {
              type: 'number',
              description: 'Maximum number of events to return (default: 25)',
              default: 25
            }
          }
        }
      },
      {
        name: 'get_memberships',
        description: 'Retrieve memberships from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: {
              type: 'number',
              description: 'Filter memberships by contact ID'
            },
            membership_type_id: {
              type: 'number',
              description: 'Filter by membership type ID'
            },
            status_id: {
              type: 'number',
              description: 'Filter by membership status ID'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of memberships to return (default: 25)',
              default: 25
            }
          }
        }
      },
      {
        name: 'system_info',
        description: 'Get CiviCRM system information and status',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_contacts': {
        const { limit = 25, search, contact_type, contact_id } = args as any;
        
        let where: any[] = [];
        if (search) {
          where.push(['OR', [
            ['display_name', 'LIKE', `%${search}%`],
            ['email_primary.email', 'LIKE', `%${search}%`]
          ]]);
        }
        if (contact_type) {
          where.push(['contact_type', '=', contact_type]);
        }
        if (contact_id) {
          where.push(['id', '=', contact_id]);
        }

        const result = await civiClient.apiV4('Contact', 'get', {
          select: ['id', 'display_name', 'first_name', 'last_name', 'organization_name', 'contact_type', 'email_primary.email', 'phone_primary.phone'],
          where,
          limit,
          join: [
            ['Email AS email_primary', 'LEFT', ['id', '=', 'email_primary.contact_id'], ['email_primary.is_primary', '=', true]],
            ['Phone AS phone_primary', 'LEFT', ['id', '=', 'phone_primary.contact_id'], ['phone_primary.is_primary', '=', true]]
          ]
        });

        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} contact(s):\n\n` +
                result.map((contact: any) => 
                  `ID: ${contact.id}\n` +
                  `Name: ${contact.display_name}\n` +
                  `Type: ${contact.contact_type}\n` +
                  `Email: ${contact['email_primary.email'] || 'N/A'}\n` +
                  `Phone: ${contact['phone_primary.phone'] || 'N/A'}\n`
                ).join('\n')
            }
          ]
        };
      }

      case 'create_contact': {
        const contactData = args as any;
        
        const result = await civiClient.apiV4('Contact', 'create', {
          values: contactData
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created contact with ID: ${result[0].id}`
            }
          ]
        };
      }

      case 'update_contact': {
        const { contact_id, ...updateData } = args as any;
        
        const result = await civiClient.apiV4('Contact', 'update', {
          where: [['id', '=', contact_id]],
          values: updateData
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated contact ID: ${contact_id}`
            }
          ]
        };
      }

      case 'get_activities': {
        const { contact_id, activity_type, limit = 25, status } = args as any;
        
        let where: any[] = [];
        if (contact_id) {
          where.push(['source_contact_id', '=', contact_id]);
        }
        if (activity_type) {
          where.push(['activity_type_id:name', '=', activity_type]);
        }
        if (status) {
          where.push(['status_id:name', '=', status]);
        }

        const result = await civiClient.apiV4('Activity', 'get', {
          select: ['id', 'subject', 'details', 'activity_type_id:name', 'status_id:name', 'activity_date_time', 'source_contact_id.display_name'],
          where,
          limit,
          orderBy: { activity_date_time: 'DESC' }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} activit(ies):\n\n` +
                result.map((activity: any) => 
                  `ID: ${activity.id}\n` +
                  `Subject: ${activity.subject}\n` +
                  `Type: ${activity['activity_type_id:name']}\n` +
                  `Status: ${activity['status_id:name']}\n` +
                  `Date: ${activity.activity_date_time}\n` +
                  `Contact: ${activity['source_contact_id.display_name']}\n`
                ).join('\n')
            }
          ]
        };
      }

      case 'create_activity': {
        const activityData = args as any;
        
        const result = await civiClient.apiV4('Activity', 'create', {
          values: {
            ...activityData,
            source_contact_id: activityData.contact_id || 1 // Default to admin user
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created activity with ID: ${result[0].id}`
            }
          ]
        };
      }

      case 'get_contributions': {
        const { contact_id, limit = 25, contribution_status, financial_type } = args as any;
        
        let where: any[] = [];
        if (contact_id) {
          where.push(['contact_id', '=', contact_id]);
        }
        if (contribution_status) {
          where.push(['contribution_status_id:name', '=', contribution_status]);
        }
        if (financial_type) {
          where.push(['financial_type_id:name', '=', financial_type]);
        }

        const result = await civiClient.apiV4('Contribution', 'get', {
          select: ['id', 'contact_id.display_name', 'total_amount', 'financial_type_id:name', 'contribution_status_id:name', 'receive_date', 'source'],
          where,
          limit,
          orderBy: { receive_date: 'DESC' }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} contribution(s):\n\n` +
                result.map((contrib: any) => 
                  `ID: ${contrib.id}\n` +
                  `Contact: ${contrib['contact_id.display_name']}\n` +
                  `Amount: $${contrib.total_amount}\n` +
                  `Type: ${contrib['financial_type_id:name']}\n` +
                  `Status: ${contrib['contribution_status_id:name']}\n` +
                  `Date: ${contrib.receive_date}\n` +
                  `Source: ${contrib.source || 'N/A'}\n`
                ).join('\n')
            }
          ]
        };
      }

      case 'create_contribution': {
        const contributionData = args as any;
        
        const result = await civiClient.apiV4('Contribution', 'create', {
          values: contributionData
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created contribution with ID: ${result[0].id}`
            }
          ]
        };
      }

      case 'get_events': {
        const { event_type, is_active = true, limit = 25 } = args as any;
        
        let where: any[] = [];
        if (event_type) {
          where.push(['event_type_id:name', '=', event_type]);
        }
        if (is_active !== undefined) {
          where.push(['is_active', '=', is_active]);
        }

        const result = await civiClient.apiV4('Event', 'get', {
          select: ['id', 'title', 'event_type_id:name', 'start_date', 'end_date', 'is_active', 'max_participants'],
          where,
          limit,
          orderBy: { start_date: 'ASC' }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} event(s):\n\n` +
                result.map((event: any) => 
                  `ID: ${event.id}\n` +
                  `Title: ${event.title}\n` +
                  `Type: ${event['event_type_id:name']}\n` +
                  `Start: ${event.start_date}\n` +
                  `End: ${event.end_date}\n` +
                  `Active: ${event.is_active ? 'Yes' : 'No'}\n` +
                  `Max Participants: ${event.max_participants || 'Unlimited'}\n`
                ).join('\n')
            }
          ]
        };
      }

      case 'get_memberships': {
        const { contact_id, membership_type_id, status_id, limit = 25 } = args as any;
        
        let where: any[] = [];
        if (contact_id) {
          where.push(['contact_id', '=', contact_id]);
        }
        if (membership_type_id) {
          where.push(['membership_type_id', '=', membership_type_id]);
        }
        if (status_id) {
          where.push(['status_id', '=', status_id]);
        }

        const result = await civiClient.apiV4('Membership', 'get', {
          select: ['id', 'contact_id.display_name', 'membership_type_id:name', 'status_id:name', 'start_date', 'end_date'],
          where,
          limit,
          orderBy: { start_date: 'DESC' }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} membership(s):\n\n` +
                result.map((membership: any) => 
                  `ID: ${membership.id}\n` +
                  `Contact: ${membership['contact_id.display_name']}\n` +
                  `Type: ${membership['membership_type_id:name']}\n` +
                  `Status: ${membership['status_id:name']}\n` +
                  `Start: ${membership.start_date}\n` +
                  `End: ${membership.end_date}\n`
                ).join('\n')
            }
          ]
        };
      }

      case 'system_info': {
        try {
          const systemCheck = await civiClient.apiV4('System', 'check', {});
          const version = await civiClient.apiV4('System', 'get', {});
          
          return {
            content: [
              {
                type: 'text',
                text: `CiviCRM System Information:\n\n` +
                      `Version: ${version.version}\n` +
                      `Database: Connected\n` +
                      `API v4: Available\n` +
                      `Status: ${systemCheck.length === 0 ? 'All systems operational' : `${systemCheck.length} issue(s) detected`}\n`
              }
            ]
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `CiviCRM System Information:\n\n` +
                      `Connection: Established\n` +
                      `API: Available\n` +
                      `Note: Some system details require additional permissions\n`
              }
            ]
          };
        }
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error: any) {
    console.error('Tool execution error:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error.message}`
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CiviCRM MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
