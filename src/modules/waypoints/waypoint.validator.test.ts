import {
  createWaypointSequenceSchema,
  updateWaypointSequenceSchema,
  deleteWaypointSequenceSchema,
  getWaypointSequenceSchema,
  listWaypointSequencesSchema,
  type CreateWaypointSequenceInput,
  type UpdateWaypointSequenceInput,
} from './waypoint.validator';

describe('Waypoint Validator Schemas', () => {
  // Sample valid data for testing
  const validWaypoint = {
    waypoint_seq_id: 1,
    location: { lat: 40.7128, long: -74.0060 },
    radius: 50,
    clue: 'Find the statue of liberty',
    hints: ['Look near water', 'Green color'],
    image_subject: 'statue of liberty',
  };

  const validCreateData = {
    waypoint_name: 'central-park-tour',
    waypoint_description: 'A guided tour through Central Park',
    data: [validWaypoint],
  };

  describe('createWaypointSequenceSchema', () => {
    describe('Happy Path', () => {
      it('should validate valid waypoint sequence creation data', () => {
        const input = { body: validCreateData };
        const result = createWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.waypoint_name).toBe('central-park-tour');
          expect(result.data.body.data).toHaveLength(1);
          expect(result.data.body.data[0].location.lat).toBe(40.7128);
        }
      });

      it('should validate with multiple waypoints', () => {
        const multiWaypointData = {
          ...validCreateData,
          data: [
            validWaypoint,
            {
              ...validWaypoint,
              waypoint_seq_id: 2,
              location: { lat: 41.8781, long: -87.6298 },
              clue: 'Find the bean',
            },
          ],
        };

        const result = createWaypointSequenceSchema.safeParse({ body: multiWaypointData });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.data).toHaveLength(2);
        }
      });

      it('should validate with optional hints', () => {
        const waypointWithoutHints = {
          ...validWaypoint,
          hints: undefined,
        };
        const dataWithoutHints = {
          ...validCreateData,
          data: [waypointWithoutHints],
        };

        const result = createWaypointSequenceSchema.safeParse({ body: dataWithoutHints });
        expect(result.success).toBe(true);
      });

      it('should trim whitespace from strings', () => {
        const dataWithWhitespace = {
          waypoint_name: '  central-park-tour  ',
          waypoint_description: '  A guided tour  ',
          data: [{
            ...validWaypoint,
            clue: '  Find the statue  ',
            image_subject: '  statue  ',
          }],
        };

        const result = createWaypointSequenceSchema.safeParse({ body: dataWithWhitespace });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.waypoint_name).toBe('central-park-tour');
          expect(result.data.body.waypoint_description).toBe('A guided tour');
          expect(result.data.body.data[0].clue).toBe('Find the statue');
          expect(result.data.body.data[0].image_subject).toBe('statue');
        }
      });
    });

    describe('Single Rule Breaking', () => {
      it('should fail when waypoint_name is empty', () => {
        const invalidData = { ...validCreateData, waypoint_name: '' };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint name is required');
        }
      });

      it('should fail when waypoint_name is too long', () => {
        const invalidData = { ...validCreateData, waypoint_name: 'a'.repeat(256) };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint name must be 255 characters or less');
        }
      });

      it('should fail when waypoint_description is empty', () => {
        const invalidData = { ...validCreateData, waypoint_description: '' };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint description is required');
        }
      });

      it('should fail when data array is empty', () => {
        const invalidData = { ...validCreateData, data: [] };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('At least one waypoint is required');
        }
      });

      it('should fail when waypoint_seq_id is not positive', () => {
        const invalidData = {
          ...validCreateData,
          data: [{ ...validWaypoint, waypoint_seq_id: 0 }],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint sequence ID must be a positive number');
        }
      });

      it('should fail when latitude is out of bounds', () => {
        const invalidData = {
          ...validCreateData,
          data: [{ 
            ...validWaypoint, 
            location: { lat: 91, long: -74.0060 }
          }],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Latitude must be between -90 and 90');
        }
      });

      it('should fail when longitude is out of bounds', () => {
        const invalidData = {
          ...validCreateData,
          data: [{ 
            ...validWaypoint, 
            location: { lat: 40.7128, long: 181 }
          }],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Longitude must be between -180 and 180');
        }
      });

      it('should fail when radius is not positive', () => {
        const invalidData = {
          ...validCreateData,
          data: [{ ...validWaypoint, radius: 0 }],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Radius must be positive integer');
        }
      });

      it('should fail when clue is empty', () => {
        const invalidData = {
          ...validCreateData,
          data: [{ ...validWaypoint, clue: '' }],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Clue must have meaningful description');
        }
      });

      it('should fail when image_subject is empty', () => {
        const invalidData = {
          ...validCreateData,
          data: [{ ...validWaypoint, image_subject: '' }],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('image subject must be meaningful description');
        }
      });

      it('should fail when hints contains empty strings', () => {
        const invalidData = {
          ...validCreateData,
          data: [{ ...validWaypoint, hints: ['valid hint', ''] }],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Too small: expected string to have >=1 characters');
        }
      });
    });

    describe('Multiple Properties Breaking Rules', () => {
      it('should fail with multiple validation errors', () => {
        const invalidData = {
          waypoint_name: '', // empty
          waypoint_description: '', // empty  
          data: [
            {
              waypoint_seq_id: -1, // negative
              location: { lat: 91, long: 181 }, // both out of bounds
              radius: -5, // negative
              clue: '', // empty
              hints: ['', 'valid'], // contains empty string
              image_subject: '', // empty
            },
          ],
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(5);
          
          const errorMessages = result.error.issues.map(issue => issue.message);
          expect(errorMessages).toContain('Waypoint name is required');
          expect(errorMessages).toContain('Waypoint description is required');
          expect(errorMessages).toContain('Waypoint sequence ID must be a positive number');
          expect(errorMessages).toContain('Latitude must be between -90 and 90');
          expect(errorMessages).toContain('Longitude must be between -180 and 180');
        }
      });

      it('should fail when missing required fields', () => {
        const invalidData = {
          waypoint_name: 'valid-name',
          // missing waypoint_description and data
        };
        const result = createWaypointSequenceSchema.safeParse({ body: invalidData });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBe(2);
          const errorMessages = result.error.issues.map(issue => issue.message);
          expect(errorMessages).toContain('Invalid input: expected string, received undefined');
          expect(errorMessages).toContain('Invalid input: expected array, received undefined');
        }
      });
    });
  });

  describe('updateWaypointSequenceSchema', () => {
    describe('Happy Path', () => {
      it('should validate valid update data', () => {
        const input = {
          params: { waypoint_name: 'central-park-tour' },
          body: validCreateData,
        };
        const result = updateWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.params.waypoint_name).toBe('central-park-tour');
          expect(result.data.body.waypoint_name).toBe('central-park-tour');
        }
      });
    });

    describe('Single Rule Breaking', () => {
      it('should fail when params waypoint_name is empty', () => {
        const input = {
          params: { waypoint_name: '' },
          body: validCreateData,
        };
        const result = updateWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint name is required');
        }
      });

      it('should fail when body is invalid', () => {
        const input = {
          params: { waypoint_name: 'valid-name' },
          body: { ...validCreateData, waypoint_name: '' },
        };
        const result = updateWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint name is required');
        }
      });
    });

    describe('Multiple Properties Breaking Rules', () => {
      it('should fail with errors in both params and body', () => {
        const input = {
          params: { waypoint_name: '' }, // invalid param
          body: { 
            waypoint_name: '',  // invalid body
            waypoint_description: '',
            data: []
          },
        };
        const result = updateWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
          const errorMessages = result.error.issues.map(issue => issue.message);
          expect(errorMessages.filter(msg => msg === 'Waypoint name is required')).toHaveLength(2);
        }
      });
    });
  });

  describe('deleteWaypointSequenceSchema', () => {
    describe('Happy Path', () => {
      it('should validate valid waypoint name parameter', () => {
        const input = { params: { waypoint_name: 'central-park-tour' } };
        const result = deleteWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.params.waypoint_name).toBe('central-park-tour');
        }
      });
    });

    describe('Single Rule Breaking', () => {
      it('should fail when waypoint_name is empty', () => {
        const input = { params: { waypoint_name: '' } };
        const result = deleteWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint name is required');
        }
      });

      it('should fail when waypoint_name is too long', () => {
        const input = { params: { waypoint_name: 'a'.repeat(256) } };
        const result = deleteWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint name must be 255 characters or less');
        }
      });
    });
  });

  describe('getWaypointSequenceSchema', () => {
    describe('Happy Path', () => {
      it('should validate valid waypoint name parameter', () => {
        const input = { params: { waypoint_name: 'central-park-tour' } };
        const result = getWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.params.waypoint_name).toBe('central-park-tour');
        }
      });

      it('should trim whitespace from waypoint name', () => {
        const input = { params: { waypoint_name: '  central-park-tour  ' } };
        const result = getWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.params.waypoint_name).toBe('central-park-tour');
        }
      });
    });

    describe('Single Rule Breaking', () => {
      it('should fail when waypoint_name is empty', () => {
        const input = { params: { waypoint_name: '' } };
        const result = getWaypointSequenceSchema.safeParse(input);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoint name is required');
        }
      });
    });
  });

  describe('listWaypointSequencesSchema', () => {
    describe('Happy Path', () => {
      it('should validate with no query parameters', () => {
        const input = {};
        const result = listWaypointSequencesSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query).toBeUndefined();
        }
      });

      it('should validate with empty query', () => {
        const input = { query: {} };
        const result = listWaypointSequencesSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query).toEqual({});
        }
      });

      it('should validate with includeDeleted parameter', () => {
        const input = { query: { includeDeleted: true } };
        const result = listWaypointSequencesSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query?.includeDeleted).toBe(true);
        }
      });

      it('should validate with waypoint_name parameter', () => {
        const input = { query: { waypoint_name: 'central-park' } };
        const result = listWaypointSequencesSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query?.waypoint_name).toBe('central-park');
        }
      });

      it('should coerce string boolean to boolean', () => {
        const input = { query: { includeDeleted: 'true' } };
        const result = listWaypointSequencesSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query?.includeDeleted).toBe(true);
        }
      });

      it('should validate with both parameters', () => {
        const input = { 
          query: { 
            includeDeleted: false, 
            waypoint_name: 'test-waypoint' 
          } 
        };
        const result = listWaypointSequencesSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query?.includeDeleted).toBe(false);
          expect(result.data.query?.waypoint_name).toBe('test-waypoint');
        }
      });
    });

    describe('Single Rule Breaking', () => {
      it('should coerce invalid boolean strings to true', () => {
        const input = { query: { includeDeleted: 'invalid' } };
        const result = listWaypointSequencesSchema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
          // z.coerce.boolean() treats any non-empty string as true
          expect(result.data.query?.includeDeleted).toBe(true);
        }
      });
    });
  });

  describe('Type Exports', () => {
    it('should properly infer CreateWaypointSequenceInput type', () => {
      const validInput: CreateWaypointSequenceInput = validCreateData;
      expect(validInput.waypoint_name).toBe('central-park-tour');
      expect(validInput.data).toHaveLength(1);
    });

    it('should properly infer UpdateWaypointSequenceInput type', () => {
      const validInput: UpdateWaypointSequenceInput = validCreateData;
      expect(validInput.waypoint_name).toBe('central-park-tour');
      expect(validInput.data).toHaveLength(1);
    });
  });
});