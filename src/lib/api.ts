import type { SaveTodosRequest, SaveSessionsRequest, ApiResponse, Todo, TodoPatch, TodoFileItem } from '../types';

// Mocked API client for MVP - all saves are stubbed
export class ApiClient {
  constructor() {
    // Base URL will be used for future webhook implementation
  }

  // Stubbed method for saving todos
  async saveTodos(request: SaveTodosRequest): Promise<ApiResponse> {
    console.log('🔄 Mock API: Saving todos', request);
    
    // Simulate network delay (~300ms as per spec)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock success response
    return {
      success: true,
      data: {
        message: 'Todos saved successfully',
        count: request.todos.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  // New mocked batch endpoint for todos
  async postTodosBatch(payload: { updates: TodoPatch[]; completes: string[] }): Promise<ApiResponse> {
    console.log('🔄 Mock API: Todos batch', payload);
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, data: { message: 'Todos batch applied', updates: payload.updates.length, completes: payload.completes.length } };
  }

  // New mocked full-file endpoint for todos
  async postTodosFile(payload: TodoFileItem[]): Promise<ApiResponse> {
    console.log('📄 Mock API: Todos file save', { count: payload.length, first: payload[0], last: payload[payload.length - 1] });
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, data: { message: 'Todos file saved', count: payload.length } };
  }

  // Stubbed method for saving sessions
  async saveSessions(request: SaveSessionsRequest): Promise<ApiResponse> {
    console.log('🔄 Mock API: Saving sessions', request);
    
    // Simulate network delay (~300ms as per spec)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock success response
    return {
      success: true,
      data: {
        message: 'Sessions saved successfully',
        count: request.sessions.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  // New mocked webhook: complete a todo
  async postComplete(payload: { id: string; task: string; completed_at: string }): Promise<ApiResponse> {
    console.log('✅ Mock API: Complete todo', payload);
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, data: { message: 'Todo completed', ...payload } };
  }

  // Future webhook endpoints (disabled in MVP)
  // private async makeRequest<T>(
  //   endpoint: string,
  //   method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  //   body?: any
  // ): Promise<ApiResponse<T>> {
  //   // This would be the real implementation for future webhooks
  //   throw new Error(`Webhook ${endpoint} not implemented in MVP`);
  // }
}

// Webhook configuration
const N8N_WEBHOOK_URL = 'https://geronimo.askdavidstone.com/webhook/todo';
const N8N_WEBHOOK_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN || '';

// Webhook function to fetch todos
export const fetchTodosFromWebhook = async (): Promise<Todo[]> => {
  try {
    if (!N8N_WEBHOOK_TOKEN) {
      throw new Error('N8N webhook token not configured. Please set VITE_N8N_WEBHOOK_TOKEN in your environment.');
    }

    console.log('🔑 Using token:', N8N_WEBHOOK_TOKEN);
    console.log('🌐 Making request to:', N8N_WEBHOOK_URL);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Webhook response error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('📦 Webhook response data:', data);
    console.log('📦 Data type:', typeof data);
    console.log('📦 Is array?', Array.isArray(data));
    
    // Transform the data to match our Todo interface
    // The webhook returns an array with one object containing a 'data' property with the todos
    if (Array.isArray(data) && data.length > 0 && data[0].data && Array.isArray(data[0].data)) {
      const todos = data[0].data;
      return todos.map((todo: any) => ({
        id: String(todo.id),
        task: todo.task,
        category: todo.category || null,
        priority: todo.priority || null,
        created_at: todo.created_at,
        statusUi: 'open' as const,
        _dirty: false,
      }));
    } else {
      console.error('❌ Response format not recognized:', data);
      throw new Error('Invalid response format: expected array with data property containing todos');
    }
  } catch (error) {
    console.error('Failed to fetch todos from webhook:', error);
    throw error;
  }
};

// Export singleton instance
export const apiClient = new ApiClient();

// Export function for compatibility with spec
export const postToBackend = async (endpoint: string, data: any): Promise<ApiResponse> => {
  if (endpoint.includes('todo')) {
    return apiClient.saveTodos(data);
  } else if (endpoint.includes('session')) {
    return apiClient.saveSessions(data);
  }
  throw new Error(`Unknown endpoint: ${endpoint}`);
};

// Explicit complete endpoint for clarity with new spec
export const postComplete = async (todo: Todo & { completed_at: string }): Promise<ApiResponse> => {
  return apiClient.postComplete({ id: String(todo.id), task: todo.task, completed_at: todo.completed_at });
};

// Explicit export for batch API
export const postTodosBatch = async (payload: { updates: TodoPatch[]; completes: string[] }): Promise<ApiResponse> => {
  return apiClient.postTodosBatch(payload);
};

// Explicit export for full-file API
export const postTodosFile = async (payload: TodoFileItem[]): Promise<ApiResponse> => {
  return apiClient.postTodosFile(payload);
};
