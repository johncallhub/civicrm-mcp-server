#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

// CiviCRM API Client with Enhanced Custom Field Support
class CiviCRMClient {
  private baseUrl: string;
  private apiKey: string;
  private siteKey: string;
  private httpClient: AxiosInstance;
  private customFieldsCache: Map<string, any> = new Map();
  private customFieldMappings: Map<string, string> = new Map();

  constructor(baseUrl: string, apiKey: string, siteKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.siteKey = siteKey;
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'CiviCRM-MCP-Server/1.2'
      }
    });
  }

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

  async loadCustomFields(): Promise<void> {
    try {
      const customFieldsResponse = await this.apiV4('CustomField', 'get', {
        select: ['id', 'name', 'label', 'custom_group_id.name', 'custom_group_id.extends', 'data_type', 'html_type'],
        where: [['is_active', '=', true]],
        limit: 0
      });

      const customFields = customFieldsResponse.values || [];
      for (const field of customFields) {
        const groupName = field['custom_group_id.name'];
        const fieldName = field.name;
        const fieldLabel = field.label;
        const extendedEntity = field['custom_group_id.extends'];
        
        const apiFieldName = `${groupName}.${fieldName}`;
        this.customFieldMappings.set(fieldLabel.toLowerCase(), apiFieldName);
        this.customFieldMappings.set(fieldName.toLowerCase(), apiFieldName);
        
        this.customFieldsCache.set(apiFieldName, {
          id: field.id,
          name: fieldName,
          label: fieldLabel,
          group: groupName,
          extends: extendedEntity,
          dataType: field.data_type,
          htmlType: field.html_type
        });
      }
    } catch (error) {
      console.error('Failed to load custom fields:', error);
    }
  }

  getCustomFieldApiName(humanName: string): string | null {
    return this.customFieldMappings.get(humanName.toLowerCase()) || null;
  }

  getCustomFieldsForEntity(entityType: string): any[] {
    const fields: any[] = [];
    for (const [apiName, metadata] of this.customFieldsCache) {
      if (metadata.extends === entityType) {
        fields.push({
          apiName,
          ...metadata
        });
      }
    }
    return fields;
  }

  async getContactsWithCustomFields(params: any): Promise<any> {
    if (this.customFieldsCache.size === 0) {
      await this.loadCustomFields();
    }

    const { limit = 25, search, contact_type, contact_id, include_custom_fields = true } = params;
    
    let where: any[] = [];
    let select = ['id', 'display_name', 'first_name', 'last_name', 'organization_name', 'contact_type'];

    const joins = [
      ['Email AS email_primary', 'LEFT', ['id', '=', 'email_primary.contact_id'], ['email_primary.is_primary', '=', true]],
      ['Phone AS phone_primary', 'LEFT', ['id', '=', 'phone_primary.contact_id'], ['phone_primary.is_primary', '=', true]]
    ];

    select.push('email_primary.email', 'phone_primary.phone');

    if (include_custom_fields) {
      const contactCustomFields = this.getCustomFieldsForEntity('Contact');
      for (const field of contactCustomFields) {
        select.push(field.apiName);
      }
    }

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

    const result = await this.apiV4('Contact', 'get', {
      select,
      where,
      limit,
      join: joins
    });

    return result.values || [];
  }

  async createContactWithCustomFields(contactData: any): Promise<any> {
    if (this.customFieldsCache.size === 0) {
      await this.loadCustomFields();
    }

    const standardFields: any = {};
    const customFields: any = {};

    for (const [key, value] of Object.entries(contactData)) {
      const customFieldApiName = this.getCustomFieldApiName(key);
      if (customFieldApiName) {
        customFields[customFieldApiName] = value;
      } else {
        standardFields[key] = value;
      }
    }

    const mergedData = { ...standardFields, ...customFields };

    const result = await this.apiV4('Contact', 'create', {
      values: mergedData
    });

    return result;
  }

  formatResults(result: any, entityType: string): string {
    if (result.error) {
      return `Error: ${result.error}`;
    }

    const values = result.values || result;
    const count = Array.isArray(values) ? values.length : (values ? 1 : 0);
    
    if (count === 0) {
      return `Found 0 ${entityType}(s):\n\n`;
    }

    let formatted = `Found ${count} ${entityType}(s):\n\n`;
    const items = Array.isArray(values) ? values : [values];
    
    for (const item of items) {
      formatted += this.formatSingleEntity(item, entityType);
      formatted += '\n';
    }
    
    return formatted;
  }

  private formatSingleEntity(item: any, entityType: string): string {
    let output = `ID: ${item.id || 'N/A'}\n`;
    
    switch (entityType) {
      case 'contact':
        output += `Name: ${item.display_name || 'N/A'}\n`;
        output += `Type: ${item.contact_type || 'N/A'}\n`;
        output += `Email: ${item['email_primary.email'] || 'N/A'}\n`;
        output += `Phone: ${item['phone_primary.phone'] || 'N/A'}\n`;
        break;
        
      case 'activity':
        output += `Subject: ${item.subject || 'N/A'}\n`;
        output += `Type: ${item['activity_type_id.label'] || item.activity_type_id || 'N/A'}\n`;
        output += `Status: ${item['status_id.label'] || item.status_id || 'N/A'}\n`;
        output += `Date: ${item.activity_date_time || 'N/A'}\n`;
        output += `Contact ID: ${item.source_contact_id || 'N/A'}\n`;
        output += `Details: ${item.details || 'N/A'}\n`;
        break;
        
      case 'contribution':
        output += `Contact ID: ${item.contact_id || 'N/A'}\n`;
        output += `Amount: ${item.total_amount || 'N/A'}\n`;
        output += `Financial Type: ${item['financial_type_id.label'] || item.financial_type_id || 'N/A'}\n`;
        output += `Status: ${item['contribution_status_id.label'] || item.contribution_status_id || 'N/A'}\n`;
        output += `Receive Date: ${item.receive_date || 'N/A'}\n`;
        output += `Source: ${item.source || 'N/A'}\n`;
        break;
        
      case 'event':
        output += `Title: ${item.title || 'N/A'}\n`;
        output += `Event Type: ${item['event_type_id.label'] || item.event_type_id || 'N/A'}\n`;
        output += `Start Date: ${item.start_date || 'N/A'}\n`;
        output += `End Date: ${item.end_date || 'N/A'}\n`;
        output += `Max Participants: ${item.max_participants || 'N/A'}\n`;
        output += `Active: ${item.is_active ? 'Yes' : 'No'}\n`;
        output += `Public: ${item.is_public ? 'Yes' : 'No'}\n`;
        break;
        
      case 'membership':
        output += `Contact ID: ${item.contact_id || 'N/A'}\n`;
        output += `Type: ${item['membership_type_id.name'] || item.membership_type_id || 'N/A'}\n`;
        output += `Status: ${item['status_id.label'] || item.status_id || 'N/A'}\n`;
        output += `Start Date: ${item.start_date || 'N/A'}\n`;
        output += `End Date: ${item.end_date || 'N/A'}\n`;
        output += `Source: ${item.source || 'N/A'}\n`;
        break;
        
      case 'case':
        output += `Contact ID: ${item.contact_id || 'N/A'}\n`;
        output += `Case Type: ${item['case_type_id.title'] || item.case_type_id || 'N/A'}\n`;
        output += `Status: ${item['status_id.label'] || item.status_id || 'N/A'}\n`;
        output += `Start Date: ${item.start_date || 'N/A'}\n`;
        output += `End Date: ${item.end_date || 'N/A'}\n`;
        output += `Subject: ${item.subject || 'N/A'}\n`;
        break;
        
      case 'campaign':
        output += `Name: ${item.name || 'N/A'}\n`;
        output += `Title: ${item.title || 'N/A'}\n`;
        output += `Type: ${item['campaign_type_id.label'] || item.campaign_type_id || 'N/A'}\n`;
        output += `Status: ${item['status_id.label'] || item.status_id || 'N/A'}\n`;
        output += `Start Date: ${item.start_date || 'N/A'}\n`;
        output += `End Date: ${item.end_date || 'N/A'}\n`;
        output += `Goal Revenue: ${item.goal_revenue || 'N/A'}\n`;
        break;
        
      case 'group':
        output += `Name: ${item.name || 'N/A'}\n`;
        output += `Title: ${item.title || 'N/A'}\n`;
        output += `Type: ${item.group_type || 'N/A'}\n`;
        output += `Visibility: ${item.visibility || 'N/A'}\n`;
        output += `Active: ${item.is_active ? 'Yes' : 'No'}\n`;
        output += `Description: ${item.description || 'N/A'}\n`;
        break;
        
      case 'relationship':
        output += `Contact A ID: ${item.contact_id_a || 'N/A'}\n`;
        output += `Contact B ID: ${item.contact_id_b || 'N/A'}\n`;
        output += `Type ID: ${item.relationship_type_id || 'N/A'}\n`;
        output += `Start Date: ${item.start_date || 'N/A'}\n`;
        output += `End Date: ${item.end_date || 'N/A'}\n`;
        output += `Active: ${item.is_active ? 'Yes' : 'No'}\n`;
        break;
        
      default:
        for (const [key, value] of Object.entries(item)) {
          if (key !== 'id' && value !== null && value !== undefined) {
            output += `${key}: ${value}\n`;
          }
        }
    }
    
    // Add custom fields
    for (const [key, value] of Object.entries(item)) {
      if (key.includes('.') && !key.includes('email_primary') && !key.includes('phone_primary')) {
        output += `${key}: ${value || 'N/A'}\n`;
      }
    }
    
    return output;
  }
}

// Initialize CiviCRM client
const baseUrl = process.env.CIVICRM_BASE_URL || '';
const apiKey = process.env.CIVICRM_API_KEY || '';
const siteKey = process.env.CIVICRM_SITE_KEY || '';

if (!baseUrl || !apiKey || !siteKey) {
  console.error('Missing required environment variables: CIVICRM_BASE_URL, CIVICRM_API_KEY, CIVICRM_SITE_KEY');
  process.exit(1);
}

const civiClient = new CiviCRMClient(baseUrl, apiKey, siteKey);

// Create server instance
const server = new Server(
  {
    name: 'enhanced-civicrm-server',
    version: '1.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_contacts',
        description: 'Search and retrieve contacts from CiviCRM including custom fields',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'number', description: 'Get specific contact by ID' },
            search: { type: 'string', description: 'Search term to filter contacts by name or email' },
            contact_type: { type: 'string', enum: ['Individual', 'Organization', 'Household'], description: 'Filter by contact type' },
            limit: { type: 'number', default: 25, description: 'Maximum number of contacts to return (default: 25)' },
            include_custom_fields: { type: 'boolean', default: true, description: 'Include custom fields in results (default: true)' }
          }
        },
      },
      {
        name: 'create_contact',
        description: 'Create a new contact in CiviCRM with custom field support',
        inputSchema: {
          type: 'object',
          properties: {
            contact_type: { type: 'string', enum: ['Individual', 'Organization', 'Household'], description: 'Type of contact to create' },
            first_name: { type: 'string', description: 'First name (for Individual contacts)' },
            last_name: { type: 'string', description: 'Last name (for Individual contacts)' },
            organization_name: { type: 'string', description: 'Organization name (for Organization contacts)' },
            email: { type: 'string', description: 'Primary email address' },
            phone: { type: 'string', description: 'Primary phone number' },
            custom_fields: { type: 'object', description: 'Custom fields as key-value pairs' }
          },
          required: ['contact_type']
        },
      },
      {
        name: 'update_contact',
        description: 'Update an existing contact in CiviCRM including custom fields',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'number', description: 'ID of the contact to update' },
            first_name: { type: 'string', description: 'First name' },
            last_name: { type: 'string', description: 'Last name' },
            organization_name: { type: 'string', description: 'Organization name' },
            email: { type: 'string', description: 'Primary email address' },
            phone: { type: 'string', description: 'Primary phone number' },
            custom_fields: { type: 'object', description: 'Custom fields to update as key-value pairs' }
          },
          required: ['contact_id']
        },
      },
      {
        name: 'list_custom_fields',
        description: 'List all available custom fields for an entity type',
        inputSchema: {
          type: 'object',
          properties: {
            entity_type: { type: 'string', default: 'Contact', description: 'Entity type to get custom fields for (Contact, Activity, Contribution, etc.)' }
          }
        },
      },
      {
        name: 'get_activities',
        description: 'Retrieve activities from CiviCRM including custom fields',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'number', description: 'Filter activities by contact ID' },
            activity_type: { type: 'string', description: 'Filter by activity type (Meeting, Phone Call, Email, etc.)' },
            status: { type: 'string', description: 'Filter by activity status (Scheduled, Completed, etc.)' },
            limit: { type: 'number', default: 25, description: 'Maximum number of activities to return (default: 25)' },
            include_custom_fields: { type: 'boolean', default: true, description: 'Include custom fields in results (default: true)' }
          }
        },
      },
      {
        name: 'create_activity',
        description: 'Create a new activity in CiviCRM with custom fields',
        inputSchema: {
          type: 'object',
          properties: {
            activity_type_id: { type: 'number', description: 'Activity type ID (1=Meeting, 2=Phone Call, 3=Email, etc.)' },
            subject: { type: 'string', description: 'Activity subject/title' },
            details: { type: 'string', description: 'Activity details/description' },
            activity_date_time: { type: 'string', description: 'Activity date/time (YYYY-MM-DD HH:MM:SS format)' },
            status_id: { type: 'number', description: 'Activity status ID (1=Scheduled, 2=Completed, etc.)' },
            contact_id: { type: 'number', description: 'Primary contact ID for the activity' },
            target_contact_id: { type: 'number', description: 'Target contact ID (who the activity is with)' },
            custom_fields: { type: 'object', description: 'Custom fields as key-value pairs' }
          },
          required: ['activity_type_id', 'subject']
        },
      },
      {
        name: 'get_contributions',
        description: 'Retrieve contributions/donations from CiviCRM including custom fields',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'number', description: 'Filter contributions by contact ID' },
            contribution_status: { type: 'string', description: 'Filter by contribution status (Completed, Pending, etc.)' },
            financial_type: { type: 'string', description: 'Filter by financial type (Donation, Member Dues, etc.)' },
            limit: { type: 'number', default: 25, description: 'Maximum number of contributions to return (default: 25)' },
            include_custom_fields: { type: 'boolean', default: true, description: 'Include custom fields in results (default: true)' }
          }
        },
      },
      {
        name: 'create_contribution',
        description: 'Record a new contribution/donation in CiviCRM with custom fields',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'number', description: 'Contact ID of the donor' },
            total_amount: { type: 'number', description: 'Contribution amount' },
            financial_type_id: { type: 'number', description: 'Financial type ID (1=Donation, 2=Member Dues, etc.)' },
            contribution_status_id: { type: 'number', default: 1, description: 'Contribution status ID (1=Completed, 2=Pending, etc.)' },
            receive_date: { type: 'string', description: 'Date contribution was received (YYYY-MM-DD format)' },
            source: { type: 'string', description: 'Source of the contribution' },
            payment_instrument_id: { type: 'number', description: 'Payment method ID (1=Credit Card, 4=Check, etc.)' },
            custom_fields: { type: 'object', description: 'Custom fields as key-value pairs' }
          },
          required: ['contact_id', 'total_amount', 'financial_type_id']
        },
      },
      {
        name: 'get_events',
        description: 'Retrieve events from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            event_type: { type: 'string', description: 'Filter by event type' },
            is_active: { type: 'boolean', default: true, description: 'Filter by active events only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of events to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_memberships',
        description: 'Retrieve memberships from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'number', description: 'Filter memberships by contact ID' },
            membership_type_id: { type: 'number', description: 'Filter by membership type ID' },
            status_id: { type: 'number', description: 'Filter by membership status ID' },
            limit: { type: 'number', default: 25, description: 'Maximum number of memberships to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_groups',
        description: 'Retrieve groups from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            group_type: { type: 'string', description: 'Filter by group type (Access Control, Mailing List, etc.)' },
            is_active: { type: 'boolean', default: true, description: 'Filter by active groups only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of groups to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_tags',
        description: 'Retrieve tags from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            used_for: { type: 'string', description: 'Filter by what entity the tag is used for (Contact, Activity, etc.)' },
            is_selectable: { type: 'boolean', description: 'Filter by selectable tags only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of tags to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_relationships',
        description: 'Retrieve relationships from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id_a: { type: 'number', description: 'Filter by first contact ID in relationship' },
            contact_id_b: { type: 'number', description: 'Filter by second contact ID in relationship' },
            relationship_type_id: { type: 'number', description: 'Filter by relationship type ID' },
            is_active: { type: 'boolean', default: true, description: 'Filter by active relationships only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of relationships to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_cases',
        description: 'Retrieve cases from CiviCRM (if CiviCase is enabled)',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'number', description: 'Filter cases by contact ID' },
            case_type_id: { type: 'number', description: 'Filter by case type ID' },
            status_id: { type: 'number', description: 'Filter by case status ID' },
            is_deleted: { type: 'boolean', default: false, description: 'Include deleted cases' },
            limit: { type: 'number', default: 25, description: 'Maximum number of cases to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_campaigns',
        description: 'Retrieve campaigns from CiviCRM (if CiviCampaign is enabled)',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_type_id: { type: 'number', description: 'Filter by campaign type ID' },
            status_id: { type: 'number', description: 'Filter by campaign status ID' },
            is_active: { type: 'boolean', default: true, description: 'Filter by active campaigns only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of campaigns to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_option_values',
        description: 'Retrieve option values from CiviCRM option groups',
        inputSchema: {
          type: 'object',
          properties: {
            option_group_id: { type: 'number', description: 'Option group ID to retrieve values from' },
            option_group_name: { type: 'string', description: 'Option group name (alternative to ID)' },
            is_active: { type: 'boolean', default: true, description: 'Filter by active option values only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of option values to return (default: 25)' }
          }
        },
      },
      {
        name: 'list_option_groups',
        description: 'List all option groups in CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            is_active: { type: 'boolean', default: true, description: 'Filter by active option groups only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of option groups to return (default: 25)' }
          }
        },
      },
      {
        name: 'get_reports',
        description: 'Retrieve available reports from CiviCRM',
        inputSchema: {
          type: 'object',
          properties: {
            component: { type: 'string', description: 'Filter by CiviCRM component (CiviContribute, CiviEvent, etc.)' },
            is_active: { type: 'boolean', default: true, description: 'Filter by active reports only' },
            limit: { type: 'number', default: 25, description: 'Maximum number of reports to return (default: 25)' }
          }
        },
      },
      {
        name: 'system_info',
        description: 'Get CiviCRM system information and status',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_contacts': {
        const { contact_id, search, contact_type, limit = 25, include_custom_fields = true } = args as any;
        let where: any[] = [];
        let select = ['id', 'display_name', 'first_name', 'last_name', 'organization_name', 'contact_type'];

        const joins = [
          ['Email AS email_primary', 'LEFT', ['id', '=', 'email_primary.contact_id'], ['email_primary.is_primary', '=', true]],
          ['Phone AS phone_primary', 'LEFT', ['id', '=', 'phone_primary.contact_id'], ['phone_primary.is_primary', '=', true]]
        ];
        select.push('email_primary.email', 'phone_primary.phone');
        
        if (include_custom_fields) {
          if (civiClient['customFieldsCache'].size === 0) await civiClient.loadCustomFields();
          const contactCustomFields = civiClient.getCustomFieldsForEntity('Contact');
          for (const field of contactCustomFields) select.push(field.apiName);
        }
        
        if (search) where.push(['OR', [['display_name', 'LIKE', `%${search}%`], ['email_primary.email', 'LIKE', `%${search}%`]]]);
        if (contact_type) where.push(['contact_type', '=', contact_type]);
        if (contact_id) where.push(['id', '=', contact_id]);
        
        const result = await civiClient.apiV4('Contact', 'get', { select, where, limit, join: joins });
        return { content: [{ type: 'text', text: civiClient.formatResults(result, 'contact') }] };
      }

      case 'create_contact': {
        if (civiClient['customFieldsCache'].size === 0) await civiClient.loadCustomFields();
        const { custom_fields, ...standardFields } = args as any;
        const processedData: any = { ...standardFields };
        
        if (custom_fields) {
          for (const [key, value] of Object.entries(custom_fields)) {
            const customFieldApiName = civiClient.getCustomFieldApiName(key);
            if (customFieldApiName) processedData[customFieldApiName] = value;
            else processedData[key] = value;
          }
        }
        
        const result = await civiClient.apiV4('Contact', 'create', { values: processedData });
        const contactId = result.values?.[0]?.id || result.id;
        return { content: [{ type: 'text', text: `Successfully created contact with ID: ${contactId}` }] };
      }

      case 'update_contact': {
        const { contact_id, custom_fields, ...updateData } = args as any;
        const processedData: any = { ...updateData };
        
        if (custom_fields) {
          for (const [key, value] of Object.entries(custom_fields)) {
            const customFieldApiName = civiClient.getCustomFieldApiName(key);
            if (customFieldApiName) processedData[customFieldApiName] = value;
            else processedData[key] = value;
          }
        }
        
        await civiClient.apiV4('Contact', 'update', { where: [['id', '=', contact_id]], values: processedData });
        return { content: [{ type: 'text', text: `Successfully updated contact ID: ${contact_id}` }] };
      }

      case 'list_custom_fields': {
        const { entity_type = 'Contact' } = args as any;
        if (civiClient['customFieldsCache'].size === 0) await civiClient.loadCustomFields();
        const customFields = civiClient.getCustomFieldsForEntity(entity_type);
        return {
          content: [{
            type: 'text',
            text: customFields.length > 0 ? 
              `Custom fields for ${entity_type}:\n\n` + customFields.map((field: any) => 
                `Label: ${field.label}\nField Name: ${field.name}\nAPI Name: ${field.apiName}\nData Type: ${field.dataType}\nGroup: ${field.group}\n`
              ).join('\n') : `No custom fields found for ${entity_type}`
          }]
        };
      }

      case 'get_activities': {
        const { contact_id, activity_type, limit = 25, status, include_custom_fields = true } = args as any;
        let where: any[] = [];
        let select = ['id', 'subject', 'activity_type_id', 'status_id', 'activity_date_time', 'source_contact_id', 'details'];
        
        if (include_custom_fields) {
          if (civiClient['customFieldsCache'].size === 0) await civiClient.loadCustomFields();
          const activityCustomFields = civiClient.getCustomFieldsForEntity('Activity');
          for (const field of activityCustomFields) select.push(field.apiName);
        }
        
        if (contact_id) where.push(['source_contact_id', '=', contact_id]);
        if (activity_type) where.push(['activity_type_id.name', '=', activity_type]);
        if (status) where.push(['status_id.name', '=', status]);
        
        const result = await civiClient.apiV4('Activity', 'get', { select, where, limit, orderBy: { activity_date_time: 'DESC' } });
        return { content: [{ type: 'text', text: civiClient.formatResults(result, 'activity') }] };
      }

      case 'create_activity': {
        const { custom_fields, ...activityData } = args as any;
        const processedData: any = { ...activityData };
        
        if (custom_fields) {
          for (const [key, value] of Object.entries(custom_fields)) {
            const customFieldApiName = civiClient.getCustomFieldApiName(key);
            if (customFieldApiName) processedData[customFieldApiName] = value;
            else processedData[key] = value;
          }
        }
        
        const result = await civiClient.apiV4('Activity', 'create', { values: processedData });
        const activityId = result.values?.[0]?.id || result.id;
        return { content: [{ type: 'text', text: `Successfully created activity with ID: ${activityId}` }] };
      }

      case 'get_contributions': {
        const { contact_id, limit = 25, contribution_status, financial_type, include_custom_fields = true } = args as any;
        let where: any[] = [];
        let select = ['id', 'contact_id', 'total_amount', 'financial_type_id', 'contribution_status_id', 'receive_date', 'source'];
        
        if (include_custom_fields) {
          if (civiClient['customFieldsCache'].size === 0) await civiClient.loadCustomFields();
          const contributionCustomFields = civiClient.getCustomFieldsForEntity('Contribution');
          for (const field of contributionCustomFields) select.push(field.apiName);
        }
        
        if (contact_id) where.push(['contact_id', '=', contact_id]);
        if (contribution_status) where.push(['contribution_status_id.name', '=', contribution_status]);
        if (financial_type) where.push(['financial_type_id.name', '=', financial_type]);
        
        const result = await civiClient.apiV4('Contribution', 'get', { select, where, limit, orderBy: { receive_date: 'DESC' } });
        return { content: [{ type: 'text', text: civiClient.formatResults(result, 'contribution') }] };
      }

      case 'create_contribution': {
        const { custom_fields, ...contributionData } = args as any;
        const processedData: any = { ...contributionData };
        
        if (custom_fields) {
          for (const [key, value] of Object.entries(custom_fields)) {
            const customFieldApiName = civiClient.getCustomFieldApiName(key);
            if (customFieldApiName) processedData[customFieldApiName] = value;
            else processedData[key] = value;
          }
        }
        
        const result = await civiClient.apiV4('Contribution', 'create', { values: processedData });
        const contributionId = result.values?.[0]?.id || result.id;
        return { content: [{ type: 'text', text: `Successfully created contribution with ID: ${contributionId}` }] };
      }

      case 'get_events': {
        const { event_type, is_active = true, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (is_active !== undefined) where.push(['is_active', '=', is_active]);
        if (event_type) where.push(['event_type_id.name', '=', event_type]);
        
        const result = await civiClient.apiV4('Event', 'get', {
          select: ['id', 'title', 'event_type_id', 'start_date', 'end_date', 'max_participants', 'is_active', 'is_public'],
          where, limit, orderBy: { start_date: 'ASC' }
        });
        return { content: [{ type: 'text', text: civiClient.formatResults(result, 'event') }] };
      }

      case 'get_memberships': {
        const { contact_id, membership_type_id, status_id, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (contact_id) where.push(['contact_id', '=', contact_id]);
        if (membership_type_id) where.push(['membership_type_id', '=', membership_type_id]);
        if (status_id) where.push(['status_id', '=', status_id]);
        
        const result = await civiClient.apiV4('Membership', 'get', {
          select: ['id', 'contact_id', 'membership_type_id', 'status_id', 'start_date', 'end_date', 'source'],
          where, limit, orderBy: { start_date: 'DESC' }
        });
        return { content: [{ type: 'text', text: civiClient.formatResults(result, 'membership') }] };
      }

      case 'get_groups': {
        const { group_type, is_active = true, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (is_active !== undefined) where.push(['is_active', '=', is_active]);
        if (group_type) where.push(['group_type', 'LIKE', `%${group_type}%`]);
        
        const result = await civiClient.apiV4('Group', 'get', {
          select: ['id', 'name', 'title', 'description', 'group_type', 'visibility', 'is_active'],
          where, limit
        });
        return { content: [{ type: 'text', text: civiClient.formatResults(result, 'group') }] };
      }

      case 'get_tags': {
        const { used_for, is_selectable, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (used_for) where.push(['used_for', 'LIKE', `%${used_for}%`]);
        if (is_selectable !== undefined) where.push(['is_selectable', '=', is_selectable]);
        
        const result = await civiClient.apiV4('Tag', 'get', {
          select: ['id', 'name', 'description', 'used_for', 'is_selectable', 'color'],
          where, limit
        });
        const tags = result.values || [];
        return {
          content: [{
            type: 'text',
            text: `Found ${tags.length} tag(s):\n\n` +
              tags.map((tag: any) => 
                `ID: ${tag.id}\nName: ${tag.name}\nUsed For: ${tag.used_for}\nSelectable: ${tag.is_selectable ? 'Yes' : 'No'}\nColor: ${tag.color || 'N/A'}\nDescription: ${tag.description || 'N/A'}\n`
              ).join('\n')
          }]
        };
      }

      case 'get_relationships': {
        const { contact_id_a, contact_id_b, relationship_type_id, is_active = true, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (contact_id_a) where.push(['contact_id_a', '=', contact_id_a]);
        if (contact_id_b) where.push(['contact_id_b', '=', contact_id_b]);
        if (relationship_type_id) where.push(['relationship_type_id', '=', relationship_type_id]);
        if (is_active !== undefined) where.push(['is_active', '=', is_active]);
        
        const result = await civiClient.apiV4('Relationship', 'get', {
          select: ['id', 'contact_id_a', 'contact_id_b', 'relationship_type_id', 'start_date', 'end_date', 'is_active'],
          where, limit
        });
        return { content: [{ type: 'text', text: civiClient.formatResults(result, 'relationship') }] };
      }

      case 'get_cases': {
        const { contact_id, case_type_id, status_id, is_deleted = false, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (contact_id) where.push(['contact_id', '=', contact_id]);
        if (case_type_id) where.push(['case_type_id', '=', case_type_id]);
        if (status_id) where.push(['status_id', '=', status_id]);
        if (is_deleted !== undefined) where.push(['is_deleted', '=', is_deleted]);
        
        try {
          const result = await civiClient.apiV4('Case', 'get', {
            select: ['id', 'contact_id', 'case_type_id', 'status_id', 'start_date', 'end_date', 'subject'],
            where, limit
          });
          return { content: [{ type: 'text', text: civiClient.formatResults(result, 'case') }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Error accessing cases (CiviCase may not be enabled): ${error.message}` }] };
        }
      }

      case 'get_campaigns': {
        const { campaign_type_id, status_id, is_active = true, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (campaign_type_id) where.push(['campaign_type_id', '=', campaign_type_id]);
        if (status_id) where.push(['status_id', '=', status_id]);
        if (is_active !== undefined) where.push(['is_active', '=', is_active]);
        
        try {
          const result = await civiClient.apiV4('Campaign', 'get', {
            select: ['id', 'name', 'title', 'campaign_type_id', 'status_id', 'start_date', 'end_date', 'goal_revenue'],
            where, limit
          });
          return { content: [{ type: 'text', text: civiClient.formatResults(result, 'campaign') }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Error accessing campaigns (CiviCampaign may not be enabled): ${error.message}` }] };
        }
      }

      case 'get_option_values': {
        const { option_group_id, option_group_name, is_active = true, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (option_group_id) where.push(['option_group_id', '=', option_group_id]);
        if (option_group_name) where.push(['option_group_id.name', '=', option_group_name]);
        if (is_active !== undefined) where.push(['is_active', '=', is_active]);
        
        const result = await civiClient.apiV4('OptionValue', 'get', {
          select: ['id', 'option_group_id', 'label', 'value', 'name', 'description', 'weight', 'is_active'],
          where, limit, orderBy: { weight: 'ASC' }
        });
        const optionValues = result.values || [];
        return {
          content: [{
            type: 'text',
            text: `Found ${optionValues.length} option value(s):\n\n` +
              optionValues.map((option: any) => 
                `ID: ${option.id}\nLabel: ${option.label}\nValue: ${option.value}\nName: ${option.name}\nGroup ID: ${option.option_group_id}\nWeight: ${option.weight}\nActive: ${option.is_active ? 'Yes' : 'No'}\nDescription: ${option.description || 'N/A'}\n`
              ).join('\n')
          }]
        };
      }

      case 'list_option_groups': {
        const { is_active = true, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (is_active !== undefined) where.push(['is_active', '=', is_active]);
        
        const result = await civiClient.apiV4('OptionGroup', 'get', {
          select: ['id', 'name', 'title', 'description', 'data_type', 'is_active'],
          where, limit, orderBy: { title: 'ASC' }
        });
        const optionGroups = result.values || [];
        return {
          content: [{
            type: 'text',
            text: `Found ${optionGroups.length} option group(s):\n\n` +
              optionGroups.map((group: any) => 
                `ID: ${group.id}\nName: ${group.name}\nTitle: ${group.title}\nData Type: ${group.data_type || 'N/A'}\nActive: ${group.is_active ? 'Yes' : 'No'}\nDescription: ${group.description || 'N/A'}\n`
              ).join('\n')
          }]
        };
      }

      case 'get_reports': {
        const { component, is_active = true, limit = 25 } = args as any;
        let where: any[] = [];
        
        if (component) where.push(['component', '=', component]);
        if (is_active !== undefined) where.push(['is_active', '=', is_active]);
        
        try {
          const result = await civiClient.apiV4('ReportTemplate', 'get', {
            select: ['id', 'label', 'description', 'class_name', 'report_url', 'component', 'is_active'],
            where, limit
          });
          const reports = result.values || [];
          return {
            content: [{
              type: 'text',
              text: `Found ${reports.length} report(s):\n\n` +
                reports.map((report: any) => 
                  `ID: ${report.id}\nLabel: ${report.label}\nComponent: ${report.component || 'N/A'}\nClass: ${report.class_name || 'N/A'}\nURL: ${report.report_url || 'N/A'}\nActive: ${report.is_active ? 'Yes' : 'No'}\nDescription: ${report.description || 'N/A'}\n`
                ).join('\n')
            }]
          };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Error accessing reports: ${error.message}` }] };
        }
      }

      case 'system_info': {
        try {
          const systemCheck = await civiClient.apiV4('System', 'check', {});
          const systemInfo = await civiClient.apiV4('Setting', 'get', {
            select: ['civicrm_version', 'uf_version', 'db_version'], limit: 10
          });
          
          let output = '=== CIVICRM SYSTEM INFORMATION ===\n\n';
          
          if (systemInfo.values && systemInfo.values.length > 0) {
            const info = systemInfo.values[0];
            output += `CiviCRM Version: ${info.civicrm_version || 'Unknown'}\n`;
            output += `Database Version: ${info.db_version || 'Unknown'}\n`;
            output += `UF Version: ${info.uf_version || 'Unknown'}\n\n`;
          }
          
          if (systemCheck.values && systemCheck.values.length > 0) {
            output += 'SYSTEM STATUS CHECKS:\n';
            systemCheck.values.forEach((check: any) => {
              output += `- ${check.title}: ${check.severity}\n`;
              if (check.message) output += `  ${check.message}\n`;
            });
          }
          
          return { content: [{ type: 'text', text: output }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Error retrieving system information: ${error.message}` }] };
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    console.error('Tool execution error:', error);
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Enhanced CiviCRM MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
