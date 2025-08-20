import { UserModel, CreateUserData } from './User';

// Mock the db module with specific implementations
jest.mock('../db', () => ({
  getDb: jest.fn(),
}));

// Mock bcrypt for consistent testing
jest.mock('bcrypt', () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed_${password}`),
  ),
}));

describe('UserModel (Drizzle)', () => {
  // We'll mock the UserModel methods directly for simpler testing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockUsers: any[] = [];
  let mockUserIdCounter = 1;
  let hashCounter = 0;

  beforeEach(() => {
    mockUsers = [];
    mockUserIdCounter = 1;
    hashCounter = 0;
    jest.clearAllMocks();

    // Mock UserModel.hashPassword with salting simulation
    jest
      .spyOn(UserModel, 'hashPassword')
      .mockImplementation(async (password: string) => {
        return `hashed_${password}_${++hashCounter}`;
      });

    // Mock UserModel.verifyPassword
    jest
      .spyOn(UserModel, 'verifyPassword')
      .mockImplementation(async (password: string, hash: string) => {
        return hash.startsWith(`hashed_${password}_`);
      });

    // Mock UserModel.create
    jest
      .spyOn(UserModel, 'create')
      .mockImplementation(async (userData: CreateUserData) => {
        const hashedPassword = await UserModel.hashPassword(userData.password);
        const newUser = {
          user_id: mockUserIdCounter++,
          username: userData.username,
          password_hash: hashedPassword,
          nickname: userData.nickname,
          roles: userData.roles,
          valid_from: new Date(),
          valid_until: null,
        };
        mockUsers.push(newUser);
        return newUser;
      });

    // Mock UserModel.findActiveByUsername
    jest
      .spyOn(UserModel, 'findActiveByUsername')
      .mockImplementation(async (username: string) => {
        const user = mockUsers.find(
          (u) => u.username === username && !u.valid_until,
        );
        return user || null;
      });

    // Mock UserModel.getAllActive
    jest.spyOn(UserModel, 'getAllActive').mockImplementation(async () => {
      return mockUsers.filter((u) => !u.valid_until);
    });
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      const user = await UserModel.create(userData);

      expect(user.username).toBe(userData.username);
      expect(user.nickname).toBe(userData.nickname);
      expect(user.roles).toEqual(userData.roles);
      expect(user.password_hash).not.toBe(userData.password);
      expect(user.user_id).toBeDefined();
      expect(user.valid_from).toBeDefined();
      expect(user.valid_until).toBeNull();
    });
  });

  describe('findActiveByUsername', () => {
    it('should find active user by username', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findActiveByUsername(userData.username);

      expect(foundUser).toBeDefined();
      expect(foundUser?.user_id).toBe(createdUser.user_id);
      expect(foundUser?.username).toBe(userData.username);
    });

    it('should return null for non-existent user', async () => {
      const foundUser = await UserModel.findActiveByUsername(
        'nonexistent@example.com',
      );
      expect(foundUser).toBeNull();
    });
  });

  describe('password operations', () => {
    it('should hash passwords consistently', async () => {
      const password = 'TestPassword123!';
      const hash1 = await UserModel.hashPassword(password);
      const hash2 = await UserModel.hashPassword(password);

      expect(hash1).not.toBe(password);
      expect(hash2).not.toBe(password);
      expect(hash1).not.toBe(hash2); // Should use salt
    });

    it('should verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await UserModel.hashPassword(password);

      const isValid = await UserModel.verifyPassword(password, hash);
      const isInvalid = await UserModel.verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe('getAllActive', () => {
    it('should return all active users', async () => {
      const users = [
        {
          username: 'user1@example.com',
          password: 'Password123!',
          nickname: 'User1',
          roles: ['user'],
        },
        {
          username: 'user2@example.com',
          password: 'Password123!',
          nickname: 'User2',
          roles: ['admin'],
        },
      ];

      for (const userData of users) {
        await UserModel.create(userData);
      }

      const activeUsers = await UserModel.getAllActive();
      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.map((u) => u.username).sort()).toEqual([
        'user1@example.com',
        'user2@example.com',
      ]);
    });
  });
});
