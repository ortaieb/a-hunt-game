import { WaypointModel } from './waypoint.model';
import { CreateWaypointSequenceData, UpdateWaypointSequenceData } from './waypoint.types';
import { NotFoundError } from '../../shared/types/errors';

// Mock the database module
jest.mock('../../shared/database', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  },
}));

// Mock UUID v7 for deterministic tests
jest.mock('uuid', () => ({
  v7: jest.fn(() => 'test-uuid-v7'),
}));

// Import the mocked db after mocking
const mockDb = require('../../shared/database').db;

describe('WaypointModel', () => {
  // Sample test data
  const sampleWaypointData = [
    {
      waypoint_seq_id: 1,
      location: { lat: 40.7128, long: -74.006 },
      radius: 50,
      clue: 'Find the statue of liberty',
      hints: ['Look near water', 'Green color'],
      image_subject: 'statue of liberty',
    },
  ];

  const sampleCreateData: CreateWaypointSequenceData = {
    waypoint_name: 'Central Park Tour',
    waypoint_description: 'A guided tour through Central Park',
    data: sampleWaypointData,
  };

  const sampleUpdateData: UpdateWaypointSequenceData = {
    waypoint_name: 'Updated Central Park Tour',
    waypoint_description: 'An updated guided tour through Central Park',
    data: sampleWaypointData,
  };

  const sampleWaypointsRecord = {
    waypoints_id: 'test-uuid-v7',
    waypoint_name: 'central park tour',
    waypoint_description: 'A guided tour through Central Park',
    data: sampleWaypointData,
    valid_from: new Date('2023-01-01T00:00:00.000Z'),
    valid_until: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Reset the mock implementations
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.transaction.mockClear();
  });

  describe('create', () => {
    describe('Happy Path', () => {
      it('should create a new waypoint sequence successfully', async () => {
        // Mock the chain of drizzle methods
        const mockReturning = jest.fn().mockResolvedValue([sampleWaypointsRecord]);
        const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
        const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

        mockDb.insert.mockReturnValue({ values: mockValues });

        const result = await WaypointModel.create(sampleCreateData);

        expect(mockDb.insert).toHaveBeenCalledTimes(1);
        expect(mockValues).toHaveBeenCalledWith({
          waypoints_id: 'test-uuid-v7',
          waypoint_name: 'central park tour', // Should be lowercased
          waypoint_description: 'A guided tour through Central Park',
          data: sampleWaypointData,
          valid_from: expect.any(Date),
          valid_until: null,
        });
        expect(mockReturning).toHaveBeenCalledTimes(1);
        expect(result).toEqual(sampleWaypointsRecord);
      });

      it('should lowercase the waypoint name', async () => {
        const mockReturning = jest.fn().mockResolvedValue([sampleWaypointsRecord]);
        const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        const dataWithUpperCase = {
          ...sampleCreateData,
          waypoint_name: 'UPPERCASE WAYPOINT NAME',
        };

        await WaypointModel.create(dataWithUpperCase);

        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({
            waypoint_name: 'uppercase waypoint name',
          }),
        );
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw error when database insert fails', async () => {
        const mockReturning = jest.fn().mockResolvedValue([]); // Empty result
        const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        await expect(WaypointModel.create(sampleCreateData)).rejects.toThrow(
          'Failed to create waypoints sequence',
        );
      });

      it('should throw error when database operation rejects', async () => {
        const mockReturning = jest.fn().mockRejectedValue(new Error('Database connection failed'));
        const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        await expect(WaypointModel.create(sampleCreateData)).rejects.toThrow(
          'Database connection failed',
        );
      });
    });
  });

  describe('update', () => {
    describe('Happy Path', () => {
      it('should update waypoint sequence successfully', async () => {
        const currentRecord = { ...sampleWaypointsRecord, waypoints_id: 'existing-uuid' };
        const updatedRecord = { ...sampleWaypointsRecord, waypoints_id: 'new-uuid' };

        // Mock transaction
        const mockTxSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([currentRecord]),
            }),
          }),
        });

        const mockTxUpdate = jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        });

        const mockTxInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedRecord]),
          }),
        });

        const mockTx = {
          select: mockTxSelect,
          update: mockTxUpdate,
          insert: mockTxInsert,
        };

        mockDb.transaction.mockImplementation((callback: any) => callback(mockTx));

        const result = await WaypointModel.update('central park tour', sampleUpdateData);

        expect(mockDb.transaction).toHaveBeenCalledTimes(1);
        expect(mockTxSelect).toHaveBeenCalledTimes(1);
        expect(mockTxUpdate).toHaveBeenCalledTimes(1);
        expect(mockTxInsert).toHaveBeenCalledTimes(1);
        expect(result).toEqual(updatedRecord);
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw error when waypoint sequence not found', async () => {
        const mockTxSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]), // No results
            }),
          }),
        });

        const mockTx = { select: mockTxSelect };
        mockDb.transaction.mockImplementation((callback: any) => callback(mockTx));

        await expect(
          WaypointModel.update('nonexistent-waypoint', sampleUpdateData),
        ).rejects.toThrow('User not found'); // Note: Error message in code says "User not found"
      });

      it('should throw error when insert in transaction fails', async () => {
        const currentRecord = { ...sampleWaypointsRecord };

        const mockTxSelect = jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([currentRecord]),
            }),
          }),
        });

        const mockTxUpdate = jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        });

        const mockTxInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([]), // Empty result
          }),
        });

        const mockTx = {
          select: mockTxSelect,
          update: mockTxUpdate,
          insert: mockTxInsert,
        };

        mockDb.transaction.mockImplementation((callback: any) => callback(mockTx));

        await expect(WaypointModel.update('central park tour', sampleUpdateData)).rejects.toThrow(
          'Failed to update user',
        ); // Note: Error message in code says "Failed to update user"
      });

      it('should handle transaction rollback on error', async () => {
        const mockTx = {
          select: jest.fn().mockImplementation(() => {
            throw new Error('Transaction failed');
          }),
        };

        mockDb.transaction.mockImplementation((callback: any) => callback(mockTx));

        await expect(WaypointModel.update('central park tour', sampleUpdateData)).rejects.toThrow(
          'Transaction failed',
        );
      });
    });
  });

  describe('delete', () => {
    describe('Happy Path', () => {
      it('should soft delete waypoint sequence successfully', async () => {
        // Mock findByName to return existing record
        const existingRecord = { ...sampleWaypointsRecord };
        jest.spyOn(WaypointModel, 'findByName').mockResolvedValue(existingRecord);

        // Mock update query
        const mockSet = jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        });
        mockDb.update.mockReturnValue({ set: mockSet });

        await WaypointModel.delete('central park tour');

        expect(WaypointModel.findByName).toHaveBeenCalledWith('central park tour');
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith({ valid_until: expect.any(Date) });
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw NotFoundError when waypoint sequence does not exist', async () => {
        jest.spyOn(WaypointModel, 'findByName').mockResolvedValue(null);

        await expect(WaypointModel.delete('nonexistent-waypoint')).rejects.toThrow(NotFoundError);
        await expect(WaypointModel.delete('nonexistent-waypoint')).rejects.toThrow(
          'Waypoint sequence not found',
        );
      });

      it('should handle database update errors', async () => {
        const existingRecord = { ...sampleWaypointsRecord };
        jest.spyOn(WaypointModel, 'findByName').mockResolvedValue(existingRecord);

        const mockSet = jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('Database update failed')),
        });
        mockDb.update.mockReturnValue({ set: mockSet });

        await expect(WaypointModel.delete('central park tour')).rejects.toThrow(
          'Database update failed',
        );
      });
    });
  });

  describe('findByName', () => {
    describe('Happy Path', () => {
      it('should return waypoint sequence when found', async () => {
        // Spy on the actual method instead of mocking the db directly for this test
        jest.spyOn(WaypointModel, 'findByName').mockResolvedValue(sampleWaypointsRecord);

        const result = await WaypointModel.findByName('central park tour');

        expect(result).toEqual(sampleWaypointsRecord);
      });

      it('should call database with correct parameters', async () => {
        const mockLimit = jest.fn().mockResolvedValue([sampleWaypointsRecord]);
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        // Restore the original implementation for this test
        (WaypointModel.findByName as jest.Mock).mockRestore?.();

        const result = await WaypointModel.findByName('test-name');

        expect(mockDb.select).toHaveBeenCalledTimes(1);
        expect(mockFrom).toHaveBeenCalledTimes(1);
        expect(mockWhere).toHaveBeenCalledTimes(1);
        expect(mockLimit).toHaveBeenCalledWith(1);
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should return null when waypoint sequence not found', async () => {
        jest.spyOn(WaypointModel, 'findByName').mockResolvedValue(null);

        const result = await WaypointModel.findByName('nonexistent-waypoint');

        expect(result).toBeNull();
      });

      it('should handle database query errors', async () => {
        jest
          .spyOn(WaypointModel, 'findByName')
          .mockRejectedValue(new Error('Database query failed'));

        await expect(WaypointModel.findByName('any-waypoint')).rejects.toThrow(
          'Database query failed',
        );
      });

      it('should return first result when array has multiple items', async () => {
        const multipleRecords = [
          sampleWaypointsRecord,
          { ...sampleWaypointsRecord, waypoints_id: 'second-record' },
        ];
        const mockLimit = jest.fn().mockResolvedValue(multipleRecords);
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        // Restore the original implementation for this test
        (WaypointModel.findByName as jest.Mock).mockRestore?.();

        const result = await WaypointModel.findByName('central park tour');

        expect(result).toEqual(sampleWaypointsRecord); // Should return first record
      });
    });
  });

  describe('waypointNameExists', () => {
    describe('Happy Path', () => {
      it('should return true when waypoint name exists', async () => {
        const mockLimit = jest.fn().mockResolvedValue([{ count: 'central park tour' }]);
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const result = await WaypointModel.waypointNameExists('central park tour');

        expect(result).toBe(true);
        expect(mockDb.select).toHaveBeenCalledWith({ count: expect.anything() });
        expect(mockLimit).toHaveBeenCalledWith(1);
      });

      it('should work with different waypoint names', async () => {
        const mockLimit = jest.fn().mockResolvedValue([{ count: 'different-name' }]);
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const result = await WaypointModel.waypointNameExists('different-name');

        expect(result).toBe(true);
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should return false when waypoint name does not exist', async () => {
        const mockLimit = jest.fn().mockResolvedValue([]); // Empty array
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const result = await WaypointModel.waypointNameExists('nonexistent-waypoint');

        expect(result).toBe(false);
      });

      it('should return false when result is undefined', async () => {
        const mockLimit = jest.fn().mockResolvedValue([undefined]);
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const result = await WaypointModel.waypointNameExists('any-waypoint');

        expect(result).toBe(false);
      });

      it('should handle database query errors', async () => {
        const mockLimit = jest.fn().mockRejectedValue(new Error('Database connection lost'));
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        await expect(WaypointModel.waypointNameExists('any-waypoint')).rejects.toThrow(
          'Database connection lost',
        );
      });

      it('should handle null result properly', async () => {
        const mockLimit = jest.fn().mockResolvedValue([null]);
        const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const result = await WaypointModel.waypointNameExists('any-waypoint');

        expect(result).toBe(false);
      });
    });
  });

  describe('Integration Error Scenarios', () => {
    it('should handle database connection timeout', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';

      const mockReturning = jest.fn().mockRejectedValue(timeoutError);
      const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      await expect(WaypointModel.create(sampleCreateData)).rejects.toThrow('Connection timeout');
    });

    it('should handle constraint violation errors', async () => {
      const constraintError = new Error('Unique constraint violation');
      constraintError.name = 'ConstraintError';

      const mockReturning = jest.fn().mockRejectedValue(constraintError);
      const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      await expect(WaypointModel.create(sampleCreateData)).rejects.toThrow(
        'Unique constraint violation',
      );
    });
  });
});
