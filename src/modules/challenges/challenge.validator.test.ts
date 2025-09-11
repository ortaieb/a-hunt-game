// src/modules/challenges/challenge.validator.test.ts
import { z } from 'zod';
import {
  createChallengeSchema,
  challengeWaypointSchema,
  challengeParticipantsSchema,
} from './challenge.validator';

describe('Challenge Validators', () => {
  describe('createChallengeSchema', () => {
    describe('Happy Path', () => {
      it('should validate valid create challenge request with all fields', () => {
        const validData = {
          body: {
            challengeName: 'Summer Adventure Hunt',
            challengeDesc: 'A thrilling scavenger hunt through downtown',
            waypointsRef: 'downtown-tour',
            startTime: '2024-08-15T10:00:00Z',
            duration: 90,
            invitedUsers: ['user1@example.com', 'user2@example.com'],
          },
        };

        const expectedData = {
          ...validData,
          body: {
            ...validData.body,
            startTime: new Date(validData.body.startTime),
          },
        };

        const result = createChallengeSchema.parse(validData);
        expect(result).toStrictEqual(expectedData);
      });

      it('should validate valid create challenge request with minimal required fields', () => {
        const validData = {
          body: {
            challengeName: 'Quick Hunt',
            challengeDesc: 'A short adventure',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        const expectedData = {
          ...validData,
          body: {
            ...validData.body,
            startTime: new Date(validData.body.startTime),
          },
        };

        const result = createChallengeSchema.parse(validData);
        expect(result).toEqual(expectedData);
      });

      it('should trim whitespace from string fields', () => {
        const dataWithWhitespace = {
          body: {
            challengeName: '  Adventure Hunt  ',
            challengeDesc: '  Great adventure  ',
            startTime: '2024-08-15T10:00:00Z',
            duration: 60,
          },
        };

        const result = createChallengeSchema.parse(dataWithWhitespace);
        expect(result.body.challengeName).toBe('Adventure Hunt');
        expect(result.body.challengeDesc).toBe('Great adventure');
      });

      it('should accept empty invited users array', () => {
        const validData = {
          body: {
            challengeName: 'Solo Hunt',
            challengeDesc: 'A solo adventure',
            startTime: '2024-08-15T10:00:00Z',
            duration: 45,
            invitedUsers: [],
          },
        };

        const expectedData = {
          ...validData,
          body: {
            ...validData.body,
            startTime: new Date(validData.body.startTime),
          },
        };

        const result = createChallengeSchema.parse(validData);
        expect(result).toEqual(expectedData);
      });
    });

    describe('Challenge Name Validation', () => {
      it('should reject challenge name shorter than 3 characters', () => {
        const invalidData = {
          body: {
            challengeName: 'Ab',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();

        try {
          createChallengeSchema.parse(invalidData);
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          expect((error as z.ZodError).issues[0].message).toBe(
            'Challenge-Name should not be less than 3 characters',
          );
        }
      });

      it('should reject challenge name longer than 32 characters', () => {
        const invalidData = {
          body: {
            challengeName: 'This is a very long challenge name that exceeds the maximum limit',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();

        try {
          createChallengeSchema.parse(invalidData);
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          expect((error as z.ZodError).issues[0].message).toBe(
            'Challenge-Name should not be more than 32 characters',
          );
        }
      });

      it('should reject empty challenge name', () => {
        const invalidData = {
          body: {
            challengeName: '',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });

      it('should reject non-string challenge name', () => {
        const invalidData = {
          body: {
            challengeName: 123,
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });
    });

    describe('Challenge Description Validation', () => {
      it('should reject challenge description longer than 255 characters', () => {
        const longDescription = 'A'.repeat(256);
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: longDescription,
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();

        try {
          createChallengeSchema.parse(invalidData);
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          expect((error as z.ZodError).issues[0].message).toBe(
            'Challenge description should not be more than 255 characters',
          );
        }
      });

      it('should accept exactly 255 character description', () => {
        const maxDescription = 'A'.repeat(255);
        const validData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: maxDescription,
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        const result = createChallengeSchema.parse(validData);
        expect(result.body.challengeDesc).toBe(maxDescription);
      });

      it('should accept empty description', () => {
        const validData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: '',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        const result = createChallengeSchema.parse(validData);
        expect(result.body.challengeDesc).toBe('');
      });

      it('should reject non-string description', () => {
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: 123,
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });
    });

    describe('Start Time Validation', () => {
      it('should accept valid ISO 8601 datetime with timezone', () => {
        const validTimes = [
          '2024-08-15T10:00:00Z',
          '2024-08-15T10:00:00+02:00',
          '2024-08-15T10:00:00-05:00',
          '2024-08-15T10:00:00.123Z',
        ];

        validTimes.forEach((startTime) => {
          const validData = {
            body: {
              challengeName: 'Valid Name',
              challengeDesc: 'Description',
              startTime,
              duration: 30,
            },
          };

          expect(() => createChallengeSchema.parse(validData)).not.toThrow();
        });
      });

      it('should reject invalid datetime formats', () => {
        const invalidTimes = [
          '2024-08-15',
          '2024-08-15T10:00:00',
          '2024/08/15 10:00:00',
          'invalid-date',
          123456789,
        ];

        invalidTimes.forEach((startTime) => {
          const invalidData = {
            body: {
              challengeName: 'Valid Name',
              challengeDesc: 'Description',
              startTime,
              duration: 30,
            },
          };

          expect(() => createChallengeSchema.parse(invalidData)).toThrow();
        });
      });
    });

    describe('Duration Validation', () => {
      it('should accept positive duration values', () => {
        const validDurations = [1, 30, 60, 90, 120, 1440]; // 1 minute to 24 hours

        validDurations.forEach((duration) => {
          const validData = {
            body: {
              challengeName: 'Valid Name',
              challengeDesc: 'Description',
              startTime: '2024-08-15T10:00:00Z',
              duration,
            },
          };

          expect(() => createChallengeSchema.parse(validData)).not.toThrow();
        });
      });

      it('should accept zero duration', () => {
        const validData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: 0,
          },
        };

        expect(() => createChallengeSchema.parse(validData)).not.toThrow();
      });

      it('should reject negative duration', () => {
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: -10,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();

        try {
          createChallengeSchema.parse(invalidData);
        } catch (error) {
          expect(error).toBeInstanceOf(z.ZodError);
          expect((error as z.ZodError).issues[0].message).toBe('Duration cannot be negative value');
        }
      });

      it('should reject non-number duration', () => {
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: '30',
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });
    });

    describe('Invited Users Validation', () => {
      it('should accept valid email arrays', () => {
        const validEmails = [
          ['test@example.com'],
          ['user1@test.com', 'user2@test.com'],
          ['john.doe@example.org', 'jane.smith@company.net'],
        ];

        validEmails.forEach((invitedUsers) => {
          const validData = {
            body: {
              challengeName: 'Valid Name',
              challengeDesc: 'Description',
              startTime: '2024-08-15T10:00:00Z',
              duration: 30,
              invitedUsers,
            },
          };

          expect(() => createChallengeSchema.parse(validData)).not.toThrow();
        });
      });

      it('should reject invalid email formats', () => {
        const invalidEmails = [
          ['invalid-email'],
          ['test@', '@example.com'],
          ['user@', 'valid@example.com'],
          ['spaces in@email.com'],
        ];

        invalidEmails.forEach((invitedUsers) => {
          const invalidData = {
            body: {
              challengeName: 'Valid Name',
              challengeDesc: 'Description',
              startTime: '2024-08-15T10:00:00Z',
              duration: 30,
              invitedUsers,
            },
          };

          expect(() => createChallengeSchema.parse(invalidData)).toThrow();
        });
      });

      it('should reject non-array invited users', () => {
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
            invitedUsers: 'not-an-array',
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });
    });

    describe('Missing Required Fields', () => {
      it('should reject missing challenge name', () => {
        const invalidData = {
          body: {
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });

      it('should reject missing challenge description', () => {
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            startTime: '2024-08-15T10:00:00Z',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });

      it('should reject missing start time', () => {
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: 'Description',
            duration: 30,
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });

      it('should reject missing duration', () => {
        const invalidData = {
          body: {
            challengeName: 'Valid Name',
            challengeDesc: 'Description',
            startTime: '2024-08-15T10:00:00Z',
          },
        };

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });

      it('should reject missing body', () => {
        const invalidData = {};

        expect(() => createChallengeSchema.parse(invalidData)).toThrow();
      });
    });
  });

  describe('challengeWaypointSchema', () => {
    describe('Happy Path', () => {
      it('should validate valid challenge waypoint request', () => {
        const validData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
            waypointsRef: 'downtown-tour',
          },
        };

        const result = challengeWaypointSchema.parse(validData);
        expect(result).toEqual(validData);
      });
    });

    describe('Challenge ID Validation', () => {
      it('should reject invalid UUID format', () => {
        const invalidData = {
          body: {
            challengeId: 'invalid-uuid',
            waypointsRef: 'downtown-tour',
          },
        };

        expect(() => challengeWaypointSchema.parse(invalidData)).toThrow();
      });

      it('should reject non-string challenge ID', () => {
        const invalidData = {
          body: {
            challengeId: 123,
            waypointsRef: 'downtown-tour',
          },
        };

        expect(() => challengeWaypointSchema.parse(invalidData)).toThrow();
      });

      it('should reject missing challenge ID', () => {
        const invalidData = {
          body: {
            waypointsRef: 'downtown-tour',
          },
        };

        expect(() => challengeWaypointSchema.parse(invalidData)).toThrow();
      });
    });

    describe('Waypoints Reference Validation', () => {
      it('should accept valid waypoint reference strings', () => {
        const validRefs = [
          'downtown-tour',
          'park-adventure',
          'museum-hunt',
          'simple',
          'complex-waypoint-reference-name',
        ];

        validRefs.forEach((waypointsRef) => {
          const validData = {
            body: {
              challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
              waypointsRef,
            },
          };

          expect(() => challengeWaypointSchema.parse(validData)).not.toThrow();
        });
      });

      it('should reject non-string waypoints reference', () => {
        const invalidData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
            waypointsRef: 123,
          },
        };

        expect(() => challengeWaypointSchema.parse(invalidData)).toThrow();
      });

      it('should reject missing waypoints reference', () => {
        const invalidData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
          },
        };

        expect(() => challengeWaypointSchema.parse(invalidData)).toThrow();
      });
    });
  });

  describe('challengeParticipantsSchema', () => {
    describe('Happy Path', () => {
      it('should validate valid challenge participants request', () => {
        const validData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
            participants: ['user1@example.com', 'user2@example.com'],
          },
        };

        const result = challengeParticipantsSchema.parse(validData);
        expect(result).toEqual(validData);
      });

      it('should validate request without invited users', () => {
        const validData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
          },
        };

        const result = challengeParticipantsSchema.parse(validData);
        expect(result).toEqual(validData);
      });

      it('should validate request with empty invited users array', () => {
        const validData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
            participants: [],
          },
        };

        const result = challengeParticipantsSchema.parse(validData);
        expect(result).toEqual(validData);
      });
    });

    describe('Challenge ID Validation', () => {
      it('should reject invalid UUID format', () => {
        const invalidData = {
          body: {
            challengeId: 'not-a-valid-uuid',
            invitedUsers: ['user@example.com'],
          },
        };

        expect(() => challengeParticipantsSchema.parse(invalidData)).toThrow();
      });

      it('should reject missing challenge ID', () => {
        const invalidData = {
          body: {
            invitedUsers: ['user@example.com'],
          },
        };

        expect(() => challengeParticipantsSchema.parse(invalidData)).toThrow();
      });
    });

    describe('Invited Users Validation', () => {
      it('should accept multiple valid emails', () => {
        const validData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
            invitedUsers: [
              'john@example.com',
              'jane.doe@company.org',
              'test.user+tag@domain.co.uk',
            ],
          },
        };

        expect(() => challengeParticipantsSchema.parse(validData)).not.toThrow();
      });

      it('should reject invalid email formats in array', () => {
        const invalidData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
            participants: ['valid@example.com', 'invalid-email'],
          },
        };

        expect(() => challengeParticipantsSchema.parse(invalidData)).toThrow();
      });

      it('should reject non-array invited users', () => {
        const invalidData = {
          body: {
            challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
            participants: 'not-an-array',
          },
        };

        expect(() => challengeParticipantsSchema.parse(invalidData)).toThrow();
      });
    });
  });

  describe('Kebab-case Input Handling', () => {
    // These tests verify that the API should accept kebab-case input
    // Note: The current validator expects camelCase, so these tests will fail initially
    // They represent the expected behavior after implementing kebab-case transformation

    it('should handle kebab-case input for createChallengeSchema', () => {
      const kebabCaseInput = {
        body: {
          'challenge-name': 'Summer Adventure',
          'challenge-desc': 'Great adventure',
          'waypoints-ref': 'downtown-tour',
          'start-time': '2024-08-15T10:00:00Z',
          duration: 90,
          'invited-users': ['user1@example.com'],
        },
      };

      // The validator should now transform kebab-case to camelCase internally
      const result = createChallengeSchema.parse(kebabCaseInput);
      expect(result.body.challengeName).toBe('Summer Adventure');
      expect(result.body.challengeDesc).toBe('Great adventure');
      expect(result.body.waypointsRef).toBe('downtown-tour');
      expect(result.body.startTime).toStrictEqual(new Date('2024-08-15T10:00:00Z'));
      expect(result.body.duration).toBe(90);
      expect(result.body.invitedUsers).toEqual(['user1@example.com']);
    });

    it('should handle kebab-case input for challengeWaypointSchema', () => {
      const kebabCaseInput = {
        body: {
          'challenge-id': '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
          'waypoints-ref': 'downtown-tour',
        },
      };

      // The validator should now transform kebab-case to camelCase internally
      const result = challengeWaypointSchema.parse(kebabCaseInput);
      expect(result.body.challengeId).toBe('01234567-89ab-7def-8123-456789abcdef');
      expect(result.body.waypointsRef).toBe('downtown-tour');
    });

    it('should handle kebab-case input for challengeParticipantsSchema', () => {
      const kebabCaseInput = {
        body: {
          challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
          participants: ['user1@example.com'],
        },
      };

      // The validator should now transform kebab-case to camelCase internally
      const result = challengeParticipantsSchema.parse(kebabCaseInput);
      expect(result.body.challengeId).toBe('01234567-89ab-7def-8123-456789abcdef');
      expect(result.body.participants).toEqual(['user1@example.com']);
    });
  });
});
