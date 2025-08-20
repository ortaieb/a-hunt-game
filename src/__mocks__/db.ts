// Mock database store
interface MockUser {
  user_id: number;
  username: string;
  password_hash: string;
  nickname: string;
  roles: string[];
  valid_from: Date;
  valid_until: Date | null;
}

let mockUsers: MockUser[] = [];
let mockUserIdCounter = 1;

// Simple approach: track the last username used in a findByUsername call
let lastUsernameQuery: string | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb: any = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: (count: number): MockUser[] => {
          let filteredUsers = mockUsers.filter(u => !u.valid_until);
          
          // If we have a username query, filter by it
          if (lastUsernameQuery !== null) {
            filteredUsers = filteredUsers.filter(u => u.username === lastUsernameQuery);
            lastUsernameQuery = null; // Reset after use
          }
          
          return count === 1 ? [filteredUsers[0]].filter(Boolean) : filteredUsers;
        },
        orderBy: (): MockUser[] => mockUsers.filter(u => !u.valid_until),
      }),
      orderBy: (): MockUser[] => mockUsers.filter(u => !u.valid_until),
    }),
  }),
  
  insert: () => ({
    values: (data: Partial<MockUser>) => ({
      returning: (): MockUser[] => {
        const newUser: MockUser = {
          user_id: mockUserIdCounter++,
          username: data.username || '',
          password_hash: data.password_hash || '',
          nickname: data.nickname || '',
          roles: data.roles || [],
          valid_from: new Date(),
          valid_until: null,
        };
        mockUsers.push(newUser);
        return [newUser];
      },
    }),
  }),

  update: () => ({
    set: (data: Partial<MockUser>) => ({
      where: () => ({
        returning: (): MockUser[] => {
          const userIndex = mockUsers.findIndex(u => 
            lastUsernameQuery ? u.username === lastUsernameQuery : !u.valid_until,
          );
          
          if (userIndex >= 0) {
            mockUsers[userIndex] = { ...mockUsers[userIndex], ...data };
            return [mockUsers[userIndex]];
          }
          
          lastUsernameQuery = null;
          return [];
        },
      }),
    }),
  }),

  transaction: async <T>(callback: (tx: typeof mockDb) => Promise<T>): Promise<T> => {
    return await callback(mockDb);
  },
};

export const getDb = jest.fn(() => mockDb);

export const getPool = jest.fn(() => ({
  end: jest.fn(),
}));

export const closePool = jest.fn();

export const initializeDatabase = jest.fn().mockResolvedValue(undefined);

// Helper for tests
export const clearMockUsers = (): void => {
  mockUsers = [];
  mockUserIdCounter = 1;
  lastUsernameQuery = null;
};

export const getMockUsers = (): MockUser[] => mockUsers;

// Helper function to set the username for the next query
export const setMockUsernameQuery = (username: string | null): void => {
  lastUsernameQuery = username;
};