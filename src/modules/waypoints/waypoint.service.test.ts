// Mock reflect-metadata and class-transformer before any imports
jest.mock('reflect-metadata', () => ({}));
jest.mock('class-transformer', () => ({
  plainToClass: jest.fn((cls, obj) => obj), // Simple identity function for testing
  Expose: () => () => {}, // Mock decorator
}));

// Mock the schema/waypoints module to avoid decorator issues
jest.mock('../../schema/waypoints', () => ({
  Waypoint: class MockWaypoint {
    waypoint_seq_id = 0;
    location = { lat: 0, long: 0 };
    radius = 0;
    clue = '';
    hints = [];
    image_subject = '';
  },
  WaypointsRecord: {},
}));

// Mock WaypointModel - focusing on service behavior
jest.mock('./waypoint.model');

import { WaypointService, waypointService } from './waypoint.service';
import { WaypointModel } from './waypoint.model';
import { CreateWaypointSequenceInput, UpdateWaypointSequenceInput } from './waypoint.validator';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/types/errors';
import { plainToClass } from 'class-transformer';

const mockWaypointModel = WaypointModel as jest.Mocked<typeof WaypointModel>;
const mockPlainToClass = plainToClass as jest.MockedFunction<typeof plainToClass>;

describe('WaypointService', () => {
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

  const sampleCreateInput: CreateWaypointSequenceInput = {
    waypoint_name: 'central-park-tour',
    waypoint_description: 'A guided tour through Central Park',
    data: sampleWaypointData,
  };

  const sampleUpdateInput: UpdateWaypointSequenceInput = {
    waypoint_name: 'central-park-tour',
    waypoint_description: 'Updated guided tour through Central Park',
    data: sampleWaypointData,
  };

  const sampleWaypointsRecord = {
    waypoints_id: 'test-uuid',
    waypoint_name: 'central-park-tour',
    waypoint_description: 'A guided tour through Central Park',
    data: sampleWaypointData,
    valid_from: new Date('2023-01-01T00:00:00.000Z'),
    valid_until: null,
  };

  const transformedWaypointData = {
    ...sampleWaypointData[0],
    transformed: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock behavior for class-transformer
    mockPlainToClass.mockReturnValue(transformedWaypointData as any);
  });

  describe('createWaypointSequence', () => {
    describe('Happy Path', () => {
      it('should create waypoint sequence when name does not exist', async () => {
        mockWaypointModel.waypointNameExists.mockResolvedValue(false);
        mockWaypointModel.create.mockResolvedValue(sampleWaypointsRecord);

        const result = await waypointService.createWaypointSequence(sampleCreateInput);

        expect(mockWaypointModel.waypointNameExists).toHaveBeenCalledWith('central-park-tour');
        expect(mockPlainToClass).toHaveBeenCalledTimes(1);
        expect(mockWaypointModel.create).toHaveBeenCalledWith({
          waypoint_name: 'central-park-tour',
          waypoint_description: 'A guided tour through Central Park',
          data: [transformedWaypointData],
        });
        expect(result).toBe(sampleWaypointsRecord);
      });

      it('should create waypoint sequence when name exists but is inactive', async () => {
        mockWaypointModel.waypointNameExists.mockResolvedValue(true);
        mockWaypointModel.findByName.mockResolvedValue(null); // No active sequence
        mockWaypointModel.create.mockResolvedValue(sampleWaypointsRecord);

        const result = await waypointService.createWaypointSequence(sampleCreateInput);

        expect(mockWaypointModel.waypointNameExists).toHaveBeenCalledWith('central-park-tour');
        expect(mockWaypointModel.findByName).toHaveBeenCalledWith('central-park-tour');
        expect(mockWaypointModel.create).toHaveBeenCalled();
        expect(result).toBe(sampleWaypointsRecord);
      });

      it('should transform waypoint data using plainToClass', async () => {
        const multiWaypointInput = {
          ...sampleCreateInput,
          data: [sampleWaypointData[0], { ...sampleWaypointData[0], waypoint_seq_id: 2 }],
        };

        mockWaypointModel.waypointNameExists.mockResolvedValue(false);
        mockWaypointModel.create.mockResolvedValue(sampleWaypointsRecord);

        await waypointService.createWaypointSequence(multiWaypointInput);

        expect(mockPlainToClass).toHaveBeenCalledTimes(2);
        expect(mockWaypointModel.create).toHaveBeenCalledWith({
          waypoint_name: 'central-park-tour',
          waypoint_description: 'A guided tour through Central Park',
          data: [transformedWaypointData, transformedWaypointData],
        });
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw ConflictError when active sequence with same name exists', async () => {
        const existingRecord = { ...sampleWaypointsRecord };
        mockWaypointModel.waypointNameExists.mockResolvedValue(true);
        mockWaypointModel.findByName.mockResolvedValue(existingRecord);

        await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
          ConflictError,
        );
        await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
          'Waypoint sequence with this name already exists',
        );

        expect(mockWaypointModel.create).not.toHaveBeenCalled();
      });

      it('should handle empty data array', async () => {
        const emptyDataInput = { ...sampleCreateInput, data: [] };
        mockWaypointModel.waypointNameExists.mockResolvedValue(false);
        mockWaypointModel.create.mockResolvedValue(sampleWaypointsRecord);

        await waypointService.createWaypointSequence(emptyDataInput);

        expect(mockPlainToClass).not.toHaveBeenCalled();
        expect(mockWaypointModel.create).toHaveBeenCalledWith({
          waypoint_name: 'central-park-tour',
          waypoint_description: 'A guided tour through Central Park',
          data: [],
        });
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate waypointNameExists database errors', async () => {
        const dbError = new Error('Database connection failed');
        mockWaypointModel.waypointNameExists.mockRejectedValue(dbError);

        await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
          'Database connection failed',
        );
        expect(mockWaypointModel.create).not.toHaveBeenCalled();
      });

      it('should propagate findByName database errors', async () => {
        const dbError = new Error('Query timeout');
        mockWaypointModel.waypointNameExists.mockResolvedValue(true);
        mockWaypointModel.findByName.mockRejectedValue(dbError);

        await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
          'Query timeout',
        );
        expect(mockWaypointModel.create).not.toHaveBeenCalled();
      });

      it('should propagate create database errors', async () => {
        const dbError = new Error('Insert constraint violation');
        mockWaypointModel.waypointNameExists.mockResolvedValue(false);
        mockWaypointModel.create.mockRejectedValue(dbError);

        await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
          'Insert constraint violation',
        );
      });

      it('should handle class-transformer errors', async () => {
        const transformError = new Error('Transformation failed');
        mockWaypointModel.waypointNameExists.mockResolvedValue(false);
        mockPlainToClass.mockImplementation(() => {
          throw transformError;
        });

        await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
          'Transformation failed',
        );
        expect(mockWaypointModel.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('updateWaypointSequence', () => {
    describe('Happy Path', () => {
      it('should update waypoint sequence successfully', async () => {
        const updatedRecord = {
          ...sampleWaypointsRecord,
          waypoint_description: 'Updated description',
        };
        mockWaypointModel.update.mockResolvedValue(updatedRecord);

        const result = await waypointService.updateWaypointSequence(
          'central-park-tour',
          sampleUpdateInput,
        );

        expect(mockPlainToClass).toHaveBeenCalledTimes(1);
        expect(mockWaypointModel.update).toHaveBeenCalledWith('central-park-tour', {
          waypoint_name: 'central-park-tour',
          waypoint_description: 'Updated guided tour through Central Park',
          data: [transformedWaypointData],
        });
        expect(result).toBe(updatedRecord);
      });

      it('should transform multiple waypoints correctly', async () => {
        const multiWaypointUpdate = {
          ...sampleUpdateInput,
          data: [sampleWaypointData[0], { ...sampleWaypointData[0], waypoint_seq_id: 2 }],
        };
        mockWaypointModel.update.mockResolvedValue(sampleWaypointsRecord);

        await waypointService.updateWaypointSequence('central-park-tour', multiWaypointUpdate);

        expect(mockPlainToClass).toHaveBeenCalledTimes(2);
        expect(mockWaypointModel.update).toHaveBeenCalledWith('central-park-tour', {
          waypoint_name: 'central-park-tour',
          waypoint_description: 'Updated guided tour through Central Park',
          data: [transformedWaypointData, transformedWaypointData],
        });
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw ValidationError when URL and body waypoint names do not match', async () => {
        const mismatchedInput = {
          ...sampleUpdateInput,
          waypoint_name: 'different-name',
        };

        await expect(
          waypointService.updateWaypointSequence('central-park-tour', mismatchedInput),
        ).rejects.toThrow(ValidationError);
        await expect(
          waypointService.updateWaypointSequence('central-park-tour', mismatchedInput),
        ).rejects.toThrow('URL waypoint_name must match body waypoint_name');

        expect(mockWaypointModel.update).not.toHaveBeenCalled();
        expect(mockPlainToClass).not.toHaveBeenCalled();
      });

      it('should handle empty data array in update', async () => {
        const emptyDataUpdate = { ...sampleUpdateInput, data: [] };
        mockWaypointModel.update.mockResolvedValue(sampleWaypointsRecord);

        await waypointService.updateWaypointSequence('central-park-tour', emptyDataUpdate);

        expect(mockPlainToClass).not.toHaveBeenCalled();
        expect(mockWaypointModel.update).toHaveBeenCalledWith('central-park-tour', {
          waypoint_name: 'central-park-tour',
          waypoint_description: 'Updated guided tour through Central Park',
          data: [],
        });
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate model update errors', async () => {
        const dbError = new Error('Update operation failed');
        mockWaypointModel.update.mockRejectedValue(dbError);

        await expect(
          waypointService.updateWaypointSequence('central-park-tour', sampleUpdateInput),
        ).rejects.toThrow('Update operation failed');
      });

      it('should propagate class-transformer errors during update', async () => {
        const transformError = new Error('Update transformation failed');
        mockPlainToClass.mockImplementation(() => {
          throw transformError;
        });

        await expect(
          waypointService.updateWaypointSequence('central-park-tour', sampleUpdateInput),
        ).rejects.toThrow('Update transformation failed');
        expect(mockWaypointModel.update).not.toHaveBeenCalled();
      });

      it('should handle NotFoundError from model layer', async () => {
        const notFoundError = new NotFoundError('Waypoint not found in database');
        mockWaypointModel.update.mockRejectedValue(notFoundError);

        await expect(
          waypointService.updateWaypointSequence('central-park-tour', sampleUpdateInput),
        ).rejects.toThrow(NotFoundError);
        await expect(
          waypointService.updateWaypointSequence('central-park-tour', sampleUpdateInput),
        ).rejects.toThrow('Waypoint not found in database');
      });
    });
  });

  describe('deleteWaypointSequence', () => {
    describe('Happy Path', () => {
      it('should delete waypoint sequence when it exists', async () => {
        const existingRecord = { ...sampleWaypointsRecord };
        mockWaypointModel.findByName.mockResolvedValue(existingRecord);
        mockWaypointModel.delete.mockResolvedValue();

        await waypointService.deleteWaypointSequence('central-park-tour');

        expect(mockWaypointModel.findByName).toHaveBeenCalledWith('central-park-tour');
        expect(mockWaypointModel.delete).toHaveBeenCalledWith('central-park-tour');
      });

      it('should handle successful deletion without return value', async () => {
        const existingRecord = { ...sampleWaypointsRecord };
        mockWaypointModel.findByName.mockResolvedValue(existingRecord);
        mockWaypointModel.delete.mockResolvedValue(undefined);

        const result = await waypointService.deleteWaypointSequence('central-park-tour');

        expect(result).toBeUndefined();
        expect(mockWaypointModel.delete).toHaveBeenCalledTimes(1);
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw NotFoundError when waypoint sequence does not exist', async () => {
        mockWaypointModel.findByName.mockResolvedValue(null);

        await expect(
          waypointService.deleteWaypointSequence('nonexistent-waypoint'),
        ).rejects.toThrow(NotFoundError);
        await expect(
          waypointService.deleteWaypointSequence('nonexistent-waypoint'),
        ).rejects.toThrow('Waypoint sequence not found');

        expect(mockWaypointModel.delete).not.toHaveBeenCalled();
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate findByName errors', async () => {
        const dbError = new Error('Database lookup failed');
        mockWaypointModel.findByName.mockRejectedValue(dbError);

        await expect(waypointService.deleteWaypointSequence('central-park-tour')).rejects.toThrow(
          'Database lookup failed',
        );
        expect(mockWaypointModel.delete).not.toHaveBeenCalled();
      });

      it('should propagate delete operation errors', async () => {
        const existingRecord = { ...sampleWaypointsRecord };
        const deleteError = new Error('Delete constraint violation');
        mockWaypointModel.findByName.mockResolvedValue(existingRecord);
        mockWaypointModel.delete.mockRejectedValue(deleteError);

        await expect(waypointService.deleteWaypointSequence('central-park-tour')).rejects.toThrow(
          'Delete constraint violation',
        );
      });

      it('should handle model layer NotFoundError during delete operation', async () => {
        const existingRecord = { ...sampleWaypointsRecord };
        const modelNotFoundError = new NotFoundError('Record was deleted by another process');
        mockWaypointModel.findByName.mockResolvedValue(existingRecord);
        mockWaypointModel.delete.mockRejectedValue(modelNotFoundError);

        await expect(waypointService.deleteWaypointSequence('central-park-tour')).rejects.toThrow(
          NotFoundError,
        );
        await expect(waypointService.deleteWaypointSequence('central-park-tour')).rejects.toThrow(
          'Record was deleted by another process',
        );
      });
    });
  });

  describe('getWaypointSequence', () => {
    describe('Happy Path', () => {
      it('should return waypoint sequence when found', async () => {
        const foundRecord = { ...sampleWaypointsRecord };
        mockWaypointModel.findByName.mockResolvedValue(foundRecord);

        const result = await waypointService.getWaypointSequence('central-park-tour');

        expect(mockWaypointModel.findByName).toHaveBeenCalledWith('central-park-tour');
        expect(result).toBe(foundRecord);
      });

      it('should handle different waypoint names correctly', async () => {
        const foundRecord = {
          ...sampleWaypointsRecord,
          waypoint_name: 'different-tour',
        };
        mockWaypointModel.findByName.mockResolvedValue(foundRecord);

        const result = await waypointService.getWaypointSequence('different-tour');

        expect(mockWaypointModel.findByName).toHaveBeenCalledWith('different-tour');
        expect(result).toBe(foundRecord);
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw NotFoundError when waypoint sequence not found', async () => {
        mockWaypointModel.findByName.mockResolvedValue(null);

        await expect(waypointService.getWaypointSequence('nonexistent-waypoint')).rejects.toThrow(
          NotFoundError,
        );
        await expect(waypointService.getWaypointSequence('nonexistent-waypoint')).rejects.toThrow(
          'Waypoint sequence not found',
        );
      });

      it('should handle undefined return from model', async () => {
        mockWaypointModel.findByName.mockResolvedValue(undefined as any);

        await expect(waypointService.getWaypointSequence('waypoint-name')).rejects.toThrow(
          NotFoundError,
        );
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate model findByName errors', async () => {
        const dbError = new Error('Database connection timeout');
        mockWaypointModel.findByName.mockRejectedValue(dbError);

        await expect(waypointService.getWaypointSequence('central-park-tour')).rejects.toThrow(
          'Database connection timeout',
        );
      });

      it('should handle model layer constraint errors', async () => {
        const constraintError = new Error('Query constraint violation');
        constraintError.name = 'ConstraintError';
        mockWaypointModel.findByName.mockRejectedValue(constraintError);

        await expect(waypointService.getWaypointSequence('central-park-tour')).rejects.toThrow(
          'Query constraint violation',
        );
      });
    });
  });

  describe('Service Instance', () => {
    it('should export a singleton service instance', () => {
      expect(waypointService).toBeInstanceOf(WaypointService);
      expect(typeof waypointService.createWaypointSequence).toBe('function');
      expect(typeof waypointService.updateWaypointSequence).toBe('function');
      expect(typeof waypointService.deleteWaypointSequence).toBe('function');
      expect(typeof waypointService.getWaypointSequence).toBe('function');
    });

    it('should maintain state consistency across method calls', async () => {
      // Test that the service instance behaves consistently
      mockWaypointModel.findByName.mockResolvedValue(sampleWaypointsRecord);

      const result1 = await waypointService.getWaypointSequence('test-waypoint');
      const result2 = await waypointService.getWaypointSequence('test-waypoint');

      expect(result1).toBe(result2);
      expect(mockWaypointModel.findByName).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration Error Scenarios', () => {
    it('should handle cascading failures gracefully', async () => {
      // Test scenario where multiple operations fail
      const networkError = new Error('Network unreachable');
      mockWaypointModel.waypointNameExists.mockRejectedValue(networkError);
      mockWaypointModel.findByName.mockRejectedValue(networkError);
      mockWaypointModel.create.mockRejectedValue(networkError);

      await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
        'Network unreachable',
      );
      await expect(waypointService.getWaypointSequence('any-waypoint')).rejects.toThrow(
        'Network unreachable',
      );
    });

    it('should handle mixed success/failure scenarios', async () => {
      // Scenario: exists check succeeds, but findByName fails
      mockWaypointModel.waypointNameExists.mockResolvedValue(true);
      mockWaypointModel.findByName.mockRejectedValue(new Error('Connection lost'));

      await expect(waypointService.createWaypointSequence(sampleCreateInput)).rejects.toThrow(
        'Connection lost',
      );
      expect(mockWaypointModel.waypointNameExists).toHaveBeenCalledTimes(1);
      expect(mockWaypointModel.findByName).toHaveBeenCalledTimes(1);
      expect(mockWaypointModel.create).not.toHaveBeenCalled();
    });
  });
});
