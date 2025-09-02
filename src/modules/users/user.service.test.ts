import { UnauthorizedError } from '../../shared/types/errors';
import { userService } from './user.service';

describe('user.service test-cases', () => {
  describe('validateUser', () => {
    it('should return a UserResponse instance if password is correct', async () => {
      const inputUser = {
        user_id: '000',
        username: 'user@local.domain',
        password_hash: '$2b$12$lH5CNhU3bl/2dwV99pxHV.WqLrQeeHn8aMUdZnRXa.1WHsv5imqIW',
        nickname: 'user',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };
      const outputUser = {
        user_id: '000',
        username: 'user@local.domain',
        nickname: 'user',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      const validation = await userService.validateUser(inputUser, 'test-my-pass');
      expect(validation.user_id).toBe(outputUser.user_id);
      expect(validation.username).toBe(outputUser.username);
    });

    it('should throw error if password does not match hashed password', async () => {
      const inputUser = {
        user_id: '000',
        username: 'user@local.domain',
        password_hash: '$2b$12$lH5CNhU3bl/2dwV99pxHV.WqLrQeeHn8aMUdZnRXa.1WHsv5imqIW',
        nickname: 'user',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      await expect(userService.validateUser(inputUser, 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });
  });
});
